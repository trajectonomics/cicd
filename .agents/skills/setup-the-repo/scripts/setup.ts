/**
 * Interactive repository bootstrapper for Trajectonomics Lab templates.
 * Customizes package coordinates, README, GLOSSARY, AGENTS.md, CODING_STANDARDS,
 * workflows, and initial starter code, verifies build with `bun run check`,
 * self-destructs this setup skill, and reminds the user to run /setup-matt-pocock-skills.
 */
import { existsSync, rmSync, writeFileSync, readFileSync } from "node:fs"
import { resolve, join } from "node:path"
import * as readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { parseArgs } from "node:util"
import { $ } from "bun"

interface SetupAnswers {
	repoName: string
	packageName: string
	description: string
	archetype: "core" | "cli" | "service" | "minimal"
	domainTerms: Array<{ term: string; definition: string }>
	enablePublish: boolean
}

function isValidPackageName(name: string): boolean {
	return /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)
}

async function getRootDir(): Promise<string> {
	try {
		const out = await $`git rev-parse --show-toplevel`.quiet().text()
		if (out.trim()) return out.trim()
	} catch {
		// Fallback to process.cwd()
	}
	return process.cwd()
}

async function getGitRemoteUrl(): Promise<string> {
	try {
		const out = await $`git remote get-url origin`.quiet().text()
		return out.trim()
	} catch {
		return ""
	}
}

async function inferDefaultRepoName(): Promise<string> {
	const remote = await getGitRemoteUrl()
	if (remote) {
		const match = remote.match(/[:/]([^/:]+\/[^/:]+?)(?:\.git)?$/)
		if (match && match[1]) {
			const candidate = match[1].replace(/\.git$/, "")
			if (!candidate.endsWith("technical-template")) {
				return candidate
			}
		}
	}
	const cwd = process.cwd()
	const dirName = cwd.split("/").pop() || "my-repo"
	return `trajectonomics-lab/${dirName}`
}

async function promptUser(rl: readline.Interface, question: string, defaultVal: string): Promise<string> {
	const answer = await rl.question(`${question} [${defaultVal}]: `)
	return answer.trim() || defaultVal
}

async function collectAnswersInteractive(): Promise<SetupAnswers> {
	const rl = readline.createInterface({ input, output })

	console.log("\n🚀 Welcome to Trajectonomics Lab Repository Setup!")
	console.log("This wizard will customize your repository and set up all tools.\n")

	const defaultRepo = await inferDefaultRepoName()
	const repoName = await promptUser(rl, "1. GitHub Repository Name (org/repo)", defaultRepo)

	const defaultPkgName = `@trajectonomics/${repoName.split("/").pop() || "project"}`
	let packageName = await promptUser(rl, "2. Package Name (for package.json)", defaultPkgName)
	while (!isValidPackageName(packageName)) {
		console.log("   ⚠️  Invalid npm package name format (must be lowercase alphanumeric/hyphens).")
		packageName = await promptUser(rl, "   Enter valid package name", defaultPkgName)
	}

	const description = await promptUser(
		rl,
		"3. Short Description",
		"High-performance TypeScript component for Trajectonomics Lab",
	)

	console.log("\n4. Select Project Archetype:")
	console.log("   [1] Pure Domain Library (deterministic, no I/O, strict types, tsdown dual ESM/CJS)")
	console.log("   [2] CLI Application (executable bin, tsdown build, CLI entrypoint)")
	console.log("   [3] Backend Service / Worker (API daemon, private package)")
	console.log("   [4] Minimal TypeScript Library")
	const archetypeChoice = await promptUser(rl, "   Choose archetype (1-4)", "1")

	let archetype: SetupAnswers["archetype"] = "core"
	if (archetypeChoice === "2") archetype = "cli"
	else if (archetypeChoice === "3") archetype = "service"
	else if (archetypeChoice === "4") archetype = "minimal"

	console.log("\n5. Initial Domain Glossary Terms (for GLOSSARY.md)")
	const term1 = await promptUser(rl, "   First key domain term", "Entity")
	const def1 = await promptUser(rl, `   Definition for '${term1}'`, "Primary domain model with identity.")

	const term2 = await promptUser(rl, "   Second key domain term (or press enter to skip)", "")
	const def2 = term2 ? await promptUser(rl, `   Definition for '${term2}'`, "") : ""

	const domainTerms: Array<{ term: string; definition: string }> = [{ term: term1, definition: def1 }]
	if (term2 && def2) domainTerms.push({ term: term2, definition: def2 })

	const defaultPublish = archetype === "core" ? "y" : "n"
	const pubChoice = await promptUser(rl, `\n6. Enable npm automated publishing in CI? (y/n)`, defaultPublish)
	const enablePublish = pubChoice.toLowerCase().startsWith("y")

	rl.close()

	return {
		repoName,
		packageName,
		description,
		archetype,
		domainTerms,
		enablePublish,
	}
}

