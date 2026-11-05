# ADR 0001: Architecture Foundations for @trajectonomics/tooling

## Status

Accepted

## Context

`trajectonomics/cicd` is established to provide Shared Biome and TypeScript presets, GritQL plugins, and reusable GitHub Actions workflows for Trajectonomics.
It is built with Bun, TypeScript, and Biome under the Trajectonomics architectural guidelines.

## Decision

1. **Archetype**: Configured as `minimal`.
2. **Language & Runtime**: TypeScript (strict mode with `isolatedDeclarations`) executed on Bun.
3. **Domain Integrity**: All domain concepts adhere to [GLOSSARY.md](../../GLOSSARY.md).
4. **Agent Collaboration**: AI agents adhere to [AGENTS.md](../../AGENTS.md) and [CODING_STANDARDS.md](../../CODING_STANDARDS.md).

## Consequences

- Invariants remain verifiable through deterministic tests (`bun test`) and `bun run check`.
- All autonomous agent work is test-first and reviewed against established coding standards.
