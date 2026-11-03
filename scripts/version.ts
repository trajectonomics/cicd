// Core release semver calculator
/**
 * Computes the version the Release workflow publishes. Nobody edits
 * package.json "version" by hand: stable versions come from git tags (vX.Y.Z),
 * the bump comes from conventional commit messages since the last tag, and
 * alphas count up from what is already on npm.
 *
 *   bun scripts/version.ts --channel alpha              -> 0.2.0-alpha.3
 *   bun scripts/version.ts --channel stable             -> 0.2.0
 *   bun scripts/version.ts --channel stable --bump major -> 1.0.0
 */
import { parseArgs } from "node:util"
import { $ } from "bun"

export type Bump = "major" | "minor" | "patch"
export type Channel = "alpha" | "stable"

const STABLE = /^(\d+)\.(\d+)\.(\d+)$/
const BREAKING_SUBJECT = /^\w+(\([^)]*\))?!:/
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE:/m
const FEAT = /^feat(\([^)]*\))?:/

/** Largest bump any of the commit messages asks for. Non-feat commits are a patch. */
export function bumpFromCommits(messages: readonly string[]): Bump {
	let bump: Bump = "patch"
	for (const message of messages) {
		if (BREAKING_SUBJECT.test(message) || BREAKING_FOOTER.test(message)) return "major"
		if (FEAT.test(message)) bump = "minor"
	}
	return bump
}

/**
 * Next stable version after `last` (null = never released). While on 0.x an
 * inferred breaking change bumps minor, per semver's 0.x convention; pass
 * `explicit` to take a major bump literally (e.g. to cut 1.0.0).
 */
export function nextStable(last: string | null, bump: Bump, explicit = false): string {
	const match = STABLE.exec(last ?? "0.0.0")
	if (!match) throw new Error(`Last release is not a stable semver version: ${last}`)
	const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])]
	const effective = bump === "major" && major === 0 && !explicit ? "minor" : bump
	switch (effective) {
		case "major":
			return `${major + 1}.0.0`
		case "minor":
			return `${major}.${minor + 1}.0`
		case "patch":
			return `${major}.${minor}.${patch + 1}`
	}
}

/** `<base>-alpha.<n>`, one past the highest alpha of `base` already published. */
export function nextAlpha(base: string, published: readonly string[]): string {
	const prefix = `${base}-alpha.`
	let next = 0
	for (const version of published) {
		if (!version.startsWith(prefix)) continue
		const n = Number(version.slice(prefix.length))
		if (Number.isInteger(n) && n >= next) next = n + 1
	}
	return `${prefix}${next}`
}

async function lastStableTag(): Promise<string | null> {
	const tags = (await $`git tag --list ${"v*"} --sort=-v:refname`.text()).split("\n")
	const tag = tags.find((t) => STABLE.test(t.slice(1)))
	return tag ?? null
}

async function commitsSince(tag: string | null): Promise<string[]> {
	const range = tag ? `${tag}..HEAD` : "HEAD"
	const log = await $`git log ${range} --format=%B%x00`.text()
	return log
		.split("\0")
		.map((m) => m.trim())
		.filter(Boolean)
}

async function publishedVersions(name: string): Promise<string[]> {
	const res = await $`npm view ${name} versions --json`.nothrow().quiet()
	if (res.exitCode !== 0) {
		if (res.stderr.toString().includes("E404")) return []
		throw new Error(`npm view ${name} failed:\n${res.stderr.toString()}`)
	}
	const parsed: unknown = JSON.parse(res.stdout.toString())
	return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)]
}

async function main(): Promise<void> {
	const { values } = parseArgs({
		args: Bun.argv.slice(2),
		options: {
			channel: { type: "string" },
			bump: { type: "string", default: "auto" },
		},
		strict: true,
	})
	const channel = values.channel
	if (channel !== "alpha" && channel !== "stable")
		throw new Error("--channel must be alpha or stable")
	const bumpArg = values.bump
	if (bumpArg !== "auto" && bumpArg !== "major" && bumpArg !== "minor" && bumpArg !== "patch") {
		throw new Error("--bump must be auto, major, minor or patch")
	}

	const last = await lastStableTag()
	const commits = await commitsSince(last)
	if (commits.length === 0) throw new Error(`Nothing to release: no commits since ${last}`)
	const bump = bumpArg === "auto" ? bumpFromCommits(commits) : bumpArg
	const base = nextStable(last?.slice(1) ?? null, bump, bumpArg !== "auto")
	if (channel === "stable") {
		console.log(base)
		return
	}
	const pkg: { name: string } = await Bun.file("package.json").json()
	console.log(nextAlpha(base, await publishedVersions(pkg.name)))
}

if (import.meta.main) await main()
