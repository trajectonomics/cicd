/**
 * Decides what a consumer's Biome setup says about the shared tooling.
 *
 * Pure: the pin, the config text and the published `latest` version go in,
 * findings come out. scripts/drift.ts does the reading and the reporting.
 */

/** One reason a consumer has drifted from the shared tooling. */
export type Finding =
	| { readonly kind: "pin-behind"; readonly pin: string; readonly latest: string }
	| { readonly kind: "pin-not-exact"; readonly pin: string | null }
	| { readonly kind: "preset-not-extended" }
	| { readonly kind: "local-rules"; readonly keys: readonly string[] }
	| { readonly kind: "config-unreadable"; readonly reason: string }

export type DriftInput = {
	/** The version spec the consumer pins, or null when the package is not a dependency. */
	readonly pin: string | null
	/** The text of the consumer's Biome config, or null when it has no config file. */
	readonly config: string | null
	/** The version the `latest` dist-tag points at. Never `alpha`. */
	readonly latest: string
}

/** Every preset this package publishes lives under this path, per package.json `exports`. */
const PRESET_PREFIX = "@trajectonomics/tooling/configs/"

/** A pin that names one version. `bun add -d --exact` writes exactly this. */
const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/

/** Top-level keys a consumer may keep. Everything else is a block of rules the preset owns. */
const ALLOWED_KEYS = new Set(["$schema", "root", "extends", "vcs", "files", "overrides", "css"])

/** Keys an `overrides` entry may not carry: they hold rules, so they fight the preset. */
const RULE_KEYS = ["linter", "formatter", "plugins"] as const

function ordinal(text: string | undefined): number {
	const value = Number(text)
	return Number.isFinite(value) ? value : 0
}

/** major, minor, patch, then 1 for a release and 0 for a prerelease leading to it. */
function rank(version: string): readonly [number, number, number, number] {
	const [core = "", pre] = version.split("-")
	const parts = core.split(".")
	return [ordinal(parts[0]), ordinal(parts[1]), ordinal(parts[2]), pre === undefined ? 1 : 0]
}

/** Semver precedence: a prerelease ranks below the release it leads to. */
function compareVersions(a: string, b: string): number {
	const [left, right] = [rank(a), rank(b)]
	for (const [index, value] of left.entries()) {
		const difference = value - (right[index] ?? 0)
		if (difference !== 0) return difference
	}
	return 0
}

/**
 * A range resolves whatever npm publishes, so it is never stale; it is reported
 * as not exact instead, because two installs can then disagree.
 */
function pinFindings(pin: string | null, latest: string): readonly Finding[] {
	if (pin === null || !EXACT.test(pin)) return [{ kind: "pin-not-exact", pin }]
	return compareVersions(pin, latest) < 0 ? [{ kind: "pin-behind", pin, latest }] : []
}

export function planDrift(input: DriftInput): readonly Finding[] {
	return [...pinFindings(input.pin, input.latest), ...configFindings(input.config)]
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function presetExtended(field: unknown): boolean {
	const entries = Array.isArray(field) ? field : [field]
	return entries.some((entry) => typeof entry === "string" && entry.startsWith(PRESET_PREFIX))
}

/** Top-level blocks plus the `overrides` entries that carry rules: both compete with the preset. */
function localRuleKeys(config: Record<string, unknown>): readonly string[] {
	const topLevel = Object.keys(config).filter((key) => !ALLOWED_KEYS.has(key))
	const overrides = Array.isArray(config["overrides"]) ? config["overrides"] : []
	const carried = overrides.flatMap((entry, index) =>
		isRecord(entry)
			? RULE_KEYS.filter((key) => key in entry).map((key) => `overrides[${index}].${key}`)
			: [],
	)
	return [...topLevel, ...carried]
}

function readConfig(parsed: unknown): readonly Finding[] {
	if (!isRecord(parsed)) {
		return [{ kind: "config-unreadable", reason: "the config is not a JSON object" }]
	}
	const findings: Finding[] = []
	if (!presetExtended(parsed["extends"])) findings.push({ kind: "preset-not-extended" })
	const keys = localRuleKeys(parsed)
	if (keys.length > 0) findings.push({ kind: "local-rules", keys })
	return findings
}

/** An unparsable file is a finding, not a thrown error: the report is the product. */
function configFindings(text: string | null): readonly Finding[] {
	if (text === null) return [{ kind: "config-unreadable", reason: "no Biome config found" }]
	try {
		return readConfig(Bun.JSONC.parse(text))
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error)
		return [{ kind: "config-unreadable", reason }]
	}
}
