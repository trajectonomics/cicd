import type { PushedCommit } from "./direct-push-plan"

/** The issue body names the commit, its author and the only fix: revert it through a pull request. */
export function issueBody(commit: PushedCommit, repository: string): string {
	return [
		"A commit reached `main` without a pull request merged into `main`.",
		"",
		`- Commit: https://github.com/${repository}/commit/${commit.sha}`,
		`- Author: ${commit.author}`,
		`- Subject: ${commit.subject}`,
		"",
		"This is an alarm, not prevention: the push already happened.",
		`Revert it through a pull request: on a \`fix/*\` branch, \`git revert ${commit.sha}\`, then open a PR.`,
		"",
		"Filed by the Direct-push check (`.github/workflows/direct-push-check.yml`).",
	].join("\n")
}
