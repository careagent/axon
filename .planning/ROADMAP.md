# Roadmap: @careagent/axon

## Overview

Axon is built bottom-up along its dependency graph: shared types and taxonomy data first (the foundation everything imports), then questionnaires and registry in parallel (independent modules that both depend on Phase 1 output), then the protocol layer and connection broker (which consumes the registry interface), then the client facade and consumer integration (pure aggregation over all modules), and finally documentation and release preparation. The six phases deliver progressively richer capability -- after Phase 1 provider-core can already consume taxonomy data, after Phase 4 the full discover-verify-connect handshake works end-to-end, and after Phase 6 Axon is ready for open-source release.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Package Foundation and Clinical Action Taxonomy** - Scaffold the package and build the hierarchical action vocabulary with Physician-complete taxonomy data
- [x] **Phase 2: Questionnaire Repository** - Declarative conditional questionnaire system with full Physician questionnaire and 48 provider type stubs
- [x] **Phase 3: Registry and Credentials** - NPI-keyed provider directory with file-backed storage, credential management, and multi-field search
- [x] **Phase 4: Protocol Specification and Connection Broker** - Ed25519 identity exchange, signed message protocol, and stateless handshake brokering with audit trail
- [x] **Phase 5: Client Facade, Package Exports, and Integration** - Public API surface, multi-entry build, mock server, and consumer integration verification (completed 2026-02-22)
- [ ] **Phase 5.1: Mock Server HTTP Route Completeness** - INSERTED: Add missing taxonomy, questionnaire, and registry HTTP routes to mock server; fix search path mismatch (gap closure from v1.0 audit)
- [ ] **Phase 6: Documentation and Release** - Architecture guide, protocol specs, taxonomy and questionnaire authoring guides, governance model, and release preparation

**Note:** Phases 2 and 3 have no dependency on each other and can be executed in either order or in parallel.

## Phase Details

### Phase 1: Package Foundation and Clinical Action Taxonomy
**Goal**: Developers can build, test, and import the package, and provider-core can consume a versioned hierarchical action vocabulary for scope selection
**Depends on**: Nothing (first phase)
**Requirements**: AXON-01, TAXO-01, TAXO-02, TAXO-03, TAXO-04, TAXO-05, TAXO-06, TAXO-07
**Success Criteria** (what must be TRUE):
  1. Running `pnpm build` produces a valid dist with zero runtime npm dependencies and `pnpm test` passes with coverage above 80%
  2. `AxonTaxonomy.getActionsForType('physician')` returns the full Physician action set organized under the seven atomic actions (chart, order, charge, perform, interpret, educate, coordinate)
  3. `AxonTaxonomy.validateAction('chart.progress_note')` confirms the action exists in the current taxonomy version; invalid IDs are rejected
  4. Taxonomy data lives in `data/taxonomy/v1.0.0.json` as a versioned JSON file, not as hardcoded TypeScript enums, and the taxonomy version string is accessible for CANS.md `scope.taxonomy_version`
  5. Every action in the taxonomy maps to at least one provider type via `applicable_types`, and every one of the 49 provider types has at least the common cross-type actions available
**Plans**: 3 plans in 3 waves

Plans:
- [x] 01-01-PLAN.md — Package scaffold (pnpm, TypeScript, tsdown, vitest, TypeBox schemas, JSON loader)
- [x] 01-02-PLAN.md — Taxonomy data authoring (49 provider types, Physician actions, common cross-type actions)
- [x] 01-03-PLAN.md — AxonTaxonomy API implementation with TDD and data integrity tests

### Phase 2: Questionnaire Repository
**Goal**: Provider-core onboarding can retrieve a complete, conditional questionnaire for Physicians that produces CANS.md-compatible answers, with valid stubs for all other provider types
**Depends on**: Phase 1 (taxonomy action IDs must be stable for questionnaire option values)
**Requirements**: QUES-01, QUES-02, QUES-03, QUES-04, QUES-05, QUES-06
**Success Criteria** (what must be TRUE):
  1. `AxonQuestionnaires.getForType('physician')` returns a questionnaire with conditional branching paths (surgical/non-surgical, academic/private practice) and taxonomy-backed scope selection options
  2. Every taxonomy action ID referenced in any questionnaire option exists in the current taxonomy version (cross-validated at build or load time)
  3. Every CANS field path referenced in questionnaire mappings is valid against the CANS schema structure
  4. `AxonQuestionnaires.getForType('nursing')` (and all other 48 non-Physician types) returns a valid stub questionnaire with correct metadata and empty sections -- no type causes a runtime error
  5. The questionnaire schema (TypeBox) enforces structure for conditional logic, CANS field mapping, and taxonomy-backed options so that malformed questionnaires fail validation
