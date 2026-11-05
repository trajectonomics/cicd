# @trajectonomics/tooling

Shared Biome and TypeScript presets, a GritQL plugin, and reusable GitHub Actions workflows for Trajectonomics.

[![Check](https://github.com/trajectonomics/cicd/actions/workflows/check.yml/badge.svg)](https://github.com/trajectonomics/cicd/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

This package ships config files only: no JavaScript. Each consuming repo keeps its own pinned
`@biomejs/biome` (2.6 or later) and `typescript`.

## Install

```bash
bun add -d --exact @trajectonomics/tooling @biomejs/biome typescript
```

## Presets

| Preset | Use in | What it gives you |
| --- | --- | --- |
| `configs/base` | `biome.json` `extends` | Tabs, line width 100, 100 lines per file (200 in tests), complexity 10, import sorting, unused-code and `any` errors |
| `configs/deterministic` | `biome.json` `extends` | Everything in `base`, plus the no-nondeterminism rule |
| `tsconfig/base.json` | `tsconfig.json` `extends` | Strict ES2022 settings with `isolatedDeclarations` |

```jsonc
// biome.json
{ "root": true, "extends": ["@trajectonomics/tooling/configs/deterministic"] }
```

```jsonc
// tsconfig.json
{ "extends": "@trajectonomics/tooling/tsconfig/base.json", "include": ["src"] }
```

The no-nondeterminism rule rejects `Math.pow`, `exp`, `expm1`, `log`, `log1p`, `log2`, `log10`,
`random`, and any use of `Date`. Use it in pure-core packages; use `configs/base` elsewhere.

## Reusable workflows

```yaml
# .github/workflows/check.yml
on: [push, pull_request]
jobs:
  check:
    uses: trajectonomics/cicd/.github/workflows/check.yml@v1
```

```yaml
# .github/workflows/pr-title.yml
on:
  pull_request:
    types: [opened, edited, synchronize, reopened]
jobs:
  title:
    uses: trajectonomics/cicd/.github/workflows/pr-title.yml@v1
```

```yaml
# .github/workflows/release.yml  (keep this filename: npm trusted publishing validates it)
name: Release
on:
  push:
    branches: [main]
    paths-ignore: ["**/*.md", ".agents/**", ".claude/**", ".github/**"]
  workflow_dispatch:
    inputs:
      bump:
        type: choice
        options: [auto, patch, minor, major]
        default: auto
permissions:
  contents: write
  id-token: write
jobs:
  publish:
    uses: trajectonomics/cicd/.github/workflows/publish.yml@v1
    with:
      bump: ${{ inputs.bump || 'auto' }}
```

`check.yml` installs Bun, runs `bun install --frozen-lockfile`, then `bun run check`. It takes
optional `bun-version` and `script` inputs. `pr-title.yml` requires a conventional-commit PR title.
`publish.yml` is described under Releasing.

## Development

```bash
bun install
bun run check   # lint, typecheck, tests, publint
bun run format  # fix formatting and import order
```

The tests install a copy of the published files into a temporary project and run Biome and `tsc`
against it, so they exercise the same resolution path a consuming repo uses.

## Releasing

Every package uses the shared `publish.yml`, so releasing works the same everywhere:

| You do | Result |
| --- | --- |
| Merge to `main` (package files changed) | Publishes an **alpha**, e.g. `1.2.0-alpha.3`, dist-tag `alpha` |
| Run the **Release** workflow on `main` (Actions tab, Run workflow) | Publishes **stable**, dist-tag `latest`, then creates the tag `vX.Y.Z` and the GitHub release |

The workflow computes the version; `package.json` `version` is never edited by hand. `bump = auto`
reads the conventional-commit PR titles since the last stable tag (`feat:` minor, `feat!:` major,
anything else patch); choose `major` to cut `1.0.0`. The tag and GitHub release are created only
after npm accepts the version, so a failed publish leaves nothing behind. Run it from `main`;
any other branch fails before publishing.

From the command line: `gh workflow run release.yml --ref main -f bump=auto`.

In this repo a stable release also moves the floating `vX` tag that consumers pin to.

**New package, one time:** publish the first version by hand (`npm version 0.1.0-alpha.0
--no-git-tag-version`, then `npm publish --access public --tag alpha --provenance=false`, then
`git checkout package.json`). Then add a Trusted Publisher on npmjs.com: GitHub Actions, your
repository, workflow `release.yml`, **allow publish directly**, no environment. It must be validated by
one successful CI publish within two days.

## Documentation

- [GLOSSARY.md](./GLOSSARY.md): domain terms.
- [AGENTS.md](./AGENTS.md): rules for AI coding agents.
- [CODING_STANDARDS.md](./CODING_STANDARDS.md): review conventions.
- [docs/adr/](./docs/adr/): architecture decisions.

## License

[MIT](./LICENSE)
