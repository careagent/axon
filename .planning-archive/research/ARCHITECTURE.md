# Architecture Research

**Domain:** Healthcare provider network trust infrastructure — NPI registry, clinical taxonomy, connection brokering, protocol specification
**Researched:** 2026-02-21
**Confidence:** HIGH (based on full PRD review and PROJECT.md context; no external sources needed — this is architecture documentation for a defined system, not ecosystem discovery)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                   @careagent/axon (Trust Infrastructure)            │
│                                                                     │
│  ┌──────────┐  ┌───────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Taxonomy │  │ Questionnaires│  │ Registry │  │   Broker     │  │
│  │src/taxo- │  │ src/question- │  │src/regi- │  │  src/broker/ │  │
│  │ nomy/    │  │ naires/       │  │ stry/    │  │              │  │
│  └────┬─────┘  └──────┬────────┘  └────┬─────┘  └──────┬───────┘  │
│       │               │ (validates       │               │           │
│       │◄──────────────┘  actions)        │      ┌────────┘           │
│       │                                 │      │ (credential check  │
│  ┌────▼──────────────────────────────── ▼──────▼───────────────┐   │
│  │                     src/protocol/                            │   │
│  │   identity.ts   message.ts   consent.ts   credential.ts     │   │
│  └─────────────────────────────┬────────────────────────────────┘   │
│                                │                                    │
│  ┌─────────────────────────────▼────────────────────────────────┐  │
│  │                     src/client/                               │  │
│  │   AxonRegistry  AxonBroker  AxonTaxonomy  AxonQuestionnaires  │  │
│  └──────────┬──────────────────────────────────────────────────┘  │
│             │                                                       │
│  ┌──────────▼──────────────────────────────────────────────────┐   │
│  │                     src/types/                               │   │
│  │  (shared TypeScript interfaces — depended on by all above)  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ authorized consumers only
               ┌────────────────┼───────────────────┐
               ▼                ▼                   ▼
      @careagent/neuron  @careagent/provider-core  @careagent/patient-core
      (register org,     (taxonomy → scope,        (search registry,
       manage endpoints,  questionnaires →          initiate connection)
       manage providers)  onboarding)
               │                                   │
               │     peer-to-peer after handshake  │
               └───────────────────────────────────┘
               (Axon is no longer in path after connect)
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `src/types/` | Shared TypeScript interfaces for all modules. No logic, no dependencies. Base layer that all other modules import from. | Type-only `.ts` files with `export interface` and `export type` declarations. No runtime code. |
| `src/taxonomy/` | Hierarchical controlled vocabulary (7 atomic actions → sub-actions → 49 provider type mappings). Loads versioned JSON data files. Provides query and validation API. | `actions.ts` loads `data/taxonomy/v1.0.0.json`; `provider-map.ts` maps types to action subsets; `validation.ts` resolves and validates action IDs; `version.ts` handles semver compatibility. |
| `src/questionnaires/` | Declarative conditional question sets per provider type. References taxonomy for valid action options. Schema-validated against TypeBox schemas. | One TypeScript data file per provider type in `types/`; `index.ts` is a registry mapping provider type strings to questionnaire objects; `schemas.ts` defines TypeBox schemas for the questionnaire format. |
| `src/registry/` | NPI-keyed directory of providers and organizations. Credential records. Neuron endpoint directory. NPI format validation (Luhn check). Registry storage abstraction. Search engine. | `npi.ts` for Luhn validation; `store.ts` defines storage interface with in-memory implementation; `credentials.ts` for credential state management; `endpoints.ts` for Neuron endpoint management; `search.ts` for multi-field query logic. |
| `src/protocol/` | Axon protocol implementation: Ed25519 identity exchange, message format and serialization, consent token format, credential format standard. Uses only Node.js built-in `crypto`. | `identity.ts` wraps `node:crypto` for Ed25519 key pair generation and challenge-response; `message.ts` serializes/deserializes and signs `AxonMessage`; `consent.ts` defines and verifies consent token structure; `credential.ts` is the shared credential format. |
| `src/broker/` | Stateless handshake sequencing: discover → verify credentials → look up endpoint → grant/deny connection → exit. All brokering events are audit-logged. Axon retains no session state. | `handshake.ts` implements the sequence as an explicit state machine; `session.ts` handles connection grant/deny and cleanup; broker calls registry and protocol, never persists session state. |
| `src/client/` | Public-facing API classes. Thin facades over internal modules. Multiple entry points for consumer-specific imports (taxonomy-only, registry-only, types-only). | `AxonTaxonomy`, `AxonRegistry`, `AxonBroker`, `AxonQuestionnaires` classes; `index.ts` re-exports everything; `tsdown.config.ts` defines multiple build entry points. |
| `spec/` | Human-readable Markdown protocol specification. Authoritative reference for all implementations. No runtime code. | Five `.md` files: `handshake.md`, `identity.md`, `message.md`, `consent.md`, `credential.md`. Written alongside Phase 4 implementation. |
| `data/` | Static versioned data files. Taxonomy JSON and provider type definitions. Loaded at runtime by `src/taxonomy/`. | `data/taxonomy/v1.0.0.json` (the taxonomy tree); `data/provider-types.json` (49 provider type definitions with metadata). JSON, not TypeScript — the data-not-code pattern. |

## Recommended Project Structure

```
careagent/axon/
├── src/
│   ├── types/               # Shared TypeScript interfaces — no deps, built first
│   │   ├── index.ts         # Public type exports
│   │   ├── registry.ts      # RegistryEntry, NeuronEndpoint, CredentialRecord, OrganizationAffiliation
│   │   ├── protocol.ts      # AxonMessage, AxonIdentity, AxonMessageType, ConnectionRequest/Result
│   │   ├── taxonomy.ts      # TaxonomyVersion, TaxonomyAction, AtomicAction
│   │   └── questionnaire.ts # Questionnaire, QuestionnaireSection, Question, QuestionCondition
│   ├── taxonomy/            # Controlled vocabulary engine
│   │   ├── index.ts         # Taxonomy entry point
│   │   ├── actions.ts       # Loads and indexes taxonomy data from data/taxonomy/
│   │   ├── provider-map.ts  # Maps provider type strings to applicable action subsets
│   │   ├── validation.ts    # Action ID validation and resolution
│   │   ├── schemas.ts       # TypeBox schemas for TaxonomyAction, TaxonomyVersion
│   │   └── version.ts       # Semver version management and compatibility checks
│   ├── questionnaires/      # Onboarding questionnaire repository
│   │   ├── index.ts         # Questionnaire registry (type string → Questionnaire object)
│   │   ├── schemas.ts       # TypeBox schemas for questionnaire format
│   │   └── types/           # One file per provider type
│   │       ├── physician.ts # Full physician questionnaire (v1)
│   │       └── *.ts         # 48 stub questionnaires (valid metadata, empty sections)
│   ├── registry/            # NPI-keyed provider directory
│   │   ├── index.ts         # Registry entry point
│   │   ├── npi.ts           # NPI validation (Luhn check, 10-digit format)
│   │   ├── credentials.ts   # Credential state management
│   │   ├── endpoints.ts     # Neuron endpoint directory and heartbeat tracking
│   │   ├── search.ts        # Multi-field search engine
│   │   ├── store.ts         # Storage abstraction interface + in-memory implementation
│   │   └── schemas.ts       # TypeBox schemas for registry data
│   ├── protocol/            # Axon protocol implementation
│   │   ├── identity.ts      # Ed25519 key pair generation, challenge-response (node:crypto)
│   │   ├── message.ts       # AxonMessage serialization, signing, verification
│   │   ├── consent.ts       # Consent token format, signing, verification
│   │   ├── credential.ts    # Credential format standard
│   │   └── schemas.ts       # TypeBox schemas for all protocol messages
│   ├── broker/              # Stateless handshake sequencing
│   │   ├── index.ts         # Broker entry point
│   │   ├── handshake.ts     # Handshake state machine (verify → endpoint → grant/deny)
│   │   └── session.ts       # Connection grant/deny and session teardown
│   └── client/              # Public-facing API facade
│       ├── index.ts         # Re-exports all four classes + types
│       ├── registry.ts      # AxonRegistry class
│       ├── broker.ts        # AxonBroker class
│       ├── taxonomy.ts      # AxonTaxonomy class
│       └── questionnaires.ts # AxonQuestionnaires class
├── spec/                    # Human-readable protocol specification (Markdown)
│   ├── handshake.md
│   ├── identity.md
│   ├── message.md
│   ├── consent.md
│   └── credential.md
├── data/                    # Static versioned data files
│   ├── taxonomy/
│   │   └── v1.0.0.json      # Full taxonomy tree, provider type mappings
│   └── provider-types.json  # 49 provider type definitions with metadata
├── test/
│   ├── unit/                # Unit tests per module
│   ├── integration/         # Cross-module integration tests
│   └── fixtures/            # Synthetic provider data (no real NPIs)
└── docs/                    # Developer and clinical expert documentation
    ├── architecture.md
    ├── governance.md
    ├── protocol.md
    ├── taxonomy.md
    └── questionnaire-authoring.md
```

### Structure Rationale

- **`src/types/` first:** Zero-dependency shared interfaces. Every other module imports from here; building it first eliminates circular dependency risk and gives all modules a stable contract to code against.
- **`data/` as sibling to `src/`:** Taxonomy and provider-type data are static artifacts, not compiled TypeScript. Keeping them in `data/` makes the data-not-code pattern explicit and allows the JSON files to be shipped separately or versioned independently.
- **`src/questionnaires/types/` as flat files:** One file per provider type. 49 files, all the same schema. This is intentional — clinical domain experts author new questionnaires by copying the stub and filling in questions. A flat directory makes that workflow obvious.
- **`src/protocol/` decoupled from `src/broker/`:** Protocol is the what (formats and cryptography). Broker is the when (the sequencing logic). Keeping them separate allows protocol tests to run without a registry and allows the spec documents to reference the protocol module directly.
- **`src/client/` as a pure facade:** The client layer does no logic — it delegates to the internal modules. This ensures the internal modules are independently testable without the client, and allows consumer-specific entry points without code duplication.
- **`spec/` at root level:** Protocol specification is not code. It belongs at the same level as `src/` and `docs/` to signal its status as a first-class artifact, not implementation detail.

## Architectural Patterns

### Pattern 1: Data-Not-Code for Versioned Vocabularies

**What:** Taxonomy actions and provider type definitions are JSON data files loaded at runtime, not TypeScript enums or hardcoded constants. Questionnaires are TypeScript data files (declarative object literals), not imperative interview logic.

**When to use:** Any vocabulary that must evolve independently of code releases, can be contributed by non-engineers (clinical domain experts), or must be recorded by version in generated documents (CANS.md records `scope.taxonomy_version`).

**Trade-offs:** Data files require a loader/validator layer at startup. The runtime cost is negligible (one-time load into memory). The benefit is that taxonomy updates are data changes, not code changes — no recompile required for minor additions.

**Example:**
```typescript
// src/taxonomy/actions.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TaxonomyVersion } from '../types/taxonomy.js';

// Loaded once at module initialization time
const rawData = readFileSync(
  join(import.meta.dirname, '../../data/taxonomy/v1.0.0.json'),
  'utf-8'
);
export const taxonomyV1: TaxonomyVersion = JSON.parse(rawData);

// Actions indexed by ID for O(1) lookup
export const actionIndex = new Map(
  taxonomyV1.actions.map(action => [action.id, action])
);
```

### Pattern 2: Storage Abstraction Interface

**What:** The registry storage layer is defined as a TypeScript interface. The v1 implementation is in-memory with JSON file persistence. The interface allows a v2 production database implementation to be swapped in without changing the registry logic.

**When to use:** Any stateful module where the production persistence backend is different from the development backend, or where testability requires a seeded in-memory store.

**Trade-offs:** Adds one layer of indirection. Worth it here because the v1 constraint explicitly calls out that in-memory/file-backed storage will be replaced with a production backend in v2. Without the abstraction, that swap would require refactoring the entire registry module.

**Example:**
```typescript
// src/registry/store.ts
export interface RegistryStore {
  get(npi: string): Promise<RegistryEntry | null>;
  set(npi: string, entry: RegistryEntry): Promise<void>;
  search(query: RegistrySearchQuery): Promise<RegistryEntry[]>;
  delete(npi: string): Promise<void>;
}

export class InMemoryRegistryStore implements RegistryStore {
  private entries = new Map<string, RegistryEntry>();

  async get(npi: string): Promise<RegistryEntry | null> {
    return this.entries.get(npi) ?? null;
  }

  async set(npi: string, entry: RegistryEntry): Promise<void> {
    this.entries.set(npi, entry);
    await this.persist(); // write to JSON file
  }
  // ...
}
```

### Pattern 3: Stateless Broker with Explicit Handshake States

**What:** The broker implements the handshake as an explicit sequence of steps, each of which either succeeds or returns a typed denial. The broker holds no state between calls — every call to `connect()` is a complete transaction. All events are audit-logged before the function returns.

**When to use:** Any brokering flow where the infrastructure must step out of the path after the handshake. Statelessness is a design constraint here, not an optimization.

**Trade-offs:** Cannot support resumable handshakes or multi-step conversations without external state management. For Axon this is correct — a failed handshake should be retried from scratch, not resumed.

**Example:**
```typescript
// src/broker/handshake.ts
export async function executeHandshake(
  request: ConnectionRequest,
  registry: RegistryStore,
  audit: AuditLog
): Promise<ConnectionResult> {
  // Step 1: Verify provider exists
  const entry = await registry.get(request.provider_npi);
  if (!entry) {
    await audit.log({ type: 'connection_deny', reason: 'provider_not_found', ...request });
    return { granted: false, reason: 'provider_not_found' };
  }

  // Step 2: Verify credentials
  if (entry.credential_status !== 'active') {
    await audit.log({ type: 'connection_deny', reason: 'credentials_not_active', ...request });
    return { granted: false, reason: 'credentials_not_active' };
  }

  // Step 3: Verify endpoint is reachable
  if (!entry.neuron_endpoint || entry.neuron_endpoint.health_status === 'unreachable') {
    await audit.log({ type: 'connection_deny', reason: 'endpoint_unreachable', ...request });
    return { granted: false, reason: 'endpoint_unreachable' };
  }

  // Grant — return endpoint, step out
  await audit.log({ type: 'connection_grant', ...request });
  return { granted: true, endpoint: entry.neuron_endpoint };
  // No session state retained. Axon is done.
}
```

### Pattern 4: Consumer-Specific Entry Points

**What:** The package exports multiple entry points configured in `tsdown.config.ts`. Consumers that only need taxonomy data do not import the registry or broker. This keeps bundle sizes minimal and makes import intent explicit.

**When to use:** Any package serving multiple consumer types with distinct capability needs. Standard in TypeScript packages with `exports` field in `package.json`.

**Trade-offs:** More build configuration complexity. Prevents tree-shaking ambiguity.

**Example:**
```json
// package.json exports field
{
  "exports": {
    ".": "./dist/index.js",
    "./taxonomy": "./dist/taxonomy.js",
    "./questionnaires": "./dist/questionnaires.js",
    "./types": "./dist/types.js"
  }
}
```

## Data Flow

### Request Flow: Provider Discovery (patient-core)

```
patient-core: AxonRegistry.search({ specialty: 'neurosurgery' })
    ↓
src/client/registry.ts  →  src/registry/search.ts
    ↓
search.ts iterates RegistryStore, applies filters
    ↓
Returns RegistryEntry[] with neuron_endpoint populated
    ↓
patient-core receives endpoint URL → connects directly to Neuron
(Axon is no longer involved)
```

### Request Flow: Connection Handshake (patient-core)

```
patient-core: AxonBroker.connect(request)
    ↓
src/client/broker.ts  →  src/broker/handshake.ts
    ↓
handshake.ts: registry.get(provider_npi) → check credential_status
    ↓
handshake.ts: check neuron_endpoint.health_status
    ↓
handshake.ts: protocol.verifyIdentity(request.signature)
    ↓
audit.log(connection_grant | connection_deny)
    ↓
Returns ConnectionResult { granted: true, endpoint: NeuronEndpoint }
    ↓
patient-core connects directly to Neuron endpoint
(Axon exits — no session state retained)
```

### Request Flow: Provider Registration (neuron)

```
neuron: AxonRegistry.registerNeuron(registration)
    ↓
src/client/registry.ts  →  src/registry/index.ts
    ↓
npi.ts: validateNPI(registration.npi) → Luhn check + format
    ↓
credentials.ts: validateCredentialRecords(registration.credentials)
    ↓
store.set(npi, entry) → persists to in-memory + JSON file
    ↓
Returns RegistrationResult { success: true, npi }
```

### Request Flow: Taxonomy Lookup (provider-core onboarding)

```
provider-core: AxonTaxonomy.getActionsForType('Physician')
    ↓
src/client/taxonomy.ts  →  src/taxonomy/provider-map.ts
    ↓
provider-map.ts: lookup 'Physician' in type-to-actions index
    ↓
Returns TaxonomyAction[] (all actions applicable_types includes 'Physician')
    ↓
provider-core onboarding Stage 5 presents actions as selectable list
(replaces free-text permitted_actions with taxonomy-backed selection)
```

### Request Flow: Questionnaire Retrieval (provider-core onboarding)

```
provider-core: AxonQuestionnaires.getForType('Physician')
    ↓
src/client/questionnaires.ts  →  src/questionnaires/index.ts
    ↓
index.ts: lookup 'Physician' in type registry → imports physician.ts
    ↓
questionnaires/schemas.ts: TypeBox validation of questionnaire structure
    ↓
Questionnaire references taxonomy action IDs in option values
(validated at build time: all action IDs must exist in taxonomy)
    ↓
Returns validated Questionnaire object
    ↓
provider-core onboarding activates type-specific interview after Stage 3
```

### State Management

Axon is intentionally stateless at the broker layer. State that persists:

```
data/taxonomy/v1.0.0.json      (static — changes only with taxonomy version bumps)
data/provider-types.json       (static — changes only when new types are added)
    ↓ loaded once at startup
src/taxonomy/actions.ts        (in-memory index, read-only after load)

registry RegistryStore         (read-write — provider/org registrations, credential updates)
    ↓ persisted to
.registry/store.json           (development file-backed persistence)

audit log                      (append-only — connection events, registration events)
```

No session state. No patient data. No PHI. Ever.

## Component Boundaries (What Talks to What)

### Internal Boundaries

| Boundary | Direction | Communication | Notes |
|----------|-----------|---------------|-------|
| `questionnaires` → `taxonomy` | One-way | Direct import at build/validation time | Questionnaires reference taxonomy action IDs. Validated at startup — if an action ID in a questionnaire doesn't exist in the taxonomy, the questionnaire is invalid. |
| `broker` → `registry` | One-way | Async function call via `RegistryStore` interface | Broker reads registry for credential check and endpoint lookup. Never writes. |
| `broker` → `protocol` | One-way | Direct function call | Broker uses protocol for identity verification on connection requests. |
| `client` → `taxonomy` | One-way | Wraps `AxonTaxonomy` class | Thin facade, no logic added. |
| `client` → `questionnaires` | One-way | Wraps `AxonQuestionnaires` class | Thin facade, no logic added. |
| `client` → `registry` | One-way | Wraps `AxonRegistry` class | Adds auth token validation before delegating. |
| `client` → `broker` | One-way | Wraps `AxonBroker` class | Adds auth token validation before delegating. |
| `types` → all | Inward | Imported by all modules | `src/types/` has no imports from other `src/` modules. Dependency must never be reversed. |
| `protocol` → `registry` | None | Not connected | Protocol is format/crypto only. Registry is storage. These are decoupled by design. |
| `registry` → `broker` | None | Not connected | Broker uses registry as a dependency, not the reverse. |

### External Boundaries

| Consumer | Permitted Operations | Entry Point |
|----------|----------------------|-------------|
| `@careagent/provider-core` | `AxonTaxonomy.getActionsForType()`, `AxonTaxonomy.validateAction()`, `AxonQuestionnaires.getForType()`, `AxonRegistry.registerProvider()` | `@careagent/axon` or `@careagent/axon/taxonomy` |
| `@careagent/patient-core` | `AxonRegistry.findByNPI()`, `AxonRegistry.search()`, `AxonBroker.connect()` | `@careagent/axon` |
| `@careagent/neuron` | `AxonRegistry.registerNeuron()`, `AxonRegistry.updateEndpoint()`, `AxonRegistry.updateCredentials()` | `@careagent/axon` |
| Third parties | None | Not an integration surface. Third parties use Neuron. |

## Build Order (Dependency Implications for Roadmap)

The component dependency graph determines phase order. Building out of order creates blocked work.

```
Phase 1: Types + Taxonomy
──────────────────────────
src/types/              (no deps — always first)
    ↓
data/taxonomy/ + data/provider-types.json  (data files — no code deps)
    ↓
src/taxonomy/           (deps: types, data files)

Phase 2: Questionnaires
──────────────────────────
src/questionnaires/     (deps: types, taxonomy schemas for validation)
                        [can proceed as soon as taxonomy schemas are stable]

Phase 3: Registry        [parallel to Phase 2]
──────────────────────────
src/registry/           (deps: types, NPI validation is self-contained)
                        [does not depend on taxonomy or questionnaires]

Phase 4: Protocol + Broker
──────────────────────────
src/protocol/           (deps: types, node:crypto — no other src/ deps)
    ↓
src/broker/             (deps: registry interface, protocol)
                        [broker cannot be built until registry store interface is stable]
spec/ documents         [written in parallel with Phase 4 implementation]

Phase 5: Client
──────────────────────────
src/client/             (deps: all four modules above)
                        [integration tests require all components]

Phase 6: Documentation
──────────────────────────
docs/ + spec/ finalization  (deps: Phase 5 complete)
```

### Parallelism Notes

- Phase 2 (Questionnaires) and Phase 3 (Registry) have no dependency on each other. They can be built in parallel by separate engineers.
- `src/protocol/` has no dependency on `src/registry/`. Protocol can start as soon as types are stable.
- The `spec/` documents are best written alongside the Phase 4 implementation, not after — implementation reveals edge cases that the spec must address.
- `src/types/` should be considered locked after Phase 1. Changes to shared types cascade to all modules.

## Scaling Considerations

This is a trust infrastructure package, not a request-serving service. Scaling considerations are primarily about the registry storage layer, not the taxonomy or questionnaire layers (which are read-only after load).

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Development / Demo | In-memory + JSON file store. Zero infrastructure. Current v1 target. |
| Single-organization production | SQLite store via `node:sqlite` (Node.js 22.5+ built-in). Still zero npm deps. Low write volume (registrations are infrequent). |
| Multi-organization / high-read | External read replica for registry queries. Writes still go to primary. The `RegistryStore` interface allows this swap without changing registry logic. |
| National-scale | Production database with geospatial indexing (REGI-08, v2). NPPES verification integration (REGI-06, v2). Audit log to structured store. |

### First Bottleneck

Registry reads during discovery queries. Patient CareAgents searching for providers are the highest-frequency read path. The in-memory store handles this at demo scale — a `Map<string, RegistryEntry>` with a linear scan for search queries. First optimization is an indexed search structure; second is a read-through cache layer in front of the file-backed store.

### What Never Scales (by Design)

The broker is stateless. Taxonomy and questionnaires are loaded once and never mutate. Protocol crypto operations are local. These components do not bottleneck regardless of load.

## Anti-Patterns

### Anti-Pattern 1: Hardcoded Action Enums

**What people do:** Define taxonomy actions as TypeScript enums or `const` objects in source code.

**Why it's wrong:** Taxonomy additions require code changes and package releases. Clinical domain experts cannot contribute new actions without a developer. The CANS.md version pinning doesn't work because there is no version in code. PRD explicitly states "taxonomy is data, not code."

**Do this instead:** Load from `data/taxonomy/v1.0.0.json`. New minor versions add JSON files. The loader specifies which version to load. Breaking changes bump the major version and trigger CANS migration tooling.

---

### Anti-Pattern 2: Broker Retaining Session State

**What people do:** Have the broker store a `Map<sessionId, SessionState>` to support resumable handshakes.

**Why it's wrong:** Axon's core design principle is "transmits and steps out." Retaining session state keeps Axon in the path — the opposite of what it's designed to do. It also creates a PHI leak surface: if session state includes anything about the patient's intent, Axon becomes a HIPAA-relevant system.

**Do this instead:** Every `connect()` call is a complete, atomic transaction. If a handshake fails, the consumer retries from scratch. Session continuity after the handshake is the Neuron's responsibility.

---

### Anti-Pattern 3: Registry Knowing About Protocol

**What people do:** Have the registry module import from the protocol module to verify signatures on registration requests.

**Why it's wrong:** Creates a circular dependency risk and couples two modules that should be independently testable. Registry tests should not require generating valid Ed25519 signatures.

**Do this instead:** Signature verification happens in the client layer (`src/client/registry.ts`) before the call reaches the registry. The registry receives already-validated data. Protocol and registry are decoupled.

---

### Anti-Pattern 4: Free-Text Action Strings in Questionnaire Options

**What people do:** Put action strings like `"Write operative notes"` as `value` fields in questionnaire question options.

**Why it's wrong:** These are unvalidatable. Provider-core cannot match `"Write operative notes"` against `"chart.operative_note"`. The whitelist enforcement in CANS hardening breaks.

**Do this instead:** All `option.value` fields in questionnaire action-selection questions must be valid taxonomy action IDs in dot-notation. Enforced by the questionnaire validation step at startup: `AxonTaxonomy.validateAction(option.value)` must return `true`.

---

### Anti-Pattern 5: Any Patient Data in Any Registry Record

**What people do:** Store the patient's NPI-equivalent, patient ID, or any patient-identifying information in registry entries or audit logs.

**Why it's wrong:** Axon is not a HIPAA covered entity specifically because it never handles patient data. Adding any patient identifier makes it one. The audit log records connection-level events (who requested a connection to which provider NPI) — not who the patient is.

**Do this instead:** Connection requests include only the provider NPI and the patient's Ed25519 public key (opaque — not linked to a patient identity in Axon's data model). The patient's identity is presented directly to the Neuron in the peer-to-peer phase.

