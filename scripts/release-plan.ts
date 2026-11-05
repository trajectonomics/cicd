/**
 * Decides what the shared publish workflow does for the event that started it.
 *
 *   push to main      -> alpha, version computed by scripts/version.ts
 *   release published -> stable, version is the release tag (vX.Y.Z)
 *
 *   bun scripts/release-plan.ts --event release --tag v1.2.3
 *     -> {"channel":"stable","distTag":"latest","version":"1.2.3"}
 */
import { parseArgs } from "node:util"

export type Plan = {
	readonly channel: "alpha" | "stable"
	readonly distTag: "alpha" | "latest"
	readonly version: string | null
}

const STABLE_TAG = /^v(\d+\.\d+\.\d+)$/

/** What to publish for a workflow event. Throws when the event or release tag is not publishable. */
export function planRelease(event: string, tag: string): Plan {
	if (event === "push") return { channel: "alpha", distTag: "alpha", version: null }
	if (event === "release") {
		const version = STABLE_TAG.exec(tag)?.[1]
		if (!version) throw new Error(`Release tag must look like v1.2.3, got "${tag}"`)
		return { channel: "stable", distTag: "latest", version }
	}
	throw new Error(`Publishing runs on push or release, not "${event}"`)
}

function main(): void {
	const { values } = parseArgs({
		args: Bun.argv.slice(2),
		options: { event: { type: "string" }, tag: { type: "string", default: "" } },
		strict: true,
	})
	console.log(JSON.stringify(planRelease(values.event ?? "", values.tag ?? "")))
}

if (import.meta.main) main()
