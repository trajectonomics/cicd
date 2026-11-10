# Domain Glossary: @trajectonomics/tooling

Ubiquitous language for `trajectonomics/cicd`. Every term defined here is binding across code, tests, documentation, and PR titles. Synonyms in a diff are defects.

## Core Terms

### Preset
A shareable, versioned configuration file (Biome or TypeScript) that consuming repositories extend instead of copying. Published under `@trajectonomics/tooling/<tool>/<name>`.

### Reusable Workflow
A GitHub Actions workflow in `.github/workflows/` exposed through `workflow_call` and consumed by other repositories, pinned to a floating major tag (e.g. `@v1`).

### Consumer
A repository that extends a Preset or calls a Reusable Workflow. Drift is measured from a Consumer's side: its pin, its Biome config and what it keeps that the Preset owns.

### Non-determinism Plugin
A GritQL plugin (`no-nondeterminism.grit`) that rejects clocks, randomness, and other non-deterministic constructs in pure-core code. Bundled by the `deterministic` Preset.

### Invariant
A rule or condition that must hold true across all state transitions in this system.
