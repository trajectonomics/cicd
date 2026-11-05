import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")

/** Absolute path of a binary installed in this repo's node_modules. */
export function bin(name: string): string {
	return join(root, "node_modules/.bin", name)
}

/** Creates a project whose node_modules holds a copy of exactly the files this package publishes. */
export function makeConsumer(parent: string, files: Record<string, string>): string {
	const project = mkdtempSync(join(parent, "consumer-"))
	const installed = join(project, "node_modules/@trajectonomics/tooling")
	mkdirSync(installed, { recursive: true })
	const pkg: { files: string[] } = require(join(root, "package.json"))
	for (const entry of [...pkg.files, "package.json"]) {
		cpSync(join(root, entry), join(installed, entry), { recursive: true })
	}
	for (const [name, content] of Object.entries(files)) writeFileSync(join(project, name), content)
	return project
}

/** Runs a command in `cwd`, returning its exit code and combined output. */
export function run(cmd: string[], cwd: string): { code: number; output: string } {
	const done = Bun.spawnSync(cmd, { cwd })
	return { code: done.exitCode, output: done.stdout.toString() + done.stderr.toString() }
}
