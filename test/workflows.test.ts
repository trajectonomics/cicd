import { describe, expect, it } from "bun:test"
import {
	documentedCallers,
	expectScriptSteps,
	loadWorkflow as load,
	steps,
	type Workflow,
} from "./workflow-file"

const localCaller = "./.github/workflows/publish.yml"
const publishedCaller = "trajectonomics/cicd/.github/workflows/publish.yml@v1"
const publishedDrift = "trajectonomics/cicd/.github/workflows/drift.yml@v1"

/** The text of a GitHub Actions expression, built so Biome does not read it as a JS template. */
const expression = (body: string): string => ["${{", body, "}}"].join(" ")

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

	it("exposes the version, tag, channel and dist-tag a later job needs", () => {
		const outputs = publish.on.workflow_call?.outputs ?? {}
		expect(Object.keys(outputs)).toEqual(["version", "tag", "channel", "dist-tag"])
		for (const [name, output] of Object.entries(outputs)) {
			expect(output.description).toBeTruthy()
			expect(output.value).toBe(expression(`jobs.publish.outputs.${name}`))
		}

		const job = publish.jobs["publish"]?.outputs ?? {}
		expect(job["version"]).toBe(expression("steps.plan.outputs.version"))
		expect(job["channel"]).toBe(expression("steps.plan.outputs.channel"))
		expect(job["dist-tag"]).toBe(expression("steps.plan.outputs.dist_tag"))
		expect(job["tag"]).toBe(
			expression(
				"steps.plan.outputs.channel == 'stable' && format('v{0}', steps.plan.outputs.version) || ''",
			),
		)
	})

	it("explains a brand-new package before it tries to publish", () => {
		const all = steps(publish)
		const preflight = all.findIndex((step) => step.name?.startsWith("Preflight"))
		const publishStep = all.findIndex((step) => step.name === "Publish to npm")
		expect(preflight).toBeGreaterThan(-1)
		expect(preflight).toBeLessThan(publishStep)
		const run = all[preflight]?.run ?? ""
		expect(run).toContain("https://www.npmjs.com/package/$NAME/access")
		expect(run).toContain("--provenance=false")
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

describe("drift.yml (the reusable workflow)", () => {
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

	it("checks the planner out at the same v1 the caller pins, never at a ref of its own choosing", () => {
		const planner = steps(drift).find((step) => step.with?.["repository"] !== undefined)
		expect(planner?.with).toMatchObject({ ref: "v1", path: ".cicd" })
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
