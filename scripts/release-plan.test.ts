import { describe, expect, it } from "bun:test"
import { planRelease } from "./release-plan"

describe("planRelease", () => {
	it("publishes an alpha for every push to main", () => {
		expect(planRelease("push")).toEqual({ channel: "alpha", distTag: "alpha" })
	})

	it("publishes a stable version under latest when the workflow is run by hand", () => {
		expect(planRelease("workflow_dispatch")).toEqual({ channel: "stable", distTag: "latest" })
	})

	it.each(["release", "pull_request", ""])("rejects the event %p", (event) => {
		expect(() => planRelease(event)).toThrow("push or workflow_dispatch")
	})
})
