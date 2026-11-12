/**
 * The GitHub side of the Direct-push check: the `gh` reads and the alarm issue.
 * scripts/direct-push.ts composes them with the pure planner.
 */
import { $ } from "bun"
import {
	type AssociatedPullRequest,
	type CompareGap,
	type CompareResult,
	issueTitle,
	type PushedCommit,
} from "./direct-push-plan"
import { issueBody } from "./direct-push-report"

const ZERO_SHA = /^0+$/

/** GitHub's compare endpoint lists at most this many commits; a longer push cannot be read in full. */
const COMPARE_LIMIT = 250

type CommitJson = {
	readonly sha: string
	readonly parents?: readonly { readonly sha: string }[]
	readonly commit: {
		readonly author: { readonly name?: string } | null
		readonly message: string
	}
}
type PullJson = { readonly merged_at: string | null; readonly base: { readonly ref: string } }
type IssueJson = { readonly title: string; readonly pull_request?: unknown }
type ComparePage = {
	readonly status?: string
	readonly total_commits?: number
	readonly commits?: readonly CommitJson[]
}

async function api<T>(path: string): Promise<T> {
	return JSON.parse(await $`gh api -H "Accept: application/vnd.github+json" ${path}`.text()) as T
}

async function apiPages<T>(path: string): Promise<readonly T[]> {
	const text = await $`gh api --paginate --slurp ${path}`.text()
	const pages = JSON.parse(text) as readonly (readonly T[])[]
	return pages.flat()
}

function toCommit(json: CommitJson): PushedCommit {
	return {
		sha: json.sha,
		author: json.commit.author?.name ?? "unknown",
		subject: json.commit.message.split("\n")[0] ?? "",
		parents: (json.parents ?? []).map((parent) => parent.sha),
	}
}

function toPull(json: PullJson): AssociatedPullRequest {
	return { mergedAt: json.merged_at, baseRef: json.base.ref }
}

async function gap(repository: string, after: string, reason: CompareGap): Promise<CompareResult> {
	const commit = await api<CommitJson>(`repos/${repository}/commits/${after}`)
	return { status: "incomplete", gap: reason, after: toCommit(commit) }
}

export async function readCompare(
	repository: string,
	before: string,
	after: string,
): Promise<CompareResult> {
	if (ZERO_SHA.test(before)) return gap(repository, after, "new-branch")
	try {
		const pages = await apiPages<ComparePage>(
			`repos/${repository}/compare/${before}...${after}?per_page=100`,
		)
		const [first] = pages
		if (first?.status === "diverged") return gap(repository, after, "diverged")
		if ((first?.total_commits ?? 0) > COMPARE_LIMIT) return gap(repository, after, "truncated")
		const commits = pages.flatMap((page) => page.commits ?? []).map(toCommit)
		return { status: "complete", commits }
	} catch {
		return gap(repository, after, "failed")
	}
}

export async function associatedPulls(
	repository: string,
	sha: string,
): Promise<readonly AssociatedPullRequest[]> {
	const pulls = await api<readonly PullJson[]>(`repos/${repository}/commits/${sha}/pulls`)
	return pulls.map(toPull)
}

/** Every issue title, open or closed. The issues endpoint also returns pull requests. */
export async function issueTitles(repository: string): Promise<readonly string[]> {
	const issues = await apiPages<IssueJson>(`repos/${repository}/issues?state=all&per_page=100`)
	return issues.filter((issue) => issue.pull_request === undefined).map((issue) => issue.title)
}

/** Creates the alarm label only when it is missing; an existing label keeps its colour. */
export async function ensureLabel(repository: string): Promise<void> {
	await $`gh api -X POST repos/${repository}/labels -f name=ready-for-human -f color=1d76db -f description="Requires human implementation"`
		.quiet()
		.nothrow()
}

export async function fileIssue(repository: string, commit: PushedCommit): Promise<void> {
	const url =
		await $`gh issue create --repo ${repository} --title ${issueTitle(commit)} --body ${issueBody(commit, repository)} --label ready-for-human`
			.quiet()
			.text()
	console.log(url.trim())
}
