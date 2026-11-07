import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const workflows = resolve(import.meta.dir, "../.github/workflows")

type Workflow = {
	on: {
		push?: object | null
		workflow_dispatch?: { inputs?: Record<string, unknown> } | null
		workflow_call?: object | null
	}
	permissions?: Record<string, string>
	jobs: Record<string, { uses?: string }>
}

function load(file: string): Workflow {
	return Bun.YAML.parse(readFileSync(join(workflows, file), "utf8")) as Workflow
}

describe("release.yml (the caller npm trusted publishing validates)", () => {
	const release = load("release.yml")

	it("can mint the npm OIDC token and write tags and releases", () => {
		expect(release.permissions).toMatchObject({ "id-token": "write", contents: "write" })
	})

	it("publishes an alpha on push and a stable on a manual run with a bump input", () => {
		expect(release.on.push).not.toBeNull()
		expect(release.on.workflow_dispatch?.inputs).toHaveProperty("bump")
	})

	it("delegates to the shared publish workflow instead of carrying publish steps", () => {
		const uses = Object.values(release.jobs).map((job) => job.uses)
		expect(uses).toEqual(["./.github/workflows/publish.yml"])
	})
})

describe("publish.yml (the shared workflow)", () => {
	const publish = load("publish.yml")

	it("is callable from other repos", () => {
		expect(publish.on).toHaveProperty("workflow_call")
	})

	it("asks for the same token permissions as its callers", () => {
		expect(publish.permissions).toMatchObject({ "id-token": "write", contents: "write" })
	})
})
