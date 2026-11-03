# ADR 0001: Architecture Decision Records in Trajectonomics Repositories

## Status

Accepted

## Context

Trajectonomics Lab repositories rely on clear architectural boundaries, strict pure functional cores, and autonomous AI coding agents operating across shared context. AI agents read domain concepts from `GLOSSARY.md` and architectural constraints from `docs/adr/`.

## Decision

Every technical repository derived from this template must record non-obvious design choices, invariants, and structural trade-offs as Architecture Decision Records (ADRs) under `docs/adr/`.

Key requirements:
1. ADRs are numbered sequentially (`0001-...md`, `0002-...md`).
2. Each ADR documents `Status`, `Context`, `Decision`, and `Consequences`.
3. AI agents and reviewers consult ADRs before making architectural modifications.
4. If an agent's planned implementation contradicts an existing ADR, it must surface the conflict explicitly rather than silently overriding it.

## Consequences

- Architectural decisions remain durable across human and agent changes.
- Reduces rework and keeps multi-agent collaborations aligned with repository invariants.