## Integration Points

### Internal Boundaries Summary

| Boundary | Communication Pattern | Notes |
|----------|-----------------------|-------|
| `questionnaires` ↔ `taxonomy` | Import at validation time (startup) | One-way: questionnaires read taxonomy for action ID validation. Taxonomy never imports questionnaires. |
| `broker` ↔ `registry` | Async interface method call | Broker calls `RegistryStore.get()` for credential check and endpoint lookup. The `RegistryStore` interface is the contract — not the concrete `InMemoryRegistryStore`. |
| `broker` ↔ `protocol` | Direct function import | Broker calls `verifySignature()` from `src/protocol/identity.ts`. No shared state. |
| `client` ↔ all modules | Thin facade, direct import | Client classes delegate immediately to internal module functions. Auth token validation is the only logic added at the client layer. |
| `types` ↔ all | Imported by all, exports nothing runtime | Dependency direction is always inward (toward `types`). Never outward. |

### External Consumer Integration

| Consumer | How They Integrate | Auth Pattern (v1) |
|----------|--------------------|-------------------|
| `@careagent/provider-core` | `import { AxonTaxonomy, AxonQuestionnaires } from '@careagent/axon'` | Bearer token (package-level API key) |
| `@careagent/patient-core` | `import { AxonRegistry, AxonBroker } from '@careagent/axon'` | Bearer token (package-level API key) |
| `@careagent/neuron` | `import { AxonRegistry } from '@careagent/axon'` | Bearer token (package-level API key) |

All three consumers are in the same pnpm workspace or reference `@careagent/axon` as a local package dependency. No network hop in development — Axon is a library, not a service (for v1).

## Sources

- Project context: `/Users/medomatic/Documents/Projects/axon/.planning/PROJECT.md` (HIGH confidence — authoritative project document)
- Full PRD: `/Users/medomatic/Documents/Projects/axon/PRD.md` (HIGH confidence — authoritative product requirements document with 39 requirements, 6 phases, full data models, and repository structure)
- Component design derives directly from PRD Section 2 (Core Components), Section 3 (Repository Structure), Section 6 (Phased Milestones), and Section 7 (Requirements Traceability)
- No external research required: this is architecture documentation for a defined system with complete PRD. The patterns (data-not-code, storage abstraction, stateless broker) are derivable from the stated constraints and design decisions in PROJECT.md.

---
*Architecture research for: @careagent/axon — healthcare provider network trust infrastructure*
*Researched: 2026-02-21*
