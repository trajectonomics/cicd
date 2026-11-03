import { describe, expect, it } from "bun:test"
import { bumpFromCommits, nextAlpha, nextStable } from "./version"

describe("bumpFromCommits", () => {
	it("is patch when nothing is a feature or breaking", () => {
		expect(bumpFromCommits(["fix: x", "docs: y", "chore(ci): z"])).toBe("patch")
		expect(bumpFromCommits([])).toBe("patch")
	})

	it("is minor for any feat, scoped or not", () => {
		expect(bumpFromCommits(["fix: x", "feat: y"])).toBe("minor")
		expect(bumpFromCommits(["feat(th): add 2027"])).toBe("minor")
	})

	it("is major for a ! subject or a BREAKING CHANGE footer", () => {
		expect(bumpFromCommits(["feat: a", "refactor!: drop US"])).toBe("major")
		expect(bumpFromCommits(["fix(types)!: rename"])).toBe("major")
		expect(bumpFromCommits(["fix: a\n\nBREAKING CHANGE: TaxResult shape"])).toBe("major")
	})

	it("ignores look-alikes", () => {
		expect(bumpFromCommits(["feature: no", "docs: mention feat: in text"])).toBe("patch")
		expect(bumpFromCommits(["fix: talk about BREAKING CHANGE: mid-line"])).toBe("patch")
	})
})

describe("nextStable", () => {
	it("starts from 0.0.0 when never released", () => {
		expect(nextStable(null, "minor")).toBe("0.1.0")
		expect(nextStable(null, "patch")).toBe("0.0.1")
	})

	it("bumps each part and resets the lower ones", () => {
		expect(nextStable("1.2.3", "patch")).toBe("1.2.4")
		expect(nextStable("1.2.3", "minor")).toBe("1.3.0")
		expect(nextStable("1.2.3", "major")).toBe("2.0.0")
	})

	it("keeps an inferred breaking change on 0.x as minor, but honours an explicit major", () => {
		expect(nextStable("0.4.1", "major")).toBe("0.5.0")
		expect(nextStable("0.4.1", "major", true)).toBe("1.0.0")
	})

	it("rejects a prerelease as the last release", () => {
		expect(() => nextStable("1.0.0-alpha.1", "patch")).toThrow()
	})
})

describe("nextAlpha", () => {
	it("starts at alpha.0", () => {
		expect(nextAlpha("0.2.0", [])).toBe("0.2.0-alpha.0")
		expect(nextAlpha("0.2.0", ["0.1.0", "0.1.1-alpha.4"])).toBe("0.2.0-alpha.0")
	})

	it("counts past the highest published alpha of the same base, numerically", () => {
		expect(nextAlpha("0.2.0", ["0.2.0-alpha.0", "0.2.0-alpha.9", "0.2.0-alpha.10"])).toBe(
			"0.2.0-alpha.11",
		)
	})

	it("does not confuse a longer base with the same prefix", () => {
		expect(nextAlpha("0.2.0", ["0.2.0-alpha.1.5", "0.2.0-alpha.x"])).toBe("0.2.0-alpha.0")
	})
})
