import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { bin, makeConsumer, run } from "./consumer"

const root = resolve(import.meta.dir, "..")
let dir = ""

beforeAll(() => {
	dir = mkdtempSync(join(tmpdir(), "tooling-presets-"))
})

afterAll(() => {
	rmSync(dir, { recursive: true, force: true })
})

function lint(config: string, source: string): { code: number; output: string } {
	const project = makeConsumer(dir, { "biome.json": config, "sample.ts": source })
	return run([bin("biome"), "lint", "."], project)
}

const deterministic = '{"root":true,"extends":["@trajectonomics/tooling/configs/deterministic"]}'
const base = '{"root":true,"extends":["@trajectonomics/tooling/configs/base"]}'
const web = '{"root":true,"extends":["@trajectonomics/tooling/configs/web"]}'

describe("deterministic preset", () => {
	it("rejects Math.random as a nondeterministic API", () => {
		const { code, output } = lint(deterministic, "export const n = Math.random()\n")
		expect(code).not.toBe(0)
		expect(output).toContain("Nondeterministic API")
	})

	it("rejects reading the wall clock through Date", () => {
		const { code, output } = lint(deterministic, "export const now = Date.now()\n")
		expect(code).not.toBe(0)
		expect(output).toContain("Nondeterministic API")
	})

	it("accepts code that takes its inputs as arguments", () => {
		const { code } = lint(deterministic, "export const add = (a: number, b: number) => a + b\n")
		expect(code).toBe(0)
	})
})

describe("base preset", () => {
	it("allows nondeterministic APIs", () => {
		expect(lint(base, "export const n = Math.random()\n").code).toBe(0)
	})

	it("rejects an unused import", () => {
		const { code, output } = lint(base, 'import { join } from "node:path"\n')
		expect(code).not.toBe(0)
		expect(output).toContain("noUnusedImports")
	})

	it("rejects a file exceeding 100 lines", () => {
		const longFile = Array.from({ length: 101 }, (_, i) => `export const v${i} = ${i}\n`).join("")
		const { code, output } = lint(base, longFile)
		expect(code).not.toBe(0)
		expect(output).toContain("noExcessiveLinesPerFile")
	})
})

describe("web preset", () => {
	it("allows files between 100 and 250 lines", () => {
		const mediumFile = Array.from({ length: 150 }, (_, i) => `export const v${i} = ${i}\n`).join("")
		expect(lint(web, mediumFile).code).toBe(0)
	})

	it("rejects a file exceeding 250 lines", () => {
		const longFile = Array.from({ length: 251 }, (_, i) => `export const v${i} = ${i}\n`).join("")
		const { code, output } = lint(web, longFile)
		expect(code).not.toBe(0)
		expect(output).toContain("noExcessiveLinesPerFile")
	})

	it("inherits unused import checks from base", () => {
		const { code, output } = lint(web, 'import { join } from "node:path"\n')
		expect(code).not.toBe(0)
		expect(output).toContain("noUnusedImports")
	})
})

describe("tsconfig preset", () => {
	it("is strict enough to reject unchecked index access", () => {
		const tsconfig =
			'{"extends":"@trajectonomics/tooling/tsconfig/base.json","include":["sample.ts"]}'
		const project = makeConsumer(dir, {
			"tsconfig.json": tsconfig,
			"sample.ts": "export const x: string = [''][0]\n",
		})
		const { code, output } = run([bin("tsc"), "-p", "tsconfig.json"], project)
		expect(code).not.toBe(0)
		expect(output).toContain("string | undefined")
	})

	it("rejects DOM types in base preset", () => {
		const tsconfig =
			'{"extends":"@trajectonomics/tooling/tsconfig/base.json","include":["sample.ts"]}'
		const project = makeConsumer(dir, {
			"tsconfig.json": tsconfig,
			"sample.ts": "export const title: string = document.title\n",
		})
		const { code, output } = run([bin("tsc"), "-p", "tsconfig.json"], project)
		expect(code).not.toBe(0)
		expect(output).toContain("Cannot find name 'document'")
	})

	it("provides DOM types in web preset while remaining strict", () => {
		const tsconfig =
			'{"extends":"@trajectonomics/tooling/tsconfig/web.json","include":["sample.ts"]}'
		const project = makeConsumer(dir, {
			"tsconfig.json": tsconfig,
			"sample.ts": "export const title: string = document.title\n",
		})
		const { code } = run([bin("tsc"), "-p", "tsconfig.json"], project)
		expect(code).toBe(0)

		const strictProject = makeConsumer(dir, {
			"tsconfig.json": tsconfig,
			"sample.ts": "export const x: string = [''][0]\n",
		})
		const { code: strictCode, output } = run([bin("tsc"), "-p", "tsconfig.json"], strictProject)
		expect(strictCode).not.toBe(0)
		expect(output).toContain("string | undefined")
	})
})

describe("package files", () => {
	it("exist for every entry in the published files list", async () => {
		const pkg: { files: string[] } = await Bun.file(join(root, "package.json")).json()
		for (const entry of pkg.files) expect(existsSync(join(root, entry))).toBe(true)
	})
})
