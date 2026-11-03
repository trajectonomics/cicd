# @trajectonomics/technical-template

The official starter repository template for technical packages, libraries, and services across [Trajectonomics](https://github.com/trajectonomics).

## Highlights

- **Interactive Repo Setup**: Includes the single-use `/setup-the-repo` skill (or `bun run setup`) that interactively customizes package metadata, README, GLOSSARY, CI workflows, and starter code for your archetype, self-destructs to leave a clean repo, and prompts setting up Matt Pocock's skills.
- **AI Agent Skills Ready**: Bundled with [Matt Pocock's skills](https://github.com/mattpocock/skills) (`ask-matt`, `tdd`, `implement`, `wayfinder`, `code-review`, etc.) and Trajectonomics [internal skills](https://github.com/trajectonomics/internal-skills) (`pick-the-issue`) managed via `skills-lock.json`. Compatible with Claude Code, Codex, OpenCode, Antigravity CLI, and Pi.
- **Bun First**: Built on [Bun](https://bun.sh) (`1.4.4`) for blazing fast testing, installs, and script execution.
- **Dual ESM + CJS Output**: Powered by [`tsdown`](https://github.com/sxzz/tsdown) with full `.d.ts` and `.d.mts` declaration generation.
- **Strict Verification Pipeline**: Biome linting and formatting (with strict file line ceilings and cognitive complexity limits), strict TypeScript compilation with `isolatedDeclarations`, tests via `bun test`, plus package export verification via [`publint`](https://publint.dev) and [`@arethetypeswrong/cli`](https://github.com/arethetypeswrong/arethetypeswrong).
- **Automated Semver & Releases**: Git-tag-driven version computation (`scripts/version.ts`), automated conventional commit PR title validation, and GitHub Actions publishing workflow.
- **Domain Modeling & ADRs**: Pre-structured `GLOSSARY.md`, Architecture Decision Records (`docs/adr/`), and agent operational guides (`docs/agents/`).

---

## Quick Start

### 1. Create a Repository from this Template

Using GitHub CLI:
```bash
gh repo create trajectonomics/<new-repo-name> \
  --template trajectonomics/technical-template \
  --public \
  --clone
```

Or click **"Use this template"** on GitHub at [trajectonomics/technical-template](https://github.com/trajectonomics/technical-template).

### 2. Run Interactive Setup

Inside your newly cloned repository, run the interactive setup wizard:

```bash
bun install
bun run setup
```

*Or within an AI agent session (Claude Code, Antigravity, OpenCode, etc.):*
```
/setup-the-repo
```

The interactive wizard will:
1. Ask you for your repository coordinates, project description, archetype (Pure Domain Library, CLI Tool, Service/Worker, or Minimal Starter), and initial domain terms.
2. Customize `package.json`, `README.md`, `GLOSSARY.md`, `AGENTS.md`, `CODING_STANDARDS.md`, `docs/adr/`, and `src/`.
3. Verify your new repository via `bun run check`.
4. **Self-destruct**: automatically delete the single-use `setup-the-repo` bootstrap skill so your repository stays clean.
5. Remind you to run `/setup-matt-pocock-skills` to wire up GitHub Issues and triage labels!

---

## Available Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `bun run setup` | `bun .agents/skills/setup-the-repo/scripts/setup.ts` | Interactive repository bootstrap wizard |
| `bun run check` | Lint + Typecheck + Test + Build + Package Lint | Full CI verification pass |
| `bun run test` | `bun test` | Run test suite with Bun test runner |
| `bun run typecheck` | `tsc -p tsconfig.json && tsc -p tsconfig.test.json` | Strict TypeScript typecheck |
| `bun run lint` | `biome ci --error-on-warnings .` | Check formatting and lint rules |
| `bun run format` | `biome check --write .` | Auto-format files and organize imports |
| `bun run build` | `tsdown` | Compile dual ESM/CJS build into `dist/` |
| `bun run lint:package`| `publint --strict && attw --pack . --profile node16` | Validate package exports & types |
| `bun run skills:check`| `bunx skills@latest check` | Verify installed agent skills against lockfile |
| `bun run skills:update`| `bunx skills@latest update` | Update installed skills to latest versions |

---

## Skills Architecture

Skills are pinned in `skills-lock.json`:
- Canonical skill files live in `.agents/skills/`.
- Claude Code symlinks live in `.claude/skills/`.
- Managed using the Vercel `skills` CLI:
  ```bash
  # Check skills status
  bun run skills:check

  # Update pinned skills
  bun run skills:update
  ```

---

## License

[MIT](./LICENSE)
