import { describe, expect, it } from "bun:test"
import { ATTEMPTS, associationsFor, RETRY_MS } from "../scripts/direct-push-associations"
import {
	type AssociatedPullRequest,
	type CompareResult,
	issueTitle,
	MAX_ISSUES,
	type PushedCommit,
	planPush,
} from "../scripts/direct-push-plan"
import { issueBody } from "../scripts/direct-push-report"

const merged: AssociatedPullRequest = { mergedAt: "2026-11-12T00:00:00Z", baseRef: "main" }
const open: AssociatedPullRequest = { mergedAt: null, baseRef: "main" }
const otherBase: AssociatedPullRequest = { mergedAt: "2026-11-12T00:00:00Z", baseRef: "next" }

function commit(sha: string, overrides: Partial<PushedCommit> = {}): PushedCommit {
	return {
		sha,
		author: "Agent",
		subject: `subject ${sha.slice(0, 7)}`,
		parents: ["parent"],
		...overrides,
	}
}

function complete(...commits: readonly PushedCommit[]): CompareResult {
	return { status: "complete", commits }
}

function plan(
	commits: readonly PushedCommit[],
	pulls: Record<string, readonly AssociatedPullRequest[]> = {},
) {
	return planPush({ compare: complete(...commits), pullRequests: pulls, existingIssues: [] })
}

const sha = (letter: string): string => letter.repeat(40)

describe("a commit that reached main", () => {
	it("passes when a pull request merged it into main", () => {
		const one = commit(sha("a"))
		expect(plan([one], { [one.sha]: [merged] })).toEqual({
			warnings: [],
			offenders: [],
			issues: [],
			overflow: 0,
		})
	})

	it("is an offender when GitHub associates no pull request with it", () => {
		const one = commit(sha("a"))
		expect(plan([one]).offenders).toEqual([one])
	})

	it("is an offender when its pull request is only open", () => {
		const one = commit(sha("a"))
		expect(plan([one], { [one.sha]: [open] }).offenders).toEqual([one])
	})

	it("is an offender when its pull request merged into another base", () => {
		const one = commit(sha("a"))
		expect(plan([one], { [one.sha]: [otherBase] }).offenders).toEqual([one])
	})

	it("is exempt when it is the root commit, which no pull request can have delivered", () => {
		const root = commit(sha("a"), { parents: [] })
		expect(plan([root]).offenders).toEqual([])
	})
})

describe("a push whose history cannot be inspected in full", () => {
	const after = commit(sha("f"))

	function incomplete(gap: "new-branch" | "failed" | "diverged" | "truncated") {
		return planPush({
			compare: { status: "incomplete", gap, after },
			pullRequests: {},
			existingIssues: [],
		})
	}

	it("checks only the final commit of a new branch and warns about its earlier history", () => {
		const result = incomplete("new-branch")
		expect(result.offenders).toEqual([after])
		expect(result.warnings[0]).toContain(after.sha.slice(0, 7))
		expect(result.warnings[0]).toContain("new branch")
	})

	it("warns that a force push rewrote the history before the final commit", () => {
		expect(incomplete("diverged").warnings[0]).toContain("rewrote history")
	})

	it("warns that the compare failed and only the final commit was checked", () => {
		expect(incomplete("failed").warnings[0]).toContain("comparison with the previous head failed")
	})

	it("warns that a push over the 250-commit compare limit checked only the final commit", () => {
		expect(incomplete("truncated").warnings[0]).toContain("more than 250 commits")
	})
})

describe("the issues the direct-push check files", () => {
	it("files one issue per offender, titled with the short SHA a re-run finds", () => {
		const one = commit(sha("d"))
		const result = plan([one])
		expect(result.issues).toEqual([one])
		expect(issueTitle(one)).toBe("Direct push to main: ddddddd")
	})

	it("files at most five issues per push and still names every offender", () => {
		const many = Array.from({ length: 7 }, (_value, index) => commit(sha(String(index))))
		const result = plan(many)
		expect(result.offenders).toHaveLength(7)
		expect(result.issues).toHaveLength(MAX_ISSUES)
		expect(result.overflow).toBe(2)
	})

	it("files no second issue for an offender whose issue exists, open or closed", () => {
		const one = commit(sha("d"))
		const result = planPush({
			compare: complete(one),
			pullRequests: {},
			existingIssues: [issueTitle(one)],
		})
		expect(result.offenders).toEqual([one])
		expect(result.issues).toEqual([])
	})

	it("names the commit, its author and the revert fix in the issue body", () => {
		const one = commit(sha("d"))
		const body = issueBody(one, "trajectonomics/cicd")
		expect(body).toContain(`github.com/trajectonomics/cicd/commit/${one.sha}`)
		expect(body).toContain("Agent")
		expect(body).toContain(`git revert ${one.sha}`)
	})
})

describe("the association lookup", () => {
	it("asks again when the answer is empty, because the association lags the merge", async () => {
		const waits: number[] = []
		let calls = 0
		const lookup = async () => {
			calls += 1
			return calls === 1 ? [] : [merged]
		}
		const result = await associationsFor(["a"], lookup, async (ms) => {
			waits.push(ms)
		})
		expect(result["a"]).toEqual([merged])
		expect(calls).toBe(2)
		expect(waits).toEqual([RETRY_MS])
	})

	it("stops at three attempts and reports the last empty answer", async () => {
		const waits: number[] = []
		let calls = 0
		const result = await associationsFor(
			["a"],
			async () => {
				calls += 1
				return []
			},
			async (ms) => {
				waits.push(ms)
			},
		)
		expect(calls).toBe(ATTEMPTS)
		expect(waits).toHaveLength(ATTEMPTS - 1)
		expect(result["a"]).toEqual([])
	})

	it("asks once when the first answer names a pull request", async () => {
		let calls = 0
		await associationsFor(
			["a"],
			async () => {
				calls += 1
				return [merged]
			},
			async () => undefined,
		)
		expect(calls).toBe(1)
	})
})
