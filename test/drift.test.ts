import { describe, expect, it } from "bun:test"
import { type DriftInput, type Finding, planDrift } from "../scripts/drift-plan"
import { ISSUE_TITLE, renderIssue, TITLE_PREFIX } from "../scripts/drift-report"

const preset = "@trajectonomics/tooling/configs/base"
const schema = "https://biomejs.dev/schemas/2.6.3/schema.json"

/** A consumer that is up to date and keeps its rules where the preset puts them. */
const current = `{
	// JSONC: comments and trailing commas are allowed
	"$schema": "${schema}",
	"root": true,
	"extends": ["${preset}"],
	"vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
	"files": { "includes": ["**"] },
}`

function input(overrides: Partial<DriftInput> = {}): DriftInput {
	return { pin: "1.1.0", config: current, latest: "1.1.0", ...overrides }
}

function kinds(overrides: Partial<DriftInput> = {}): string[] {
	return planDrift(input(overrides)).map((finding) => finding.kind)
}

describe("a consumer that has drifted", () => {
	it("reports nothing when the pin is current and the config only extends the preset", () => {
		expect(planDrift(input())).toEqual([])
	})

	it("reports the pin behind when the exact pin predates the published latest", () => {
		expect(planDrift(input({ pin: "1.0.0" }))).toContainEqual({
			kind: "pin-behind",
			pin: "1.0.0",
			latest: "1.1.0",
		})
	})

	it("reports a pin that is not exact when it is a range", () => {
		expect(kinds({ pin: "^1.0.0" })).toEqual(["pin-not-exact"])
	})

	it("reports a pin that is not exact when the package is not a dependency", () => {
		expect(planDrift(input({ pin: null }))).toEqual([{ kind: "pin-not-exact", pin: null }])
	})

	it("reports a preset not extended when extends names no preset of this package", () => {
		const config = `{ "$schema": "${schema}", "extends": ["./biome/base.json"] }`
		expect(kinds({ config })).toEqual(["preset-not-extended"])
	})

	it("reports local rules for a top-level block the preset owns", () => {
		const config = JSON.stringify({ extends: [preset], linter: { enabled: true } })
		expect(kinds({ config })).toEqual(["local-rules"])
	})

	it("reports local rules for every block the preset owns, not just linter", () => {
		const config = JSON.stringify({
			extends: [preset],
			assist: { actions: {} },
			graphql: { formatter: {} },
		})
		const findings = planDrift(input({ config }))
		expect(findings).toEqual([{ kind: "local-rules", keys: ["assist", "graphql"] }])
	})

	it("reports local rules for an overrides entry that carries rules", () => {
		const config = JSON.stringify({
			extends: [preset],
			overrides: [{ includes: ["**/*.ts"], linter: { rules: {} } }],
		})
		expect(planDrift(input({ config }))).toEqual([
			{ kind: "local-rules", keys: ["overrides[0].linter"] },
		])
	})

	it("stays clean for css plus overrides that only scope files", () => {
		const config = JSON.stringify({
			root: true,
			extends: [preset],
			css: { parser: { cssModules: true } },
			overrides: [{ includes: ["**/*.test.ts"], files: { maxSize: 1 } }],
		})
		expect(planDrift(input({ config }))).toEqual([])
	})

	it("reports an unreadable config instead of throwing", () => {
		const [finding] = planDrift(input({ config: '{ "extends": [' }))
		expect(finding?.kind).toBe("config-unreadable")
	})

	it("reports an unreadable config when the consumer has no file at all", () => {
		expect(planDrift(input({ config: null }))).toEqual([
			{ kind: "config-unreadable", reason: "no Biome config found" },
		])
	})
})

describe("the issue a run files", () => {
	const every: readonly Finding[] = [
		{ kind: "pin-behind", pin: "1.0.0", latest: "1.1.0" },
		{ kind: "pin-not-exact", pin: "^1.0.0" },
		{ kind: "pin-not-exact", pin: null },
		{ kind: "preset-not-extended" },
		{ kind: "local-rules", keys: ["linter", "overrides[0].plugins"] },
		{ kind: "config-unreadable", reason: "Unexpected end of input" },
	]

	it("tells the owner the command that fixes a pin that is behind", () => {
		expect(renderIssue([every[0]!])).toContain("bun add -d --exact @trajectonomics/tooling@1.1.0")
	})

	it("says what to do about every finding it can report", () => {
		const body = renderIssue(every)
		for (const expected of [
			"The pin `^1.0.0` is a range",
			"is not a dependency",
			"extends no `@trajectonomics/tooling/configs/*` preset",
			"`linter`, `overrides[0].plugins`",
			"Unexpected end of input",
			"a report, not a failed run",
		]) {
			expect(body).toContain(expected)
		}
	})

	it("is found by a title prefix, not a label no repository provisions", () => {
		expect(ISSUE_TITLE.startsWith(TITLE_PREFIX)).toBe(true)
	})
})