**Plans**: 3 plans in 3 waves

Plans:
- [x] 02-01-PLAN.md — Questionnaire schema, cross-validating loader, AxonQuestionnaires class, and module wiring
- [x] 02-02-PLAN.md — Physician questionnaire data, 48 stub questionnaires, API tests, and data integrity tests
- [x] 02-03-PLAN.md — Gap closure: Add surgical/non-surgical conditional branching to physician questionnaire

### Phase 3: Registry and Credentials
**Goal**: Neuron can register providers and organizations on an NPI-keyed directory, manage credentials with transparent verification status, and search across multiple fields
**Depends on**: Phase 1 (shared types must be stable)
**Requirements**: REGI-01, REGI-02, REGI-03, REGI-04, REGI-05
**Success Criteria** (what must be TRUE):
  1. NPI validation rejects invalid formats (non-10-digit, failing Luhn check with 80840 prefix) and accepts valid NPIs
  2. `AxonRegistry` supports provider registration, Neuron endpoint registration, credential attachment, and credential status updates -- all persisted to a JSON file via atomic write-to-temp-then-rename
  3. Registry search returns results filtered by NPI, name, specialty, provider type, organization, and credential status, with combinable query parameters
  4. Every credential record surfaces `verification_source: 'self_attested'` prominently, with the data model supporting progressive verification levels (self_attested, nppes_matched, state_board_verified)
  5. Restarting the process loads the previously persisted registry state from the JSON file without data loss
**Plans**: 2 plans in 2 waves

Plans:
- [x] 03-01-PLAN.md — Registry TypeBox schemas, NPI Luhn validation, atomic persistence helpers, and derived types
- [x] 03-02-PLAN.md — AxonRegistry class with registration, credential management, multi-field search, persistence tests

### Phase 4: Protocol Specification and Connection Broker
**Goal**: Two CareAgents can complete the full discover-verify-connect handshake through Axon with cryptographic identity verification, replay protection, and an immutable audit trail
**Depends on**: Phase 3 (broker requires RegistryStore interface for credential checks and endpoint lookups)
**Requirements**: PROT-01, PROT-02, PROT-03, PROT-04, PROT-05, BROK-01, BROK-02, BROK-03
**Success Criteria** (what must be TRUE):
  1. Ed25519 key pairs can be generated, and messages signed with one key are verified by the corresponding public key using only `node:crypto` -- with canonical base64url wire format documented and enforced
  2. Protocol messages include a nonce (>=16 bytes) and timestamp, and the broker rejects messages with expired timestamps (>5 minute window) or replayed nonces
  3. `AxonBroker.connect()` completes the handshake sequence: credential check -> endpoint lookup -> connection grant/deny, and denies connections when credentials are expired, suspended, or revoked
  4. Every brokering event (connect attempt, grant, denial, reason) is logged to an append-only audit trail that contains no clinical content
  5. Five protocol specification documents exist in `spec/` (handshake, identity, message, consent, credential) that match the implemented behavior
**Plans**: 3 plans in 3 waves

Plans:
- [x] 04-01-PLAN.md — Protocol primitives: Ed25519 identity, TypeBox message schemas, NonceStore, error types
- [x] 04-02-PLAN.md — Connection broker: AuditTrail, AxonBroker.connect() pipeline, protocol and broker test suites
- [x] 04-03-PLAN.md — Protocol specifications: 5 spec documents (handshake, identity, message, consent, credential)

