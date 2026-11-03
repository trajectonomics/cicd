# AGENTS.md

Instructions for AI coding agents working in `trajectonomics-lab` repositories instantiated from this template.

## Rules

1. Never commit to `main`. Branch (`feat/*`, `fix/*`, `docs/*`) and open a PR.
2. Never commit secrets or `.env` files. `NPM_TOKEN` lives in repo secrets only.
3. Package design: Keep core packages pure and deterministic wherever applicable (data in, data out, no I/O, no clock, no unseeded randomness). Keep boundaries closed-world with explicit contracts.
4. Bun only: `bun install`, `bun test`, `bun run <script>`. Do not add npm/pnpm/yarn lockfiles.
5. Done means `bun run check` passes (Biome lint with zero warnings, strict typecheck, tests, build, publint + are-the-types-wrong). `bun run format` fixes formatting and import order. Do not loosen `tsconfig.base.json` or `biome.json` to make an error go away.
6. Never edit `version` in `package.json` and never run `npm publish` locally. Merges to `main` publish alphas; a stable release is the manual Release workflow. PR titles are conventional commits (`feat:`, `fix:`, `feat!:` ...) because they decide the next version (see README "Releasing").

## Agent skills

### Skills included in this template

- **Bootstrap Skill (`setup-the-repo`)**: Single-use interactive setup wizard. When initializing a new repo from this template, run `/setup-the-repo` (or `bun run setup`). It customizes the repository, verifies the build, removes itself, and instructs you to run `/setup-matt-pocock-skills`.
- **Matt Pocock Skills (`mattpocock/skills`)**: Complete engineering workflow including `/ask-matt`, `/tdd`, `/implement`, `/code-review`, `/wayfinder`, `/diagnosing-bugs`, `/codebase-design`, `/grill-with-docs`, etc.
- **Trajectonomics Internal Skills (`trajectonomics-lab/internal-skills`)**: Organization-specific workflow including `/pick-the-issue` to discover unblocked GitHub issues not currently handled by active T3 Code sessions and route them into the `ask-matt` framework.

### Reviewing a diff

`CODING_STANDARDS.md`: the conventions `bun run check` cannot enforce. Read it when reviewing, not when implementing.

### Issue tracker

GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Installing and updating skills

Skills come from [`mattpocock/skills`](https://github.com/mattpocock/skills) and [`trajectonomics-lab/internal-skills`](https://github.com/trajectonomics-lab/internal-skills) via the Vercel [`skills`](https://github.com/vercel-labs/skills) CLI and are pinned in `skills-lock.json`. The canonical copy is `.agents/skills/` (read natively by Codex, OpenCode, Pi, and Antigravity CLI); `.claude/skills/` holds symlinks into it for Claude Code. Never edit them by hand.

- Update: `bun run skills:update` (or `npx skills update -p -y`)
- Check status: `bun run skills:check` (or `npx skills check`)
- Reinstall:
  ```bash
  npx skills add mattpocock/skills --skill '*' -a claude-code codex opencode antigravity-cli pi -y
  npx skills add trajectonomics-lab/internal-skills -y
  ```
- Restore from the lock: `npx skills experimental_install`

## Checklist When Instantiating a New Repo

When creating a new repository from this template:
1. Run `/setup-the-repo` (or `bun run setup`) to interactively configure your package coordinates, description, archetype, domain glossary, and architecture records.
2. Next, run `/setup-matt-pocock-skills` to wire up your issue tracker and triage labels.
3. Run `bun run check` to verify linting, types, build, and tests.