function generateStarterCode(archetype: SetupAnswers["archetype"], packageName: string): { src: string; test: string } {
	if (archetype === "core") {
		const src = `/**
 * Pure domain model for ${packageName}.
 * Invariant: All domain objects are frozen, deterministic, and free of I/O.
 */

export enum DomainErrorCode {
	INVALID_ID = "INVALID_ID",
	INVALID_STATE = "INVALID_STATE",
}

export class DomainError extends Error {
	readonly code: DomainErrorCode

	constructor(code: DomainErrorCode, message: string) {
		super(\`[\${code}]: \${message}\`)
		this.name = "DomainError"
		this.code = code
	}
}

export interface EntityProps {
	readonly id: string
	readonly label: string
}

export interface Entity {
	readonly id: string
	readonly label: string
}

export function createEntity(props: EntityProps): Entity {
	if (!props.id || props.id.trim().length === 0) {
		throw new DomainError(DomainErrorCode.INVALID_ID, "Entity ID must be non-empty.")
	}
	return Object.freeze({
		id: props.id.trim(),
		label: props.label.trim(),
	})
}
`
		const test = `import { describe, expect, it } from "bun:test"
import { createEntity, DomainError, DomainErrorCode } from "./index"

describe("createEntity", () => {
	it("creates a frozen entity with valid properties", () => {
		const entity = createEntity({ id: "ent-1", label: "Example" })
		expect(entity.id).toBe("ent-1")
		expect(entity.label).toBe("Example")
		expect(Object.isFrozen(entity)).toBe(true)
	})

	it("rejects an entity with empty id", () => {
		expect(() => createEntity({ id: "", label: "Test" })).toThrow(DomainError)
		try {
			createEntity({ id: "   ", label: "Test" })
		} catch (err) {
			expect(err).toBeInstanceOf(DomainError)
			expect((err as DomainError).code).toBe(DomainErrorCode.INVALID_ID)
		}
	})
})
`
		return { src, test }
	}

	if (archetype === "cli") {
		const binName = packageName.split("/").pop() || "cli"
		const src = `#!/usr/bin/env node
/**
 * CLI entrypoint for ${packageName}.
 */

export interface ParsedCliArgs {
	readonly help: boolean
	readonly version: boolean
	readonly command: string | undefined
}

export function parseCliArgs(argv: readonly string[]): ParsedCliArgs {
	const help = argv.includes("--help") || argv.includes("-h")
	const version = argv.includes("--version") || argv.includes("-v")
	const command = argv.find((arg) => !arg.startsWith("-"))
	return Object.freeze({ help, version, command })
}

export function runCli(argv: readonly string[]): number {
	const args = parseCliArgs(argv)
	if (args.version) {
		console.log("0.0.0-development")
		return 0
	}
	if (args.help || !args.command) {
		console.log("Usage: ${binName} [command] [options]")
		console.log("\\nCommands:\\n  run            Execute command\\n\\nOptions:\\n  -h, --help     Show help\\n  -v, --version  Show version")
		return 0
	}
	console.log(\`Executed: \${args.command}\`)
	return 0
}

if (import.meta.main) {
	const exitCode = runCli(process.argv.slice(2))
	process.exit(exitCode)
}
`
		const test = `import { describe, expect, it } from "bun:test"
import { parseCliArgs, runCli } from "./index"

describe("CLI Parser", () => {
	it("parses --help and -h flags", () => {
		expect(parseCliArgs(["--help"]).help).toBe(true)
		expect(parseCliArgs(["-h"]).help).toBe(true)
	})

	it("parses --version and -v flags", () => {
		expect(parseCliArgs(["--version"]).version).toBe(true)
		expect(parseCliArgs(["-v"]).version).toBe(true)
	})

	it("executes CLI with 0 exit code", () => {
		expect(runCli(["--version"])).toBe(0)
		expect(runCli(["--help"])).toBe(0)
	})
})
`
		return { src, test }
	}

	if (archetype === "service") {
		const src = `/**
 * Service handler for ${packageName}.
 */

export interface HealthStatus {
	readonly status: "ok" | "degraded"
	readonly service: string
	readonly uptimeSeconds: number
}

export function getHealthStatus(serviceName: string, startTime: number): HealthStatus {
	return Object.freeze({
		status: "ok",
		service: serviceName,
		uptimeSeconds: Math.max(0, Math.floor((Date.now() - startTime) / 1000)),
	})
}

export function handleRequest(urlPath: string, serviceName: string, startTime: number): Response {
	if (urlPath === "/health" || urlPath === "/healthz") {
		const body = JSON.stringify(getHealthStatus(serviceName, startTime))
		return new Response(body, {
			status: 200,
			headers: { "content-type": "application/json" },
		})
	}
	return new Response("Not Found", { status: 404 })
}
`
		const test = `import { describe, expect, it } from "bun:test"
import { type HealthStatus, getHealthStatus, handleRequest } from "./index"

describe("Service Handler", () => {
	it("returns operational health status", () => {
		const health = getHealthStatus("test-service", Date.now())
		expect(health.status).toBe("ok")
		expect(health.service).toBe("test-service")
	})

	it("handles /health route with 200 JSON", async () => {
		const res = handleRequest("/health", "test-service", Date.now())
		expect(res.status).toBe(200)
		const body = (await res.json()) as HealthStatus
		expect(body.service).toBe("test-service")
	})

	it("returns 404 for unknown route", () => {
		const res = handleRequest("/unknown", "test-service", Date.now())
		expect(res.status).toBe(404)
	})
})
`
		return { src, test }
	}

	// Minimal archetype
	const src = `/**
 * Minimal module for ${packageName}.
 */

export function greeting(name: string = "World"): string {
	return \`Hello, \${name.trim()}!\`
}
`
	const test = `import { describe, expect, it } from "bun:test"
import { greeting } from "./index"

describe("greeting", () => {
	it("returns formatted greeting", () => {
		expect(greeting("Trajectonomics")).toBe("Hello, Trajectonomics!")
		expect(greeting()).toBe("Hello, World!")
	})
})
`
	return { src, test }
}

