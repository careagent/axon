# CLAUDE.md -- @careagent/a2a-types

## Project Overview

This is the **shared A2A contract schemas package** for the CareAgent ecosystem. It defines the canonical TypeBox schemas for Agent Cards, Tasks, Messages, Parts, and JSON-RPC transport — aligned with the A2A specification.

**This package is the single source of truth for all A2A types.** All repos (axon, neuron, provider-core, patient-core) must import from `@careagent/a2a-types`. Do NOT define local Agent Card, Task, or JSON-RPC schemas in individual repos.

## Installation

Individual repos install this as a local file dependency:

```json
{
  "devDependencies": {
    "@careagent/a2a-types": "file:../shared"
  }
}
```

## Directory Structure

```
shared/
  src/
    agent-card.ts    # AgentCardSchema + CareAgentMetadataSchema (CareAgent extensions)
    task.ts          # TaskSchema, MessageSchema, PartSchema (Text/Data/File), ClinicalClassification
    json-rpc.ts      # JSON-RPC 2.0 base + A2A method schemas (SendMessage, GetTask, CancelTask)
    index.ts         # Barrel export
  dist/              # Built output (ESM)
```

## Commands

```bash
pnpm build         # Build with tsdown
pnpm typecheck     # TypeScript type checking
```

## Anti-Patterns

- **Never define A2A schemas in individual repos** — import from this package
- **Never add CareAgent business logic here** — this is schemas only
- **Never add runtime dependencies** — TypeBox is a peer/dev dependency
- **Never break backwards compatibility** without updating all consuming repos

## Conventions

- All schemas use TypeBox (`Type.Object()`, `Type.Union()`, etc.)
- Types are derived via `Static<typeof Schema>` — no standalone interfaces
- CareAgent extensions (clinical_actions, NPI, classification) live in `CareAgentMetadataSchema`
- A2A-standard fields match the spec exactly; CareAgent fields are namespaced under `careagent`
