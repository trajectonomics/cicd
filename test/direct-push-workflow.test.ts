import { describe, expect, it } from "bun:test"
import { documentedCallers, expectScriptSteps, loadWorkflow, steps } from "./workflow-file"

const published = "trajectonomics/cicd/.github/workflows/direct-push-check.yml@v1"
const runner = "bun .cicd/scripts/direct-push.ts"

describe("direct-push-check.yml (the reusable workflow)", () => {
	const workflow = loadWorkflow("direct-push-check.yml")

	it("is callable from other repos", () => {
		expect(workflow.on).toHaveProperty("workflow_call")
	})

	it("may read the caller and its pull requests, and write its issues, and nothing else", () => {
		expect(workflow.permissions).toEqual({
			contents: "read",
			"pull-requests": "read",
			issues: "write",
		})
	})

	it("leaves the trigger and the concurrency group to its caller", () => {
		expect(workflow.on).not.toHaveProperty("push")
		expect(workflow.on).not.toHaveProperty("schedule")
		expect(workflow).not.toHaveProperty("concurrency")
	})

	it("checks the planner out at the same v1 the caller pins, never at a ref of its own", () => {
		const planner = steps(workflow).find((step) => step.with?.["repository"] !== undefined)
		expect(planner?.with).toMatchObject({ ref: "v1", path: ".cicd" })
	})

	it("runs the check from the pinned checkout in one bun step", () => {
		const runs = steps(workflow)
			.map((step) => step.run)
			.filter(Boolean)
		expect(runs).toEqual([runner])
		expectScriptSteps(workflow)
	})
})

describe("the direct-push-check.yml template a consumer copies from the README", () => {
	const callers = documentedCallers("direct-push-check.yml")

	it("parses and calls the published workflow with the permissions it needs", () => {
		expect(callers).toHaveLength(1)
		const caller = callers[0]!
		expect(caller.permissions).toEqual({
			contents: "read",
			"pull-requests": "read",
			issues: "write",
		})
		expect(Object.keys(caller.jobs)).toEqual(["direct-push-check"])
		expect(caller.jobs["direct-push-check"]?.uses).toBe(published)
		expect(caller.jobs["direct-push-check"]?.steps).toBeUndefined()
	})

	it("runs on a push to main only", () => {
		expect(callers[0]?.on.push).toMatchObject({ branches: ["main"] })
		expect(callers[0]?.on.schedule).toBeUndefined()
	})
})
