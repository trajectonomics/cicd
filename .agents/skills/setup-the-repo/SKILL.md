---
name: setup-the-repo
description: "Interactive questionnaire and automated bootstrapper to customize a new repository created from trajectonomics/technical-template. Sets up package metadata, README, CI workflows, GLOSSARY, AGENTS rules, and starter code, self-destructs the setup skill, and instructs setting up Matt Pocock's skills."
disable-model-invocation: true
---

# Setup The Repo

Interactive repository bootstrapper and customizer for new repositories created from `trajectonomics/technical-template`.

This is a **single-use bootstrap skill**: it conducts an interactive interview to discover what you really need for the new project, customizes all files, proves the build and tests pass, **self-destructs (removes this setup skill completely)**, and instructs you to run `/setup-matt-pocock-skills` to complete the engineering agent setup.

---

## How to Run

### Option 1: Automated Script Execution (Fastest)

Run the included TypeScript wizard with Bun:

```bash
# Interactive wizard in your terminal:
bun run setup

# Or directly:
bun .agents/skills/setup-the-repo/scripts/setup.ts

# Non-interactive / scripted with flags:
bun .agents/skills/setup-the-repo/scripts/setup.ts \
  --name "trajectonomics/my-project" \
  --pkg "@trajectonomics/my-project" \
  --description "Deterministic projection engine" \
  --archetype core \
  --publish true
```

---

### Option 2: Interactive Agent Protocol

If driven through an AI coding assistant session, the agent carries out this interactive protocol:

#### 1. Explore Current Context
- Inspect `git remote get-url origin` to infer the GitHub repository name (`trajectonomics/<repo>`).
- Inspect current folder name.
- Read existing `package.json`.

#### 2. Interactive Questionnaire
Ask the user the following questions concisely (with smart defaults pre-filled):

1. **Repository Identity**:
   - GitHub Repository (`trajectonomics/<name>`)
   - Package Name (`@trajectonomics/<name>`)
   - One-line Description

2. **Project Archetype (What do you really need?)**:
   - `[1] Pure Domain Library` (deterministic, zero I/O, strict types, dual ESM/CJS build with `tsdown`, npm provenance publishing, `publint` + `attw`).
   - `[2] CLI Tool` (executable bin script with Bun/Node, command entry point, local/binary build).
   - `[3] Backend Service / Worker` (API service, Cloudflare Worker, or daemon).
   - `[4] Minimal Library` (clean starter keeping Bun, Biome, and Bun Test).

3. **Domain Vocabulary**:
   - 1-3 core ubiquitous terms and definitions to seed `GLOSSARY.md`.

4. **CI & Release Workflow**:
   - Enable automated npm releases on main push? (Default: `yes` for Pure Domain Library, `no` for CLI/Service).

#### 3. Present Plan & Confirm
Show the user a concise summary of what will be configured:
- Target package name and repository
- Archetype selected
- Files to be customized (`package.json`, `README.md`, `GLOSSARY.md`, `AGENTS.md`, `CODING_STANDARDS.md`, `docs/adr/0001-...md`, `src/index.ts`, `src/index.test.ts`, `.github/workflows/`)

#### 4. Apply Customizations
- Update `package.json` with the new package name, description, git remote, and adjusted scripts/bin.
- Generate project-specific `README.md` with badge links, installation guide, and scripts.
- Seed `GLOSSARY.md` with the user's domain terms.
- Update `AGENTS.md` and `CLAUDE.md` to reference the new package and repository.
- Record initial Architecture Decision Record under `docs/adr/0001-core-architecture-decisions.md`.
- Scaffold typed starter functions and passing unit tests in `src/index.ts` and `src/index.test.ts`.
- Adjust `.github/workflows/` (remove `release.yml` if npm publishing is disabled).
- Remove `"setup"` script entry from `package.json`.

#### 5. Verify Build and Quality Gates
Run:
```bash
bun install
bun run check
```
Verify that Biome (0 warnings), TypeScript (strict typecheck), tests (`bun test`), build (`tsdown`), and package lint (`publint` + `attw`) pass 100% green.

#### 6. Self-Destruction / Skill Cleanup
Because this is a bootstrap-only skill, remove it so the repository remains clean:
- Delete `.agents/skills/setup-the-repo/`
- Delete `.claude/skills/setup-the-repo` symlink
- Commit the bootstrap changes:
  ```bash
  git add .
  git commit -m "chore: bootstrap project from template and remove setup-the-repo skill"
  ```

#### 7. Prompt to Setup Matt Pocock's Skills
Output the following prominent call-to-action to the user:

```markdown
================================================================================
🎉 REPOSITORY SETUP COMPLETE!
================================================================================

Your repository has been customized, built, and verified.
The single-use bootstrap skill `setup-the-repo` has been removed.

👉 IMPORTANT NEXT STEP:
   Run `/setup-matt-pocock-skills` to configure Matt Pocock's engineering skills:

   This sets up:
   1. Issue tracker (GitHub Issues with `gh` CLI).
   2. Canonical triage labels (`needs-triage`, `ready-for-agent`, `needs-info`, etc.).
   3. Domain document consumption rules (`GLOSSARY.md` and `docs/adr/`).

After running `/setup-matt-pocock-skills`, you can pick or create your first ticket
using `/pick-the-issue` or `/to-tickets`!
================================================================================
```
