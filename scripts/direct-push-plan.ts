/**
 * Decides which commits of a push reached main without a pull request.
 *
 * Pure: the compare result, each commit's associated pull requests and the
 * repository's issue titles go in, the offenders and the issues to open come out.
 * scripts/direct-push-github.ts does the GitHub I/O.
 */

/** One pull request GitHub says contains a commit. */
export type AssociatedPullRequest = {
	readonly mergedAt: string | null
	readonly baseRef: string
}

/** One commit the push may have delivered to main. */
export type PushedCommit = {
	readonly sha: string
	readonly author: string
	readonly subject: string
	/** Empty for a root commit, which no pull request can have delivered. */
	readonly parents: readonly string[]
}

/** Why the pushed commits could not all be inspected. */
export type CompareGap = "new-branch" | "failed" | "diverged" | "truncated"

/** What the compare endpoint said about `before`..`after`. */
export type CompareResult =
	| { readonly status: "complete"; readonly commits: readonly PushedCommit[] }
	| { readonly status: "incomplete"; readonly gap: CompareGap; readonly after: PushedCommit }

export type PushInput = {
	readonly compare: CompareResult
	/** The pull requests associated with a commit, by full SHA. Absent means none. */
	readonly pullRequests: Readonly<Record<string, readonly AssociatedPullRequest[]>>
	/** The title of every issue in the repository, open or closed. */
	readonly existingIssues: readonly string[]
}

export type PushPlan = {
	/** One explanation per gap, for a warning annotation. Empty when everything was inspected. */
	readonly warnings: readonly string[]
	/** Every commit with no pull request merged into main. */
	readonly offenders: readonly PushedCommit[]
	/** The offenders that still need an issue, capped at MAX_ISSUES. */
	readonly issues: readonly PushedCommit[]
	/** New offenders beyond the cap: named in the log, never filed as issues. */
	readonly overflow: number
}

/** At most this many issues per push; the rest wait in the log for the next push. */
export const MAX_ISSUES = 5

/** A short SHA is what a re-run searches titles for, so 7 characters is the identity. */
const SHORT_SHA = 7

const GAP_WARNINGS: Record<CompareGap, string> = {
	"new-branch":
		"earlier history on a new branch was not inspected, because the comparison has no base commit",
	diverged: "earlier history was not inspected, because the push rewrote history",
	failed: "earlier history was not inspected, because the comparison with the previous head failed",
	truncated:
		"earlier history was not inspected, because the push compares more than 250 commits, which GitHub does not list in full",
}

function short(commit: PushedCommit): string {
	return commit.sha.slice(0, SHORT_SHA)
}

/** The one issue an offending commit gets, found again by a re-run through this title. */
export function issueTitle(commit: PushedCommit): string {
	return `Direct push to main: ${short(commit)}`
}

function warningsFor(compare: CompareResult): readonly string[] {
	if (compare.status === "complete") return []
	return [`Only ${short(compare.after)} was checked: ${GAP_WARNINGS[compare.gap]}.`]
}

/** Every commit the check could see. A gap leaves only the final commit. */
function inspected(compare: CompareResult): readonly PushedCommit[] {
	return compare.status === "complete" ? compare.commits : [compare.after]
}

/** A root commit is exempt: there was no earlier state a pull request could merge. */
function delivered(commit: PushedCommit, pulls: readonly AssociatedPullRequest[]): boolean {
	if (commit.parents.length === 0) return true
	return pulls.some((pull) => pull.mergedAt !== null && pull.baseRef === "main")
}

export function planPush(input: PushInput): PushPlan {
	const offenders = inspected(input.compare).filter(
		(commit) => !delivered(commit, input.pullRequests[commit.sha] ?? []),
	)
	const filed = new Set(input.existingIssues)
	const fresh = offenders.filter((commit) => !filed.has(issueTitle(commit)))
	const issues = fresh.slice(0, MAX_ISSUES)
	return {
		warnings: warningsFor(input.compare),
		offenders,
		issues,
		overflow: fresh.length - issues.length,
	}
}
