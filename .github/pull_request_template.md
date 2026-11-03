## Description

<!-- Provide a concise summary of the changes introduced by this pull request. -->

## Associated Issue

<!-- Reference the issue this PR addresses (e.g. Closes #12, Fixes #34). -->
Closes #

## PR Title Convention

- [ ] PR title follows [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat: add user authentication`, `fix: handle empty payload`).
  - Required types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Domain & Architecture Alignment

- [ ] Uses ubiquitous terms defined in [`GLOSSARY.md`](./GLOSSARY.md). No synonyms introduced.
- [ ] Complies with architectural invariants in [`CODING_STANDARDS.md`](./CODING_STANDARDS.md).
- [ ] If architectural decisions were made or updated, recorded in [`docs/adr/`](./docs/adr/).

## Pre-Merge Verification

- [ ] `bun run check` passes locally (Biome lint/format, strict TypeScript `isolatedDeclarations`, tests, `tsdown` build, `publint`, `attw`).
- [ ] Added or updated test cases covering positive paths and invariant edge cases.
