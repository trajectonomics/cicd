/**
 * Asks for the pull requests that contain each pushed commit, retrying an empty answer.
 *
 * GitHub's commit-to-pull-request association lags a few seconds behind a squash merge,
 * so an empty answer is not proof of a direct push. The lookup and the wait are
 * injected: scripts/direct-push.ts supplies `gh` and Bun's sleep, a test its own.
 */
import type { AssociatedPullRequest } from "./direct-push-plan"

export type PullLookup = (sha: string) => Promise<readonly AssociatedPullRequest[]>

/** Total attempts per commit, the first one included. */
export const ATTEMPTS = 3

/** Wait between attempts; the association needs seconds, not minutes. */
export const RETRY_MS = 2_000

async function lookupWithRetries(
	sha: string,
	lookup: PullLookup,
	wait: (ms: number) => Promise<void>,
): Promise<readonly AssociatedPullRequest[]> {
	for (let attempt = 1; attempt < ATTEMPTS; attempt += 1) {
		const pulls = await lookup(sha)
		if (pulls.length > 0) return pulls
		await wait(RETRY_MS)
	}
	return lookup(sha)
}

export async function associationsFor(
	shas: readonly string[],
	lookup: PullLookup,
	wait: (ms: number) => Promise<void>,
): Promise<Record<string, readonly AssociatedPullRequest[]>> {
	const associations: Record<string, readonly AssociatedPullRequest[]> = {}
	for (const sha of shas) associations[sha] = await lookupWithRetries(sha, lookup, wait)
	return associations
}
