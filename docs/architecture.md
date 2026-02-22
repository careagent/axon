# Axon Architecture Guide

## Overview

Axon is the trust registry, discovery service, and connection broker for the CareAgent ecosystem. It enables any patient CareAgent to find any provider CareAgent and establish a direct peer-to-peer connection -- without touching PHI or remaining in the path after handshake. Axon facilitates the handshake, then exits.

Published as `@careagent/axon`, the package provides a programmatic API (no CLI) with subpath exports for selective imports.

## Component Layers

```
                       +------------------+
                       |     types/       |
                       | (TypeBox schemas |
                       |  + derived types)|
                       +--------+---------+
                 _______________|_______________
                |               |               |
                v               v               v
         +-----------+   +-----------+   +-----------+
         | taxonomy/ |   | registry/ |   | protocol/ |
         +-----------+   +-----------+   +-----------+
              |               |               |
              v               |               |
     +----------------+       |               |
     | questionnaires/|       |               |
     +----------------+       |               |
              |               |               |
              |          +----+----+          |
              |          | broker/ |<---------+
              |          +---------+
              |               |
              v               v
         +------------------------+
         |         mock/          |
         | (uses all modules)     |
         +------------------------+
                    |
                    v
         +------------------------+
         |       index.ts         |
         | (Axon namespace,       |
         |  re-exports all)       |
         +------------------------+
```

**Dependency rules:**

- `types/` has no internal dependencies (only `@sinclair/typebox` schemas)
- `taxonomy/`, `registry/`, and `protocol/` depend on `types/`
- `questionnaires/` depends on `taxonomy/` (cross-validates provider types)
- `broker/` depends on `registry/` and `protocol/` (connect pipeline)
- `mock/` uses all modules (HTTP facade over the real implementation)
- `index.ts` re-exports everything and provides the `Axon` namespace object

## Module Reference

| Module | Key Files | Responsibility | Public API |
|--------|-----------|----------------|------------|
| `types/` | `types/index.ts` | TypeBox schemas and `Static<typeof Schema>` derived types for taxonomy, questionnaires, registry, protocol. Runtime schema re-exports for consumers needing validation. | Type exports: `RegistryEntry`, `TaxonomyAction`, `ConnectRequest`, etc. Schema exports: `RegistryEntrySchema`, `ConnectRequestSchema`, etc. |
| `taxonomy/` | `taxonomy/taxonomy.ts`, `taxonomy/schemas.ts`, `taxonomy/loader.ts` | Static API for querying the clinical action taxonomy. Loads versioned JSON data (`data/taxonomy/v1.0.0.json`) with lazy initialization. O(1) lookups via `Map`/`Set` indexes. | `AxonTaxonomy.getVersion()`, `.validateAction(id)`, `.getActionsForType(typeId)`, `.getAction(id)`, `.getProviderTypes()`, `.getProviderTypesByCategory(cat)`, `.getType(id)` |
| `questionnaires/` | `questionnaires/questionnaires.ts`, `questionnaires/loader.ts`, `questionnaires/schemas.ts`, `questionnaires/cans-fields.ts` | Loads and validates questionnaire JSON files through a 4-step pipeline: schema validation, taxonomy cross-validation, CANS field validation, `show_when` ordering. | `AxonQuestionnaires.getForType(typeId)`, `.listAvailableTypes()` |
| `registry/` | `registry/registry.ts`, `registry/npi.ts`, `registry/persistence.ts`, `registry/schemas.ts` | Provider and Neuron registry with NPI Luhn validation, credential management, multi-field AND search, and atomic file-backed persistence (write-to-temp-then-rename). | `new AxonRegistry(filePath)`, `.registerProvider(reg)`, `.registerNeuron(reg)`, `.findByNPI(npi)`, `.search(query)`, `.addCredential(npi, cred)`, `.updateCredentialStatus(npi, id, status)`, `.updateEndpoint(npi, endpoint)` |
| `protocol/` | `protocol/identity.ts`, `protocol/schemas.ts`, `protocol/nonce.ts`, `protocol/errors.ts` | Ed25519 identity (key generation, signing, verification via `node:crypto`), NonceStore for replay protection (nonce + 5-minute timestamp window), protocol message schemas, error hierarchy. | `generateKeyPair()`, `signPayload(payload, privKey, pubKey)`, `verifySignature(payload, sig, pubKey)`, `generateNonce()`, `new NonceStore(windowMs?)` |
| `broker/` | `broker/broker.ts`, `broker/audit.ts` | Stateless connection broker (`AxonBroker.connect()` pipeline) and hash-chained JSONL audit trail. Verifies signatures, checks credentials, resolves endpoints, grants or denies. | `new AxonBroker(registry, audit, nonceStore?)`, `.connect(signedMessage, patientPublicKey)`, `new AuditTrail(filePath)`, `.log(event)`, `AuditTrail.verifyChain(filePath)` |
| `mock/` | `mock/server.ts`, `mock/fixtures.ts` | HTTP server for integration testing. Uses real `AxonRegistry` and `AxonBroker` internally. Pre-seeds with fixture data (valid Luhn NPIs). | `createMockAxonServer(options?)`, `server.start()`, `server.stop()`, `server.url`, `server.registry` |

