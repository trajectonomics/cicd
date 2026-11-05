/**
 * Decides what the shared publish workflow does for the event that started it.
 *
 *   push to main      -> alpha,  version computed by scripts/version.ts
 *   manual dispatch   -> stable, version computed by scripts/version.ts
 *
 *   bun scripts/release-plan.ts --event workflow_dispatch
 *     -> {"channel":"stable","distTag":"latest"}
 */
import { parseArgs } from "node:util"

export type Plan = {
	readonly channel: "alpha" | "stable"
	readonly distTag: "alpha" | "latest"
}

/** What to publish for a workflow event. Throws when the event is not one that publishes. */
export function planRelease(event: string): Plan {
	if (event === "push") return { channel: "alpha", distTag: "alpha" }
	if (event === "workflow_dispatch") return { channel: "stable", distTag: "latest" }
	throw new Error(`Publishing runs on push or workflow_dispatch, not "${event}"`)
}

function main(): void {
	const { values } = parseArgs({
		args: Bun.argv.slice(2),
		options: { event: { type: "string" } },
		strict: true,
	})
	console.log(JSON.stringify(planRelease(values.event ?? "")))
}

if (import.meta.main) main()