export async function runSetup(answers: SetupAnswers, rootDir: string): Promise<void> {
	console.log("\n⚙️  Applying project customizations...")

	// 1. Update package.json
	const pkgPath = join(rootDir, "package.json")
	const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
	pkg.name = answers.packageName
	pkg.description = answers.description
	pkg.repository = {
		type: "git",
		url: `git+https://github.com/${answers.repoName}.git`,
	}

	if (answers.archetype === "cli") {
		const binName = answers.packageName.split("/").pop() || "cli"
		pkg.bin = { [binName]: "./dist/index.cjs" }
		pkg.scripts.build = "tsdown"
		pkg.scripts.dev = "bun run src/index.ts"
	}

	if (answers.archetype === "service") {
		pkg.private = true
	}

	if (!answers.enablePublish) {
		delete pkg.publishConfig
		if (answers.archetype !== "core") {
			pkg.private = true
		}
	}

	// Remove setup script from package.json if present
	if (pkg.scripts && pkg.scripts.setup) {
		delete pkg.scripts.setup
	}

	writeFileSync(pkgPath, JSON.stringify(pkg, null, "\t") + "\n")
	console.log("   ✓ Updated package.json")

	// 2. Adjust tsconfig.json types for runtime-enabled archetypes
	if (answers.archetype === "cli" || answers.archetype === "service") {
		const tsconfigPath = join(rootDir, "tsconfig.json")
		if (existsSync(tsconfigPath)) {
			const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"))
			tsconfig.compilerOptions.types = ["bun"]
			writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, "\t") + "\n")
			console.log("   ✓ Configured tsconfig.json types for runtime archetype")
		}
	}

	// 3. Update README.md
	const isCli = answers.archetype === "cli"
	const isService = answers.archetype === "service"

	const installSection = isService
		? `## Installation & Deployment\n\n\`\`\`bash\nbun install\nbun run build\n\`\`\``
		: isCli
			? `## Installation\n\n\`\`\`bash\nbun add -g ${answers.packageName}\n# Or run directly via bunx:\nbunx ${answers.packageName}\n\`\`\``
			: `## Installation\n\n\`\`\`bash\nbun add ${answers.packageName}\n\`\`\``

	const usageSection = isCli
		? `## CLI Usage\n\n\`\`\`bash\n${answers.packageName.split("/").pop()} --help\n\`\`\``
		: `## Getting Started\n\n\`\`\`typescript\nimport { createEntity } from "${answers.packageName}"\n\nconst entity = createEntity({ id: "1", label: "Example" })\nconsole.log(entity)\n\`\`\``

	const readmeContent = `# ${answers.packageName}

${answers.description}

[![CI](https://github.com/${answers.repoName}/actions/workflows/ci.yml/badge.svg)](https://github.com/${answers.repoName}/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Part of the [Trajectonomics Lab](https://github.com/trajectonomics-lab) ecosystem.

---

${installSection}

${usageSection}

---

## Development

\`\`\`bash
# Install dependencies
bun install

# Run full verification suite (lint, typecheck, tests, build)
bun run check

# Run tests
bun test

# Code formatting & lint
bun run format
bun run lint
\`\`\`

---

## Domain Documentation

- [GLOSSARY.md](./GLOSSARY.md): Ubiquitous domain terminology.
- [AGENTS.md](./AGENTS.md): Guidelines and rules for autonomous AI coding agents.
- [CODING_STANDARDS.md](./CODING_STANDARDS.md): Architecture, purity, and review invariants.
- [docs/adr/](./docs/adr/): Architecture Decision Records.

---

## License

[MIT](./LICENSE)
`
	writeFileSync(join(rootDir, "README.md"), readmeContent)
	console.log("   ✓ Generated README.md")

	// 4. Update GLOSSARY.md
	let glossaryContent = `# Domain Glossary: ${answers.packageName}

Ubiquitous language for \`${answers.repoName}\`. Every term defined here is binding across code, tests, documentation, and PR titles. Synonyms in a diff are defects.

## Core Terms

`
	for (const { term, definition } of answers.domainTerms) {
		glossaryContent += `### ${term}\n${definition}\n\n`
	}
	glossaryContent += `### Invariant
A rule or condition that must hold true across all state transitions in this system.
`
	writeFileSync(join(rootDir, "GLOSSARY.md"), glossaryContent)
	console.log("   ✓ Generated GLOSSARY.md")

	// 5. Update AGENTS.md
	const agentsPath = join(rootDir, "AGENTS.md")
	if (existsSync(agentsPath)) {
		let agentsContent = readFileSync(agentsPath, "utf-8")
		agentsContent = agentsContent.replace(
			/Instructions for AI coding agents working in `[^`]*` repositories instantiated from this template\./,
			`Instructions for AI coding agents in \`${answers.repoName}\` (\`${answers.packageName}\`).`,
		)
		agentsContent = agentsContent.replace(
			/## Checklist When Instantiating a New Repo[\s\S]*$/,
			`## Repository Information\n\n- Repository: https://github.com/${answers.repoName}\n- Package: \`${answers.packageName}\`\n`,
		)
		writeFileSync(agentsPath, agentsContent)
		console.log("   ✓ Updated AGENTS.md")
	}

	// 6. Update docs/adr/0001-...
	const adrPath = join(rootDir, "docs/adr/0001-core-architecture-decisions.md")
	const oldAdr = join(rootDir, "docs/adr/0001-template-architecture-decisions.md")
	if (existsSync(oldAdr)) {
		rmSync(oldAdr, { force: true })
	}
	const adrContent = `# ADR 0001: Architecture Foundations for ${answers.packageName}

## Status

Accepted

## Context

\`${answers.repoName}\` is established to provide ${answers.description}.
It is built with Bun, TypeScript, and Biome under the Trajectonomics Lab architectural guidelines.

## Decision

1. **Archetype**: Configured as \`${answers.archetype}\`.
2. **Language & Runtime**: TypeScript (strict mode with \`isolatedDeclarations\`) executed on Bun.
3. **Domain Integrity**: All domain concepts adhere to [GLOSSARY.md](../../GLOSSARY.md).
4. **Agent Collaboration**: AI agents adhere to [AGENTS.md](../../AGENTS.md) and [CODING_STANDARDS.md](../../CODING_STANDARDS.md).

## Consequences

- Invariants remain verifiable through deterministic tests (\`bun test\`) and \`bun run check\`.
- All autonomous agent work is test-first and reviewed against established coding standards.
`
	writeFileSync(adrPath, adrContent)
	console.log("   ✓ Recorded ADR 0001")

	// 7. Update src/index.ts and src/index.test.ts with tailored archetype code
	const { src: srcIndex, test: srcTest } = generateStarterCode(answers.archetype, answers.packageName)
	writeFileSync(join(rootDir, "src/index.ts"), srcIndex)
	writeFileSync(join(rootDir, "src/index.test.ts"), srcTest)
	console.log("   ✓ Generated archetype-tailored starter code and tests in src/")

	// 8. Adjust Release CI if publishing is disabled
	if (!answers.enablePublish) {
		const relWorkflow = join(rootDir, ".github/workflows/release.yml")
		if (existsSync(relWorkflow)) {
			rmSync(relWorkflow, { force: true })
			console.log("   ✓ Removed release.yml (npm publishing disabled for this archetype)")
		}
	}

	// 9. Ensure dependencies are installed
	if (!existsSync(join(rootDir, "node_modules"))) {
		console.log("\n📦 Installing dependencies (`bun install`)...")
		await $`bun install`.cwd(rootDir)
	}

	// 10. Format files with Biome before verification
	await $`bun run format`.cwd(rootDir).quiet()

	// 11. Run verification check
	console.log("\n🧪 Running verification suite (`bun run check`)...")
	const checkResult = await $`bun run check`.cwd(rootDir).nothrow()
	if (checkResult.exitCode !== 0) {
		console.error("\n❌ Verification check failed!")
		console.error(checkResult.stdout.toString())
		console.error(checkResult.stderr.toString())
		console.error("\n⚠️  Self-destruction ABORTED so you can inspect and fix errors.")
		console.error("   Once resolved, re-run `bun run setup` or `bun run check`.")
		process.exit(1)
	}
	console.log("   ✓ Full verification suite passed with 0 errors!")

	// 12. Self-destruction: Remove this setup skill
	console.log("\n🧹 Cleaning up: Removing setup-the-repo bootstrap skill...")
	const skillDir = join(rootDir, ".agents/skills/setup-the-repo")
	const claudeSymlink = join(rootDir, ".claude/skills/setup-the-repo")

	if (existsSync(claudeSymlink)) {
		rmSync(claudeSymlink, { force: true })
		console.log("   ✓ Removed .claude/skills/setup-the-repo symlink")
	}
	if (existsSync(skillDir)) {
		rmSync(skillDir, { recursive: true, force: true })
		console.log("   ✓ Removed .agents/skills/setup-the-repo directory")
	}

	// 13. Optionally create a git commit if inside a git repository
	try {
		await $`git -C ${rootDir} add .`.quiet()
		await $`git -C ${rootDir} commit -m "chore: bootstrap project from template and remove setup-the-repo skill"`.quiet()
		console.log("   ✓ Created bootstrap commit in git")
	} catch {
		// Not in git or no changes to commit
	}

	// 14. Display Matt Pocock skills setup prompt
	console.log("\n" + "=".repeat(78))
	console.log("🎉 REPOSITORY SETUP COMPLETE!")
	console.log("=".repeat(78))
	console.log(`
Your repository '${answers.repoName}' (${answers.packageName}) is now fully
configured, built, and verified.

The single-use bootstrap skill 'setup-the-repo' has removed itself.

👉 IMPORTANT NEXT STEP:
   Set up Matt Pocock's skills and issue tracker workflow for this repo:

   Run the skill:
   /setup-matt-pocock-skills

   This will:
   1. Connect your issue tracker (GitHub Issues with the \`gh\` CLI).
   2. Configure canonical triage labels (needs-triage, ready-for-agent, etc.).
   3. Establish domain document rules for autonomous agents.

After that, you're ready to pick or create your first issue with /to-tickets
or /pick-the-issue!
`)
	console.log("=".repeat(78) + "\n")
}

