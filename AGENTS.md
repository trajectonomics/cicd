# AGENTS.md

Instructions for AI coding agents in `trajectonomics/cicd` (`@trajectonomics/tooling`).

## Rules

1. Never commit to `main`. Branch (`feat/*`, `fix/*`, `docs/*`) and open a PR. Before pushing to an existing PR branch, confirm `gh pr view --json state` is `OPEN`; after `git add`, read `git status --short` before committing.
2. Never commit secrets or `.env` files. `NPM_TOKEN` lives in repo secrets only.
3. Package design: Keep core packages pure and deterministic wherever applicable (data in, data out, no I/O, no clock, no unseeded randomness). Keep boundaries closed-world with explicit contracts.
4. Bun only: `bun install`, `bun test`, `bun run <script>`. Do not add npm/pnpm/yarn lockfiles.
5. Done means `bun run check` passes (Biome lint with zero warnings, strict typecheck, tests, publint). `bun run format` fixes formatting and import order. Do not loosen the presets in `biome/` or `tsconfig/` to make an error go away: they are the product.
6. Never edit `version` in `package.json` (a first-publish bump stays uncommitted) and never run `npm publish` locally, except the very first publish of a brand-new package, which the maintainer may run locally with `--provenance=false`. Merges to `main` publish alphas; a stable release is the manual Release workflow, which tags and creates the GitHub release itself. PR titles are conventional commits (`feat:`, `fix:`, `feat!:` ...) because they decide the next version (see README "Releasing"). A release that looks failed may not be: read `docs/runbooks/publishing.md` before diagnosing npm or release output.
7. Pi (`pi.dev`) model restriction: When running the Pi coding agent (`pi.dev`), strictly use **DeepSeek 4.1 Flash** only (e.g., `deepseek/deepseek-v4.1-flash`, `deepseek/deepseek-v4.1-flash-fast`), whether routed via Command Code GOAT (`command-code`) or OpenCode Go (`opencode`). Do not switch to or run any other models (Claude, GPT, Gemini, etc.) in Pi sessions for this repository. This rule is mechanically enforced via `.pi/settings.json`.


## Organisation goals

The organisation's goals are in https://github.com/trajectonomics/goals, `GOALS.md`. Read them before proposing a new direction. Only the owner edits that file; never edit it.

## Agent skills

### Skills included in this repo

- **Matt Pocock Skills (`mattpocock/skills`)**: Complete engineering workflow including `/ask-matt`, `/tdd`, `/implement`, `/code-review`, `/wayfinder`, `/diagnosing-bugs`, `/codebase-design`, `/grill-with-docs`, etc.
- **Trajectonomics Internal Skills (`trajectonomics/internal-skills`)**: Organization-specific workflow including `/pick-the-issue` to discover unblocked GitHub issues not currently handled by active T3 Code sessions and route them into the `ask-matt` framework.

### Reviewing a diff

`CODING_STANDARDS.md`: the conventions `bun run check` cannot enforce. Read it when reviewing, not when implementing.

### Issue tracker

GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Installing and updating skills

Skills come from [`mattpocock/skills`](https://github.com/mattpocock/skills) and [`trajectonomics/internal-skills`](https://github.com/trajectonomics/internal-skills) via the Vercel [`skills`](https://github.com/vercel-labs/skills) CLI and are pinned in `skills-lock.json`. The canonical copy is `.agents/skills/` (read natively by Codex, OpenCode, Pi, and Antigravity CLI); `.claude/skills/` holds symlinks into it for Claude Code. `.vibe/skills/` holds the same symlinks into `.agents/skills/` for Mistral Vibe, which discovers project skills there. Never edit them by hand.

- Update: `bun run skills:update` (or `npx skills update -p -y`)
- Check status: `bun run skills:check` (or `npx skills check`)
- Reinstall:
  ```bash
  npx skills add mattpocock/skills --skill '*' -a claude-code codex opencode antigravity-cli pi -y
  npx skills add trajectonomics/internal-skills -y
  ```
- Restore from the lock: `npx skills experimental_install`

## Repository Information

- Repository: https://github.com/trajectonomics/cicd
- Package: `@trajectonomics/tooling`

## Factory Runs

A Factory Run or Spec drafter (a thread titled `traj/trajectonomics/<repo>#<n>` or `triage/trajectonomics/<repo>#<n>`) takes its instructions from the Dispatcher runbook in `trajectonomics/factory`, never from this repository, where `docs/dispatcher-runbook.md` does not exist. Read it with `gh api repos/trajectonomics/factory/contents/docs/dispatcher-runbook.md -H "Accept: application/vnd.github.raw"`. If you cannot read it, stop and say so; do not build from the issue alone.
