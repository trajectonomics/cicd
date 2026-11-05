# @trajectonomics/tooling

Shared Biome and TypeScript presets, GritQL plugins, and reusable GitHub Actions workflows for Trajectonomics

[![CI](https://github.com/trajectonomics/cicd/actions/workflows/ci.yml/badge.svg)](https://github.com/trajectonomics/cicd/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Part of the [Trajectonomics](https://github.com/trajectonomics) ecosystem.

---

## Installation

```bash
bun add @trajectonomics/tooling
```

## Getting Started

```typescript
import { createEntity } from "@trajectonomics/tooling"

const entity = createEntity({ id: "1", label: "Example" })
console.log(entity)
```

---

## Development

```bash
# Install dependencies
bun install

# Run full verification suite (lint, typecheck, tests, build)
bun run check

# Run tests
bun test

# Code formatting & lint
bun run format
bun run lint
```

---

## Domain Documentation

- [GLOSSARY.md](./GLOSSARY.md): Ubiquitous domain terminology.
- [AGENTS.md](./AGENTS.md): Guidelines and rules for autonomous AI coding agents.
- [CODING_STANDARDS.md](./CODING_STANDARDS.md): Architecture, purity, and review invariants.
- [docs/adr/](./docs/adr/): Architecture Decision Records.

---

## License

[MIT](./LICENSE)