### Phase 5: Client Facade, Package Exports, and Integration
**Goal**: Authorized consumers (provider-core, patient-core, neuron) can import Axon through purpose-specific entry points and integration-test against a mock Axon server
**Depends on**: Phase 4 (all internal modules must be stable before building the facade)
**Requirements**: AXON-02, AXON-03, CLIT-01, CLIT-02, CLIT-03, INTG-01, INTG-02, INTG-03
**Success Criteria** (what must be TRUE):
  1. `import { AxonRegistry, AxonBroker, AxonTaxonomy, AxonQuestionnaires } from '@careagent/axon'` resolves and all four classes are functional
  2. Consumer-specific entry points work: `@careagent/axon/taxonomy` (for provider-core scope selection), `@careagent/axon/questionnaires`, `@careagent/axon/types` -- each imports only what is needed
  3. The mock Axon server enables provider-core to test taxonomy consumption for `scope.permitted_actions`, patient-core to test provider discovery and connection, and neuron to test registration and endpoint management
  4. The published package has zero entries in the `dependencies` field of `package.json` -- all runtime code is bundled by tsdown
  5. The full compatibility matrix passes: every questionnaire's taxonomy action references resolve, every CANS field mapping is valid, every entry point exports the documented API
**Plans**: 3 plans in 2 waves

Plans:
- [ ] 05-01-PLAN.md — Axon namespace facade, AXON_VERSION, multi-entry tsdown build, package.json subpath exports
- [ ] 05-02-PLAN.md — Mock Axon HTTP server with pre-seeded fixtures and configurable failure scenarios
- [ ] 05-03-PLAN.md — Compatibility matrix tests, consumer integration tests, mock entry wiring

### Phase 5.1: Mock Server HTTP Route Completeness (INSERTED — Gap Closure)
**Goal**: The mock Axon server exposes all documented HTTP routes so consumers can integration-test entirely over HTTP without class imports
**Depends on**: Phase 5 (mock server must exist)
**Requirements**: CLIT-03, REGI-05 (already satisfied — this improves API surface completeness)
**Gap Closure**: Closes INTG-MOCK-01, INTG-MOCK-02, INTG-MOCK-03 from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. `GET /v1/taxonomy/actions?type=physician` returns the taxonomy actions for the given provider type
  2. `GET /v1/questionnaires/:typeId` returns the questionnaire for the given provider type
  3. `GET /v1/registry/search?name=...` works (replacing `/v1/search`), and existing tests are updated to use the correct path
  4. `GET /v1/registry/:npi` returns the registry entry for a specific NPI via direct lookup
**Plans**: 1 plan in 1 wave

Plans:
- [ ] 05.1-01-PLAN.md — Add taxonomy, questionnaire, registry routes; migrate search path to /v1/registry/search with pagination

### Phase 6: Documentation and Release
**Goal**: A developer unfamiliar with Axon can understand its architecture, extend the taxonomy, author new questionnaires, and contribute to the project using published documentation
**Depends on**: Phase 5 (documentation describes the complete, tested implementation)
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06
**Success Criteria** (what must be TRUE):
  1. `docs/architecture.md` explains the component layers, dependency graph, data flow, and design decisions (stateless broker, data-not-code taxonomy, closed participant list)
  2. The five `spec/` protocol documents from Phase 4 are finalized and cross-referenced from a protocol overview in `docs/`
  3. `docs/taxonomy.md` explains the action hierarchy, versioning rules, and the process for proposing new actions through governance
  4. `docs/questionnaire-authoring.md` provides a step-by-step guide for clinical domain experts to author a new provider type questionnaire using the TypeBox schema, conditional logic, and CANS field mapping
  5. `CONTRIBUTING.md` exists with development setup, testing instructions, and the governance model for taxonomy and protocol changes
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 5.1 -> 6
(Phases 2 and 3 are independent and can run in either order or parallel)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Package Foundation and Clinical Action Taxonomy | 3/3 | Complete | 2026-02-21 |
| 2. Questionnaire Repository | 3/3 | Complete | 2026-02-21 |
| 3. Registry and Credentials | 2/2 | Complete | 2026-02-22 |
| 4. Protocol Specification and Connection Broker | 3/3 | Complete    | 2026-02-22 |
| 5. Client Facade, Package Exports, and Integration | 2/3 | Complete    | 2026-02-22 |
| 5.1. Mock Server HTTP Route Completeness | 0/1 | Not started | - |
| 6. Documentation and Release | 0/2 | Not started | - |
