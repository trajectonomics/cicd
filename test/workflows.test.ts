import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const workflows = join(root, ".github/workflows")
const localCaller = "./.github/workflows/publish.yml"
const publishedCaller = "trajectonomics/cicd/.github/workflows/publish.yml@v1"

type Job = {
	uses?: string
	with?: Record<string, unknown>
	secrets?: string
	steps?: unknown[]
}

type Workflow = {
	on: {
		push?: object | null
		workflow_dispatch?: { inputs?: Record<string, unknown> } | null
		workflow_call?: object | null
	}
	permissions?: Record<string, string>
	jobs: Record<string, Job>
}

function load(file: string): Workflow {
	return Bun.YAML.parse(readFileSync(join(workflows, file), "utf8")) as Workflow
}

/** Release caller templates this repo publishes. README.md is what a new package copies. */
function documentedCallers(): Workflow[] {
	const readme = readFileSync(join(root, "README.md"), "utf8")
	return [...readme.matchAll(/```yaml\n([\s\S]*?)```/g)]
		.map((match) => match[1] ?? "")
		.filter((yaml) => yaml.includes("# .github/workflows/release.yml"))
		.map((yaml) => Bun.YAML.parse(yaml) as Workflow)
}

function expectThinCaller(workflow: Workflow, uses: string): void {
	expect(workflow.permissions).toMatchObject({ "id-token": "write", contents: "write" })
	expect(workflow.on.push).toMatchObject({ branches: ["main"] })
	expect(workflow.on.workflow_dispatch?.inputs).toHaveProperty("bump")
	expect(Object.keys(workflow.jobs)).toEqual(["publish"])
	const job = workflow.jobs["publish"]
	expect(job?.uses).toBe(uses)
	expect(job?.with).toHaveProperty("bump")
	expect(job?.secrets).toBe("inherit")
	expect(job?.steps).toBeUndefined()
}

describe("release.yml (the caller npm trusted publishing validates)", () => {
	const release = load("release.yml")

	it("is a thin caller that can mint the npm OIDC token and write tags and releases", () => {
		expectThinCaller(release, localCaller)
	})
})

describe("the release.yml template a new package copies from the README", () => {
	const callers = documentedCallers()

	it("is a thin caller of the published reusable workflow", () => {
		expect(callers).toHaveLength(1)
		expectThinCaller(callers[0]!, publishedCaller)
	})

	it("defaults the floating major tag to off", () => {
		expect(callers[0]!.jobs["publish"]?.with).not.toHaveProperty("float-major-tag")
	})
})

describe("publish.yml (the reusable workflow)", () => {
	const publish = load("publish.yml")

	it("is callable from other repos", () => {
		expect(publish.on).toHaveProperty("workflow_call")
	})

	it("asks for the same token permissions as its callers", () => {
		expect(publish.permissions).toMatchObject({ "id-token": "write", contents: "write" })
	})
})
