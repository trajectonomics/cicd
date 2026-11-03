# Domain Glossary

Ubiquitous language for this repository. Every concept named here has an exact definition that code, tests, commit messages, and PR titles must use. Synonyms in a diff are defects.

## Template Guide

When instantiating a new repository from this template:
1. Define your core domain entities, value objects, and states below.
2. In single-context repositories, maintain this single `GLOSSARY.md` at repo root.
3. In multi-context repositories, place `GLOSSARY-MAP.md` at root pointing to each sub-context's `GLOSSARY.md`.

---

## Core Terms

### Invariant
A rule or condition that must hold true at all times across all state transitions within this system.

### Pure Core
The isolated domain logic of a package that executes deterministically without I/O, network calls, filesystem access, system clock dependencies, or global mutable state.

### Error Code
A strictly typed, distinct machine-readable identifier assigned to every rejection rule across the package API.
