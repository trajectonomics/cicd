# Publishing runbook

How `release.yml` and the shared `publish.yml` behave, and what looks like a failure but is not.
The commands live in the README ("Releasing"); this file holds the surprises.

## Reading the result of a release

- **Trust the CI log.** The publish step prints `+ @trajectonomics/tooling@X.Y.Z` when npm accepted the
  version. `npm view` can answer `404 No match found for version X.Y.Z` for one to three minutes
  afterwards, and `dist-tags` moves to the new version last. Wait and look again before assuming a
  failed publish.
- **`0.0.0-stage` on the version list is normal** for a package whose first release went through
  npm's staged publishing. It is a placeholder, not a failed release.
- A stable run that stops after `+ pkg@X.Y.Z` (for example a GitHub 500 on `gh release create`) has
  already published. Re-run the failed job: publishing skips a version that is already on npm, and the
  release step skips a release that already exists.

## Trusted publishing

- npm validates the **calling** workflow's repository and filename, so a package's `release.yml` must
  keep that name. The shared `publish.yml` can change freely.
- A new Trusted Publisher entry must be proven by one successful CI publish within two days.
- The first version of a brand-new package is published by hand with `--provenance=false`; npm cannot
  attach a trusted publisher to a package that does not exist. Never commit the version bump.
- Both the caller and `publish.yml` need `id-token: write`. `test/workflows.test.ts` guards this.

## Biome preset packaging

- Plugin paths inside an extended config resolve relative to the **consumer's** root config, not the
  package. That is why presets are reached through `biome-manifest.json`.
- `package.json` `exports` cannot mix the `biome` condition with subpaths: keep it under `"."`.
- Biome rejects a symlinked package, so `test/consumer.ts` copies the published files into a temporary
  `node_modules` instead of linking.

## Waiting in an agent session

Foreground `sleep` is blocked. Run the wait as a background command and use `t3_background_wait` with
`taskIds` as an array.
