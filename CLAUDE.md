# CLAUDE.md -- @careagent/axon

## Project Overview

Axon is the **trust registry and connection broker** for the CareAgent ecosystem. It maintains a registry of verified healthcare providers, validates their credentials (NPI, licensure), and brokers connections between patient CareAgents and provider Neuron servers. Axon **never handles PHI** -- it only verifies identity, checks credentials, resolves endpoints, and exits.

## The Irreducible Risk Hypothesis

Clinical AI agents carry irreducible risk of harm. Axon manages this risk by serving as the **credentialing gatewall** -- no patient CareAgent can reach a provider without passing through Axon's signature verification, credential validation, and endpoint health checks. Every connect attempt is audited. The broker is stateless and deterministic: it cannot be tricked into granting access through accumulated state or session manipulation.

## Directory Structure

```
axon/
  data/
    taxonomy/           # v1.0.0.json -- provider type taxonomy (49 types)
    questionnaires/     # Per-specialty onboarding questionnaire JSON files
  spec/                 # Protocol specifications (5 files)
    consent.md          # Consent token format
    credential.md       # Credential verification rules
    handshake.md        # Connection handshake flow
    identity.md         # Ed25519 identity and signing
    message.md          # Message schemas (ConnectRequest/Grant/Denial)
  src/
    broker/             # AxonBroker -- stateless connection pipeline
    mock/               # Mock server and fixtures for downstream testing
    protocol/           # Ed25519 identity, nonce store, signed message schemas
    questionnaires/     # Specialty-specific onboarding questionnaire loader
    registry/           # AxonRegistry -- provider trust registry with persistence
    server/             # Standalone HTTP server, token management
    taxonomy/           # Provider type taxonomy loader and schemas
    types/              # TypeBox-derived type re-exports and schema re-exports
    index.ts            # Barrel export + Axon convenience namespace
  test/
    integration/        # End-to-end server tests
    *.test.ts           # Unit tests for each module
```

## Commands

```bash
pnpm build             # Build with tsdown
pnpm test              # Run tests: vitest run
pnpm test:coverage     # Run tests with coverage: vitest run --coverage
pnpm start             # Start standalone server: node dist/server/standalone.js
```

There is no separate lint or typecheck script. The build step handles type checking via tsdown.

## Code Conventions

- **ESM-only** -- `"type": "module"` in package.json. All imports use `.js` extensions.
- **TypeBox schemas for runtime validation** -- schemas defined with `@sinclair/typebox` in `*/schemas.ts` files. TypeBox is a devDependency (zero runtime deps for consumers).
- **TypeScript type aliases derived from TypeBox** -- `type Foo = Static<typeof FooSchema>` pattern throughout `src/types/index.ts`. Do NOT define standalone TypeScript interfaces when a TypeBox schema exists.
- **Barrel exports** -- every subdirectory has an `index.ts`. The root `src/index.ts` re-exports everything. Subpath exports: `@careagent/axon/taxonomy`, `/questionnaires`, `/types`, `/mock`, `/server`.
- **Naming**: PascalCase for classes and schemas (suffix `Schema`), camelCase for functions and variables, UPPER_SNAKE for constants.
- **Ed25519 cryptography** -- `node:crypto` only. Keys are base64url-encoded raw 32-byte values (JWK `x`/`d` components). Use `sign(null, ...)` and `verify(null, ...)` -- never `createSign`/`createVerify` (those are for RSA/ECDSA).
- **Node.js >= 22.12.0** required.
- **pnpm** as package manager.
- **Vitest** for testing.

## Anti-Patterns

- **Do NOT handle PHI in axon.** Axon verifies credentials and resolves endpoints. It never reads, stores, or forwards clinical data.
- **Do NOT add runtime dependencies.** Axon has zero production deps. TypeBox is devDependency only. Keep it that way.
- **Do NOT use `createSign`/`createVerify`** for Ed25519. Use `sign(null, ...)` / `verify(null, ...)` from `node:crypto`.
- **Do NOT duplicate type exports.** Types are derived from TypeBox schemas via `Static<>`. Protocol types are re-exported from `src/protocol/index.ts` -- do not re-export them from `src/types/index.ts`.
- **Do NOT add session state to the broker.** Every `connect()` call is self-contained and atomic. No state persists between calls.
- **Do NOT use relative imports without `.js` extension.** ESM requires explicit extensions.

## Key Technical Details

### Handshake Pipeline (5 specs in /spec/)

The connection handshake is a linear pipeline in the AxonBroker:

1. **Signature verification** -- Ed25519 signature over the ConnectRequest payload
2. **Nonce/timestamp validation** -- nonce uniqueness check + 5-minute timestamp window
3. **Provider lookup** -- NPI-based registry search
4. **Credential check** -- verify provider credentials are active (not expired/revoked)
5. **Endpoint resolution** -- resolve the provider's Neuron endpoint URL + heartbeat freshness check (5 min threshold)

Result is either a `ConnectGrant` (with Neuron endpoint URL) or a `ConnectDenial` (with denial code). After a grant, the patient CareAgent connects directly to Neuron -- Axon is no longer involved.

### Denial Codes

`SIGNATURE_INVALID`, `NONCE_REPLAYED`, `TIMESTAMP_EXPIRED`, `PROVIDER_NOT_FOUND`, `CREDENTIALS_INVALID`, `ENDPOINT_UNAVAILABLE`

### Taxonomy

49 provider types loaded from `data/taxonomy/v1.0.0.json`. Each type has atomic actions, scope-of-practice rules, and governed-by mappings. The taxonomy is versioned and immutable per version.

### Questionnaires

Per-specialty onboarding questionnaires in `data/questionnaires/`. Used during provider onboarding to collect practice-specific configuration.

### Exports

The package exposes a convenience namespace:

```ts
import { Axon } from '@careagent/axon'
Axon.Registry       // AxonRegistry class
Axon.Broker         // AxonBroker class
Axon.Taxonomy       // AxonTaxonomy class
Axon.Questionnaires // AxonQuestionnaires class
```
