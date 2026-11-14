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
| `configs/web` | `biome.json` `extends` | Everything in `base`, with 250 lines per file, Svelte domain rules, and accessibility (a11y) checks |
| `configs/deterministic` | `biome.json` `extends` | Everything in `base`, plus the no-nondeterminism rule |
| `tsconfig/base.json` | `tsconfig.json` `extends` | Strict ES2022 settings with `isolatedDeclarations` (no DOM) |
| `tsconfig/web.json` | `tsconfig.json` `extends` | Everything in `tsconfig/base.json`, plus DOM and DOM.Iterable library types |

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
        description: Version bump. auto reads commit messages since the last release.
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
    secrets: inherit
```

Every package keeps this file named `release.yml` and keeps it a thin caller; publishing steps belong
in `publish.yml`. The full caller contract is in `docs/runbooks/publishing.md`. A job that runs after
it reads `version`, `tag`, `channel` and `dist-tag` from `needs.publish.outputs`; a Consumer pinned to
today's `v1` tag gets those outputs when that tag next moves.

```yaml
# .github/workflows/docs-wiki.yml  (public repos only)
on:
  push:
    branches: [main]
    paths: ["README.md", "GLOSSARY.md", "docs/**"]
permissions:
  contents: write
jobs:
  wiki:
    uses: trajectonomics/cicd/.github/workflows/docs-wiki.yml@v1
```

`check.yml` installs Bun, runs `bun install --frozen-lockfile`, then `bun run check`. It takes
optional `bun-version`, `node-version` and `script` inputs. `node-version` is empty by default, and its
setup step is skipped unless the caller sets it. `pr-title.yml` requires a conventional-commit PR title.
`publish.yml` is described under Releasing.

`docs-wiki.yml` mirrors `README.md` (as the wiki Home), `GLOSSARY.md`, `docs/adr/` and
`docs/runbooks/` to the repo's GitHub wiki after a merge to `main`. The repo stays the only source of
truth: the wiki is a read-only copy that is overwritten on every run, so never edit it by hand. Only
public repos add it; private repos do not use this job. It skips quietly until the owner enables
Wikis and creates a first page. Wiki pages are flat, so relative links between docs may not resolve
there. The rule is decided in [#3](https://github.com/trajectonomics/cicd/issues/3).

A repository that wants the weekly drift report adds a caller of its own:

```yaml
# .github/workflows/drift.yml
name: Tooling drift
on:
  schedule:
    - cron: "0 6 * * 1" # Mondays
  workflow_dispatch:
permissions:
  contents: read
  issues: write
jobs:
  drift:
    uses: trajectonomics/cicd/.github/workflows/drift.yml@v1
