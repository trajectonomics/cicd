import { expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const workflows = join(root, ".github/workflows")

export type Step = {
	name?: string
	uses?: string
	run?: string
	if?: string
	with?: Record<string, unknown>
}

export type Job = {
	uses?: string
	with?: Record<string, unknown>
	secrets?: string
	steps?: Step[]
}

export type Workflow = {
	on: {
		push?: { branches?: string[] } | null
		schedule?: { cron?: string }[]
		workflow_dispatch?: { inputs?: Record<string, unknown> } | null
		workflow_call?: { inputs?: Record<string, unknown> } | null
	}
	permissions?: Record<string, string>
	jobs: Record<string, Job>
}

export function loadWorkflow(file: string): Workflow {
	return Bun.YAML.parse(readFileSync(join(workflows, file), "utf8")) as Workflow
}

export function steps(workflow: Workflow): Step[] {
	return Object.values(workflow.jobs).flatMap((job) => job.steps ?? [])
}

/** Caller templates this repo publishes. README.md is what a consumer copies. */
export function documentedCallers(file: string): Workflow[] {
	const readme = readFileSync(join(root, "README.md"), "utf8")
	return [...readme.matchAll(/```yaml\n([\s\S]*?)```/g)]
		.map((match) => match[1] ?? "")
		.filter((yaml) => yaml.includes(`# .github/workflows/${file}`))
		.map((yaml) => Bun.YAML.parse(yaml) as Workflow)
}

/** A run step is one bun command; a second line or a shell operator belongs in scripts/. */
export function expectScriptSteps(workflow: Workflow): void {
	for (const step of steps(workflow)) {
		if (step.run === undefined) continue
		expect(step.run).toMatch(/^bun /)
		expect(step.run).not.toContain("\n")
		expect(step.run).not.toMatch(/&&|\|\||[;|<>]|\$\(/)
	}
}
