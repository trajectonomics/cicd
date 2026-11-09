import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const workflows = join(root, ".github/workflows")
const localCaller = "./.github/workflows/publish.yml"
const publishedCaller = "trajectonomics/cicd/.github/workflows/publish.yml@v1"
const publishedDrift = "trajectonomics/cicd/.github/workflows/drift.yml@v1"

type Step = {
	uses?: string
	run?: string
	if?: string
	with?: Record<string, unknown>
}

type Job = {
	uses?: string
	with?: Record<string, unknown>
	secrets?: string
	steps?: Step[]
}

type Workflow = {
	on: {
		push?: object | null
		schedule?: { cron?: string }[]
		workflow_dispatch?: { inputs?: Record<string, unknown> } | null
		workflow_call?: { inputs?: Record<string, unknown> } | null
	}
	permissions?: Record<string, string>
	jobs: Record<string, Job>
}

function load(file: string): Workflow {
	return Bun.YAML.parse(readFileSync(join(workflows, file), "utf8")) as Workflow
}

function steps(workflow: Workflow): Step[] {
	return Object.values(workflow.jobs).flatMap((job) => job.steps ?? [])
}

/** Caller templates this repo publishes. README.md is what a consumer copies. */
function documentedCallers(file: string): Workflow[] {
	const readme = readFileSync(join(root, "README.md"), "utf8")
	return [...readme.matchAll(/```yaml\n([\s\S]*?)```/g)]
		.map((match) => match[1] ?? "")
		.filter((yaml) => yaml.includes(`# .github/workflows/${file}`))
		.map((yaml) => Bun.YAML.parse(yaml) as Workflow)
}

/** A run step is one bun command; a second line or a shell operator belongs in scripts/. */
function expectScriptSteps(workflow: Workflow): void {
	for (const step of steps(workflow)) {
		if (step.run === undefined) continue
		expect(step.run).toMatch(/^bun /)
		expect(step.run).not.toContain("\n")
		expect(step.run).not.toMatch(/&&|\|\||[;|<>]|\$\(/)
	}
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
	const callers = documentedCallers("release.yml")

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

describe("check.yml (the reusable check)", () => {
	const check = load("check.yml")

	it("takes an optional node-version that leaves existing callers unchanged", () => {
		const inputs = check.on.workflow_call?.inputs ?? {}
		expect(inputs).toHaveProperty("node-version")
		expect((inputs["node-version"] as { default?: string }).default).toBe("")
	})

	it("installs Node only when the caller names a version", () => {
		const node = steps(check).filter((step) => step.uses === "actions/setup-node@v4")
		expect(node).toHaveLength(1)
		expect(node[0]?.if).toContain("inputs.node-version")
		// biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, not a template
		expect(node[0]?.with).toEqual({ "node-version": "${{ inputs.node-version }}" })
	})

	it("runs one bun command per step, not inlined shell", () => {
		expectScriptSteps(check)
	})
})

describe("drift.yml (the reusable drift caller)", () => {
	const drift = load("drift.yml")

	it("is callable from other repos", () => {
		expect(drift.on).toHaveProperty("workflow_call")
	})

	it("may read the caller and write its issue, and nothing else", () => {
		expect(drift.permissions).toMatchObject({ contents: "read", issues: "write" })
	})

	it("leaves the schedule to its caller, whose own schedule a reusable workflow cannot fire", () => {
		expect(drift.on).not.toHaveProperty("schedule")
	})

	it("runs the planner from the pinned cicd checkout instead of inlined shell", () => {
		const runs = steps(drift)
			.map((step) => step.run)
			.filter(Boolean)
		expect(runs).toEqual(["bun .cicd/scripts/drift.ts"])
		expectScriptSteps(drift)
	})
})

describe("the drift.yml template a consumer copies from the README", () => {
	const callers = documentedCallers("drift.yml")

	it("parses and calls the published workflow with the permissions it needs", () => {
		expect(callers).toHaveLength(1)
		const caller = callers[0]!
		expect(caller.permissions).toMatchObject({ contents: "read", issues: "write" })
		expect(Object.keys(caller.jobs)).toEqual(["drift"])
		expect(caller.jobs["drift"]?.uses).toBe(publishedDrift)
		expect(caller.jobs["drift"]?.steps).toBeUndefined()
	})

	it("schedules itself weekly and can be run by hand", () => {
		const cron = callers[0]?.on.schedule?.[0]?.cron
		expect(cron?.split(" ")).toHaveLength(5)
		expect(callers[0]?.on).toHaveProperty("workflow_dispatch")
	})
})
