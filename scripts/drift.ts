/**
 * Reports the shared tooling's drift in the calling repository as one GitHub issue.
 *
 *   bun drift.ts
 *
 * `.github/workflows/drift.yml` runs this from a consumer's checkout. It reads the
 * caller's pin and Biome config, asks the npm registry for `latest`, then opens,
 * updates or closes the issue titled "Tooling drift: ...". Every finding is a
 * report: the run stays green so a broken config never reads as a broken repository.
 */
import { existsSync, readFileSync } from "node:fs"
import { $ } from "bun"
import { type DriftInput, type Pin, planDrift } from "./drift-plan"
import { ISSUE_TITLE, renderIssue, TITLE_PREFIX } from "./drift-report"

const PACKAGE = "@trajectonomics/tooling"
const CONFIG_FILES = ["biome.jsonc", "biome.json"]
const NOTHING_STALE = "Nothing is stale any more, so this issue closes itself."

type Issue = { readonly number: number; readonly title: string }
type Manifest = {
	readonly devDependencies?: Record<string, string>
	readonly dependencies?: Record<string, string>
}

/** What package.json says about the pin. Never a throw: an unreadable manifest is a report too. */
function readPin(): Pin {
	try {
		const manifest = JSON.parse(readFileSync("package.json", "utf8")) as Manifest
		const version = manifest.devDependencies?.[PACKAGE] ?? manifest.dependencies?.[PACKAGE]
		return version === undefined ? { absent: true } : { version }
	} catch (error) {
		return { unreadable: error instanceof Error ? error.message : String(error) }
	}
}

function readConfig(): string | null {
	for (const name of CONFIG_FILES) {
		if (existsSync(name)) return readFileSync(name, "utf8")
	}
	return null
}

/** The `latest` dist-tag. Never `alpha`: it exists after every merge, so every consumer would look stale. */
async function readLatest(): Promise<string> {
	const response = await fetch(`https://registry.npmjs.org/${PACKAGE}`)
	if (!response.ok) throw new Error(`The npm registry answered ${response.status} for ${PACKAGE}`)
	const published = (await response.json()) as { "dist-tags"?: Record<string, string> }
	const latest = published["dist-tags"]?.["latest"]
	if (latest === undefined) throw new Error(`The registry publishes no latest tag for ${PACKAGE}`)
	return latest
}

/** The one open issue whose title carries TITLE_PREFIX. */
async function findIssue(): Promise<Issue | undefined> {
	const listed = await $`gh issue list --state open --limit 1000 --json number,title`.text()
	const issues = JSON.parse(listed) as readonly Issue[]
	return issues.find((issue) => issue.title.startsWith(TITLE_PREFIX))
}

async function main(): Promise<void> {
	const input: DriftInput = { pin: readPin(), config: readConfig(), latest: await readLatest() }
	const findings = planDrift(input)
	const issue = await findIssue()
	if (findings.length === 0) {
		if (issue === undefined) console.log("No drift.")
		else await $`gh issue close ${issue.number} --comment ${NOTHING_STALE}`
		return
	}
	const body = renderIssue(findings)
	if (issue === undefined) {
		console.log((await $`gh issue create --title ${ISSUE_TITLE} --body ${body}`.text()).trim())
		return
	}
	await $`gh issue edit ${issue.number} --title ${ISSUE_TITLE} --body ${body}`
	console.log(`Updated issue #${issue.number} with ${findings.length} finding(s).`)
}

if (import.meta.main) await main()
