/**
 * Reports a commit that reached main without a merged pull request as one GitHub issue.
 *
 *   bun direct-push.ts
 *
 * `.github/workflows/direct-push-check.yml` runs this after a caller's push to main.
 * The job is red whenever an offender exists: the push already happened, so the red
 * run is the alarm, and one issue per offender is how the owner hears of it the same
 * day. `gh` reads the commits and writes the issues; the planner stays pure.
 */
import { associationsFor } from "./direct-push-associations"
import {
	associatedPulls,
	ensureLabel,
	fileIssue,
	issueTitles,
	readCompare,
} from "./direct-push-github"
import { planPush } from "./direct-push-plan"

async function main(): Promise<void> {
	const repository = process.env["REPOSITORY"] ?? ""
	const before = process.env["BEFORE"] ?? ""
	const after = process.env["AFTER"] || process.env["GITHUB_SHA"] || ""
	const compare = await readCompare(repository, before, after)
	const commits = compare.status === "complete" ? compare.commits : [compare.after]
	// A root commit is exempt, so its association is not worth a retry.
	const pushed = commits.filter((commit) => commit.parents.length > 0).map((commit) => commit.sha)
	const pullRequests = await associationsFor(
		pushed,
		(sha) => associatedPulls(repository, sha),
		(ms) => Bun.sleep(ms),
	)
	const plan = planPush({ compare, pullRequests, existingIssues: await issueTitles(repository) })
	for (const warning of plan.warnings) console.log(`::warning::${warning}`)
	for (const offender of plan.offenders)
		console.log(`Offender ${offender.sha}: ${offender.subject}`)
	if (plan.offenders.length === 0) {
		console.log("Every pushed commit has a pull request merged into main.")
		return
	}
	if (plan.issues.length > 0) await ensureLabel(repository)
	for (const issue of plan.issues) await fileIssue(repository, issue)
	if (plan.overflow > 0) console.log(`${plan.overflow} more offender(s) are above, with no issue.`)
	console.log(`::error::${plan.offenders.length} commit(s) reached main without a merged PR.`)
	process.exitCode = 1
}

if (import.meta.main) await main()
