import { describe, expect, it } from "bun:test"
import { planRelease } from "./release-plan"

describe("planRelease", () => {
	it("publishes an alpha for every push to main", () => {
		expect(planRelease("push", "")).toEqual({ channel: "alpha", distTag: "alpha", version: null })
	})

	it("publishes the release tag as the stable version under latest", () => {
		expect(planRelease("release", "v1.2.3")).toEqual({
			channel: "stable",
			distTag: "latest",
			version: "1.2.3",
		})
	})

	it.each(["1.2.3", "v1.2", "v1.2.3-rc.1", "release-1", ""])(
		"rejects the release tag %p",
		(tag) => {
			expect(() => planRelease("release", tag)).toThrow("v1.2.3")
		},
	)

	it("rejects events that are neither push nor release", () => {
		expect(() => planRelease("workflow_dispatch", "")).toThrow("push or release")
	})
})