## Data Flow

The primary data flow through Axon follows a provider registration and patient connection sequence:

```
    Provider/Neuron Registration          Patient Connection
    ==========================          ==================

 1. Neuron registers org           4. Patient builds ConnectRequest
    via AxonRegistry                   (agent_id, provider_npi,
    .registerNeuron()                   nonce, timestamp, public_key)
         |                                     |
         v                                     v
 2. Neuron registers providers     5. Patient signs request (Ed25519)
    via AxonRegistry                   via signPayload()
    .registerProvider()                        |
         |                                     v
         v                             6. Patient sends SignedMessage
 3. Neuron attaches credentials        to AxonBroker.connect()
    via AxonRegistry                           |
    .addCredential()                           v
                                       7. Broker pipeline:
                                          a. Decode payload (base64url)
                                          b. Verify signature (Ed25519)
                                          c. Validate schema (TypeBox)
                                          d. Check nonce/timestamp
                                          e. Look up provider (registry)
                                          f. Check credential_status
                                          g. Resolve Neuron endpoint
                                               |
                                        +------+------+
                                        |             |
                                        v             v
                                   ConnectGrant  ConnectDenial
                                   (endpoint +   (code +
                                    conn_id)      message)
                                        |
                                        v
                                   8. Patient connects
                                      directly to Neuron
                                      (Axon exits)
```

**Module responsibilities per step:**

| Step | Module |
|------|--------|
| 1-3. Registration | `registry/` (NPI validation, persistence) |
| 4. Build request | `protocol/` (schemas) |
| 5. Sign request | `protocol/` (identity) |
| 6-7. Broker pipeline | `broker/` (connect), `protocol/` (verify, nonce), `registry/` (lookup) |
| 8. Direct connection | Outside Axon (Neuron handles) |

## Package Entry Points

| Entry Point | Import Path | Contains |
|-------------|-------------|----------|
| `.` | `@careagent/axon` | Full package: all classes, types, schemas, protocol functions, `Axon` namespace |
| `./taxonomy` | `@careagent/axon/taxonomy` | `AxonTaxonomy` static class |
| `./questionnaires` | `@careagent/axon/questionnaires` | `AxonQuestionnaires` static class |
| `./types` | `@careagent/axon/types` | TypeBox schemas + derived TypeScript types |
| `./mock` | `@careagent/axon/mock` | `createMockAxonServer()` for integration testing |

```typescript
// Full package
import { Axon, AxonRegistry, AxonBroker, AxonTaxonomy } from '@careagent/axon'

// Taxonomy only (for provider-core scope selection)
import { AxonTaxonomy } from '@careagent/axon/taxonomy'

// Types only
import type { RegistryEntry, TaxonomyAction } from '@careagent/axon/types'

// Mock server (for integration testing)
import { createMockAxonServer } from '@careagent/axon/mock'
```