```

The caller owns the weekly schedule: a reusable workflow's own `schedule` does not fire for the
repositories that call it. `workflow_dispatch` is there for a run by hand.

## Tooling drift

`drift.yml` compares a repository with the published `@trajectonomics/tooling` `latest` and opens,
updates or closes **one** issue titled `Tooling drift: ...`. It finds that issue by its open title
prefix, so no label has to be provisioned in the eight repositories that call it. It never compares
against the `alpha` dist-tag: that tag exists after every merge, so every repository would look
permanently stale.

| Finding | What it means | What to do |
| --- | --- | --- |
| pin behind | the exact pin predates `latest` | `bun add -d --exact @trajectonomics/tooling@<latest>` |
| pin not exact | the pin is a range, the package is not a dependency, or `package.json` could not be read | `bun add -d --exact @trajectonomics/tooling`, or fix the manifest |
| preset not extended | `biome.json` extends no `@trajectonomics/tooling/configs/*` preset | add one to `extends`, per Presets above |
| local rules | `biome.json` keeps a top-level block, or an `overrides` entry carrying `linter`, `formatter` or `plugins` | delete it; a rule that is wrong for every Consumer belongs in the preset |
| config unreadable | the file is missing, is not a JSON object, or does not parse | fix the file |

A Consumer may keep `$schema`, `root`, `extends`, `vcs`, `files`, `overrides` and `css` at the top
level, and an `overrides` entry may scope `includes` and `files`. Everything else competes with the
preset. A range pin is reported as not exact rather than as behind: it resolves whatever npm
publishes, so two installs can disagree, which is the problem worth an issue.

The issue is the report. A `package.json` or Biome config that cannot be read opens or updates the
issue and the run stays green, so a broken file never reads as a broken repository. The run goes red
only when the registry or `gh` itself fails.

GitHub disables a scheduled workflow in a repository with no activity for **60 days**, and the drift
check then quietly stops reporting. GitHub's email is the only warning, and a disabled workflow cannot
be dispatched: enable it again in the Actions tab, or with `gh workflow enable drift.yml`.

## Guarding `main` without branch protection

GitHub branch protection is unavailable on a private repository on the free plan (HTTP 403), and the
agents on Pi and Antigravity are not covered by Claude Code hooks. Rule 1 of `AGENTS.md` ("Never
commit to `main`") then rests on two layers that do work there. They are an **accident guard** and an
**after-the-fact alarm**, not a substitute for branch protection: only protection, a public
repository or a paid plan prevents a push to `main`. Never count the guard as the protected-`main`
control of infra ADR 0005.

### The direct-commit guard

Three tracked POSIX shell hooks in `.githooks/`, one file each, refuse:

| Hook | Refuses |
| --- | --- |
| `pre-commit` | a commit while `main` or `master` is checked out |
| `pre-merge-commit` | the merge commit a merge into `main` or `master` would create |
| `pre-push` | every push that updates `refs/heads/main` or `refs/heads/master`, including `git push origin HEAD:main` from a feature branch, a deletion, and a multi-ref push where one ref is `main` |

Activate it once per clone:

```bash
git config core.hooksPath .githooks
```

The setting lives in the clone's shared `.git/config`, so every worktree of that clone is covered,
including every Factory thread's (factory ADR 0008). A relative path resolves from the root of each
worktree, so `.githooks/` has to be committed in the repository. The hooks need no Node, no Bun and no
Husky, and they fire for every agent that calls `git`, whatever model or CLI it is. A repository that
already uses Husky must pick one: `core.hooksPath` replaces `.git/hooks`. A detached HEAD is allowed,
because a rebase commits there, and so are `feat/*`, `fix/*`, `docs/*` and `factory/*`. Pushing a tag
passes.

What it cannot stop: `--no-verify`, a clone where the hook path was never set, and any change made
through the GitHub web UI or API. The direct-push check reports all of them after the push.

### The direct-push check

`direct-push-check.yml` is a Reusable Workflow that runs after a push to `main`. For every commit in
the push it asks GitHub which pull request contains it, and a commit with no pull request **merged**
into `main` is an offender: the job fails and opens one `ready-for-human` issue naming the commit, its
author and the fix (revert it on a `fix/*` branch and open a PR). The issue is found again by its
title among all issues, open or closed, so a re-run opens no second one. At most five issues are opened
per push; the rest are named in the job log, and the job fails for every offender. A squash or rebase
merge has an associated pull request and passes, and the root commit is exempt.

Add this caller, and keep it named `direct-push-check.yml`:

```yaml
# .github/workflows/direct-push-check.yml
name: Direct push check
on:
  push:
    branches: [main]
permissions:
  contents: read      # read the pushed commits
  pull-requests: read # find the pull request that merged each commit
  issues: write       # open the alarm issue and its label
jobs:
  direct-push-check:
    uses: trajectonomics/cicd/.github/workflows/direct-push-check.yml@v1
```

The caller's permissions cap the called workflow's, so grant all three. The Reusable Workflow takes an
optional `bun-version`. It has no `concurrency` group on purpose: a group keeps one pending run and
drops the rest, so a dropped run could skip a commit; one issue per commit makes concurrent runs safe.
GitHub's commit-to-pull-request association lags a few seconds behind a merge, so an empty answer is
retried before a commit is called an offender.

Two blind spots, both announced as a warning annotation in the job and neither silent: a new branch or
a force push (the `before` commit no longer exists) and a compare of more than 250 commits inspect only
the final commit, so history rewritten before it is not seen. The check runs after the push, so a red
`main` does not stop an alpha publish.

### Checklist: a private repository without branch protection

A private repository without branch protection meets this standard when all of these hold:

- [ ] `.githooks/pre-commit`, `.githooks/pre-merge-commit` and `.githooks/pre-push` are tracked and
  executable, and the clone has run `git config core.hooksPath .githooks`.
- [ ] `.github/workflows/direct-push-check.yml` calls
  `trajectonomics/cicd/.github/workflows/direct-push-check.yml@v1` with `contents: read`,
  `pull-requests: read` and `issues: write`.
- [ ] Branch protection is still pending, so both layers remain the only guard.

A public repository ships the same hook, even with branch protection on: the accidental commit fails
before the network round trip.

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
