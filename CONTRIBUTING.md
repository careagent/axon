# Contributing to @careagent/axon

## Overview

Axon is open-source under the Apache 2.0 license. Contributions are welcome from clinicians, security researchers, healthcare policy experts, and developers.

This guide covers how to set up a development environment, run tests, and submit changes. For architecture context, see [docs/architecture.md](docs/architecture.md). For the protocol specification, see [docs/protocol.md](docs/protocol.md).

---

## Development Setup

### Prerequisites

- **Node.js** >= 22.12.0
- **pnpm** (package manager)

### Getting Started

```bash
git clone https://github.com/careagent/axon
cd axon
pnpm install
pnpm build
pnpm test
```

Axon has zero runtime npm dependencies. All devDependencies (TypeBox, Vitest, tsdown, TypeScript) are bundled at build time by tsdown. The published package depends only on Node.js built-ins (`node:crypto`, `node:fs`, `node:path`).

---

## Project Structure

```
src/
├── taxonomy/        # Clinical action taxonomy (AxonTaxonomy)
├── questionnaires/  # Provider questionnaire system (AxonQuestionnaires)
├── registry/        # NPI-keyed provider directory (AxonRegistry)
├── protocol/        # Ed25519 identity, message schemas, nonce store
├── broker/          # Connection broker pipeline (AxonBroker)
├── mock/            # HTTP mock server for integration testing
├── types/           # TypeBox schemas and derived types
└── index.ts         # Axon namespace, re-exports all modules
```

For the full architecture guide with dependency graph, data flow, and design decisions, see [docs/architecture.md](docs/architecture.md).

---

## Testing

```bash
pnpm test             # Run all tests
pnpm test:coverage    # Run with coverage (80% threshold on all metrics)
```

- Tests are in `test/`, organized by module (e.g., `taxonomy.test.ts`, `registry.test.ts`, `broker.test.ts`)
- Integration tests are in `test/integration/`
- Coverage uses `@vitest/coverage-v8`

All tests must pass before submitting a pull request.

---

## Build

```bash
pnpm build
```

The build uses tsdown with multiple entry points. Output goes to `dist/`. The package has 5 subpath exports:

| Export | Path | Purpose |
|--------|------|---------|
| `.` | `dist/index.js` | Full package (Axon namespace, all modules) |
| `./taxonomy` | `dist/taxonomy/index.js` | Taxonomy only |
| `./questionnaires` | `dist/questionnaires/index.js` | Questionnaires only |
| `./types` | `dist/types/index.js` | TypeBox schemas and derived types |
| `./mock` | `dist/mock/index.js` | Mock HTTP server for integration testing |

---

## Contribution Types

| Type | Guide | Process |
|------|-------|---------|
| Taxonomy extension | [docs/taxonomy.md](docs/taxonomy.md) | Issue with clinical rationale, clinical review, PR |
| Protocol change | [docs/governance.md](docs/governance.md) | Issue for discussion, consensus, PR |
| New questionnaire | [docs/questionnaire-authoring.md](docs/questionnaire-authoring.md) | Issue with clinical rationale, clinical review, PR |
| Bug fix | N/A | Issue, PR |
| Documentation | N/A | PR |

---

## PR Process

1. Fork the repository
2. Create a feature branch from `main`
3. Make changes and ensure all tests pass (`pnpm test`)
4. Submit a pull request with a description of what changed and why

For protocol changes, open an issue for discussion before writing code. Protocol modifications affect all participants in the Axon network and require consensus before implementation. See [docs/governance.md](docs/governance.md) for the change process.

---

## Code Conventions

- **TypeScript strict mode** -- all strict flags enabled
- **TypeBox for all schemas** -- types derived via `Static<typeof Schema>`, not manually written interfaces
- **ESM only** -- `"type": "module"` in package.json; use `.js` extensions in imports
- **No runtime npm dependencies** -- all devDependencies are bundled at build time
- **Node.js built-ins** -- use `node:crypto`, `node:fs`, `node:path` (prefixed imports)
- **Data-as-JSON** -- taxonomy and questionnaire data live in `data/`, not hardcoded in source

---

## License

Apache 2.0. See [LICENSE](LICENSE).
