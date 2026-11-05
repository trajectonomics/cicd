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

`check.yml` installs Bun, runs `bun install --frozen-lockfile`, then `bun run check`. It takes
optional `bun-version` and `script` inputs. `pr-title.yml` requires a conventional-commit PR title.

## Development

```bash
bun install
bun run check   # lint, typecheck, tests, publint
bun run format  # fix formatting and import order
```

The tests install a copy of the published files into a temporary project and run Biome and `tsc`
against it, so they exercise the same resolution path a consuming repo uses.

## Releasing

PR titles are conventional commits because they pick the next version (`feat:` minor, `feat!:`
major, anything else patch). Merges to `main` that change package files publish an alpha
(dist-tag `alpha`). Running the **Release** workflow by hand on `main` publishes a stable version
(dist-tag `latest`), creates the `vX.Y.Z` tag and GitHub release, and moves the floating `vX` tag
that consumers pin to. To cut `1.0.0`, run it with `bump` set to `major`.

## Documentation

- [GLOSSARY.md](./GLOSSARY.md): domain terms.
- [AGENTS.md](./AGENTS.md): rules for AI coding agents.
- [CODING_STANDARDS.md](./CODING_STANDARDS.md): review conventions.
- [docs/adr/](./docs/adr/): architecture decisions.

## License

[MIT](./LICENSE)
