# Coding Standards

Read at **review** time. `bun run check` already enforces the mechanical rules (Biome formatting and
lint, strict types, tests, publint, and actionlint on workflow changes). This file covers what it
cannot: the judgement calls a reviewer must check by reading the diff.

This package is config only: presets, a plugin, and workflows. There is no runtime code to review.
Decisions live in `docs/adr/`; vocabulary lives in `GLOSSARY.md`; release surprises live in
`docs/runbooks/publishing.md`.

## Presets

- The presets are the product. A diff that relaxes a rule in `biome/` or `tsconfig/` to make an error go
  away is a defect unless it carries its reason in the PR body.
- A change to a preset ships with a test in `test/presets.test.ts` that fails without it, run through a
  temporary consumer project.
- A new exported file is added to `exports` and `files` in `package.json`, and to `biome-manifest.json`
  when Biome should load it.
- The GritQL plugin message names the rule and the fix, with no reference to a specific package.

## Workflows

- `release.yml` stays a thin caller. Publishing logic goes into `publish.yml`, where every package
  inherits the fix.
- A new input on `publish.yml` has a default, so callers pinned to `@v1` keep working. Removing or
  renaming an input is a breaking change and needs a new major tag.
- Every step that talks to npm or GitHub tolerates a re-run: it checks the current state first, then acts.
- Third-party actions are pinned to a major version or newer; download URLs name an exact version.

## Naming and Domain Language

- Use `GLOSSARY.md` vocabulary strictly. Synonyms in a diff are considered defects.
- PR titles are conventional commits, because they decide the next version.

## Scripts and Tests

- A test name states the rule or invariant, not the internal function under test.
- One test per error condition, asserting on the message or code rather than merely that something threw.
- Files stay under the Biome size ceiling (100 lines, 200 for tests). Split by concern.