## Mock HTTP Server

The mock server (`createMockAxonServer()`) wraps real `AxonRegistry` and `AxonBroker` instances behind an HTTP interface. It pre-seeds the registry with fixture data for deterministic testing.

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/v1/neurons` | Register a Neuron (organization). Returns `registration_id` and `bearer_token`. |
| GET | `/v1/neurons/:id` | Get Neuron state by registration ID. |
| PUT | `/v1/neurons/:id/endpoint` | Heartbeat / endpoint URL update. |
| POST | `/v1/neurons/:id/providers` | Register a provider under a Neuron. |
| DELETE | `/v1/neurons/:id/providers/:npi` | Remove a provider (no-op in v1, returns 204). |
| GET | `/v1/taxonomy/actions?type=...` | Get taxonomy actions for a provider type. Returns full action objects. |
| GET | `/v1/questionnaires/:typeId` | Get questionnaire for a provider type. |
| GET | `/v1/registry/search?...` | Search registry by name, NPI, specialty, provider_type, organization, credential_status. |
| GET | `/v1/registry/:npi` | Direct NPI lookup. |
| POST | `/v1/connect` | Broker connection via signed message. Expects `{ signed_message, patient_public_key }`. |

**Route ordering note:** `/v1/registry/search` is matched before `/v1/registry/:npi` to prevent the string `"search"` from matching as an NPI parameter.

**Failure modes:** The mock server accepts optional `failureMode` configuration to force `CREDENTIALS_INVALID` or `ENDPOINT_UNAVAILABLE` denials before the broker pipeline runs, enabling deterministic error path testing.

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Stateless broker** | Every `connect()` is a self-contained atomic operation. No session state between calls. The only mutable state is the nonce store (rolling window) and registry data. This simplifies scaling and eliminates session-related failure modes. |
| **Data-not-code taxonomy** | Taxonomy is a versioned JSON file (`data/taxonomy/v1.0.0.json`), not hardcoded enums. Enables governance-controlled updates -- adding a new provider type or action requires a data file change and version bump, not a code release. |
| **Closed participant list** | Only patient-core, provider-core, and neuron can talk to Axon. No third-party API access in v1. This bounds the trust surface. |
| **Patient-initiated connections** | Patients always initiate connections. The broker never contacts providers. This aligns with the patient-centered trust model: patients choose their providers, not the reverse. |
| **Transmit and exit** | Axon facilitates discovery and handshake, then exits the data path. It never proxies, relays, or inspects clinical traffic. After a `ConnectGrant`, the patient connects directly to the Neuron. |
| **Zero runtime dependencies** | All dependencies (`@sinclair/typebox`) are inlined by `tsdown` at build time. The published package has zero `dependencies` in `package.json`. Only `node:crypto` and `node:fs` are used at runtime. |
| **Self-attested credentials in v1** | `verification_source` is a required field on `CredentialRecord` (not optional), but v1 only uses `'self_attested'`. The data model supports progressive verification (`nppes_matched`, `state_board_verified`) without schema migration. |
| **Hash-chained audit trail** | Audit entries are appended to a JSONL file. Each entry includes the SHA-256 hash of the previous entry (`prev_hash`), creating a tamper-evident chain. The genesis entry uses 64 zeros as its `prev_hash`. No clinical content appears in audit entries -- only connection metadata (agent IDs, NPIs, denial codes). |

## See Also

- [docs/protocol.md](./protocol.md) -- Protocol overview and links to all 5 specification documents
- [docs/taxonomy.md](./taxonomy.md) -- Taxonomy structure, versioning, and extension process
- [docs/questionnaire-authoring.md](./questionnaire-authoring.md) -- Guide for authoring scope questionnaires
- [docs/governance.md](./governance.md) -- Governance model for taxonomy and protocol changes
- [spec/](../spec/) -- Protocol specification documents (handshake, identity, message, consent, credential)