async function main(): Promise<void> {
	const rootDir = await getRootDir()
	const remoteUrl = await getGitRemoteUrl()

	const { values } = parseArgs({
		args: Bun.argv.slice(2),
		options: {
			name: { type: "string" },
			pkg: { type: "string" },
			description: { type: "string" },
			archetype: { type: "string" },
			publish: { type: "string" },
			force: { type: "boolean", default: false },
			"non-interactive": { type: "boolean", default: false },
		},
		strict: false,
	})

	// Guard against running accidentally inside the template repository itself
	if (remoteUrl.includes("trajectonomics-lab/technical-template") && !values.force) {
		console.error("🛑 Refusing to run bootstrap setup on the template source repository itself!")
		console.error("   To test setup, clone or instantiate a new repository from this template.")
		console.error("   (Or pass --force if you specifically intend to overwrite the template repository.)")
		process.exit(1)
	}

	const isInteractive = !values["non-interactive"] && process.stdin.isTTY

	let answers: SetupAnswers
	if (!isInteractive || values.name) {
		const repoName = (values.name as string) || (await inferDefaultRepoName())
		const packageName = (values.pkg as string) || `@trajectonomics/${repoName.split("/").pop()}`
		const description = (values.description as string) || "TypeScript module for Trajectonomics Lab"
		const rawArch = (values.archetype as string) || "core"
		const archetype = (["core", "cli", "service", "minimal"].includes(rawArch)
			? rawArch
			: "core") as SetupAnswers["archetype"]
		const enablePublish = values.publish
			? values.publish === "true" || values.publish === "y"
			: archetype === "core"

		answers = {
			repoName,
			packageName,
			description,
			archetype,
			domainTerms: [{ term: "Entity", definition: "Core domain model with unique identity." }],
			enablePublish,
		}
	} else {
		answers = await collectAnswersInteractive()
	}

	await runSetup(answers, rootDir)
}

if (import.meta.main) {
	await main()
}
