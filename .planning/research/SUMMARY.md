# Project Research Summary

**Project:** @careagent/axon — Healthcare Provider Registry and Trust Infrastructure
**Domain:** Healthcare trust infrastructure — TypeScript pnpm library
**Researched:** 2026-02-21
**Confidence:** HIGH

## Executive Summary

`@careagent/axon` is a zero-runtime-dependency TypeScript library that serves as the shared trust infrastructure for the CareAgent ecosystem. It is not a web service, not a database, and not a framework — it is a library package that three authorized consumers (provider-core, patient-core, neuron) import directly in a pnpm workspace. The product combines four distinct capabilities into a single coherent package: a hierarchical clinical action taxonomy, a conditional onboarding questionnaire repository, an NPI-keyed provider registry, and a stateless connection brokering protocol with Ed25519 cryptographic identity. The architecture is cleanly layered — types first, data-as-JSON second, module implementations third, a thin client facade last — and the dependency graph dictates a strict build order that maps directly to a six-phase roadmap.

The recommended approach is to build exclusively with the Node.js built-in ecosystem: `node:crypto` for Ed25519, `node:fs/promises` for file-backed persistence, `node:crypto.randomUUID()` for message IDs. TypeBox (`@sinclair/typebox ~0.34`) handles schema validation and is bundled into the output by tsdown — so the published package declares zero `dependencies`. The toolchain (TypeScript 5.9, tsdown 0.20, vitest 4.0, oxlint 1.0) is the current-stable void(0) ecosystem standard and is fully compatible with the PRD constraints. The single most important design decision is that taxonomy actions are loaded from versioned JSON files (`data/taxonomy/v1.0.0.json`), not hardcoded as TypeScript enums — this enables clinical domain experts to evolve the vocabulary without code changes.

The top risks are architectural, not technical. The taxonomy granularity must be calibrated before the Physician questionnaire is authored — getting it wrong forces rewrites of both artifacts. The Ed25519 protocol must include replay attack prevention (nonces + timestamp windows) from the start; retrofitting this is a breaking protocol change. Self-attested credentials must be labeled transparently in every API response, with the data model designed for progressive verification (`self_attested` → `nppes_matched` → `state_board_verified`). The three-way version coupling between taxonomy, questionnaires, and CANS.md must be managed with an automated compatibility matrix test from Phase 2 onward. None of these risks are exotic — all have clear, well-documented mitigations.

---

## Key Findings

### Recommended Stack

The stack is locked to the void(0) ecosystem and Node.js built-ins with zero runtime npm dependencies. All devDependencies that are imported at runtime (TypeBox) are bundled into the dist by tsdown, so consumers see zero `dependencies` in `package.json`. The key enabler is `isolatedDeclarations: true` in tsconfig, which allows tsdown to use oxc-transform for declaration emit — roughly 145x faster than `tsc`.

See full details: `.planning/research/STACK.md`

**Core technologies:**
- **TypeScript 5.9.3**: Language — `isolatedDeclarations` support for fast .d.ts generation via oxc-transform
- **Node.js >=22.12.0**: Runtime — PRD constraint; Ed25519, `node:crypto`, `node:fs/promises` all stable
- **pnpm ^10.30.1**: Package manager — PRD constraint; workspace support, strict isolation
- **@sinclair/typebox ~0.34.48**: Schema validation — stays on 0.34.x (1.0 is a breaking ESM-only rename); bundled by tsdown, not a runtime dep
- **tsdown ~0.20.3**: Library bundler — Rolldown/Rust-based, succeeds tsup, handles multi-entry + exports field auto-generation
- **vitest ~4.0.17**: Test runner — native TypeScript/ESM, v8 coverage, 80% threshold per PRD
- **oxlint ^1.0**: Linting — 50-100x faster than ESLint for CI fast path

**Critical version constraints:**
- `@sinclair/typebox` must stay on `~0.34` not `typebox` 1.0 (ESM-only breaking rename, requires ecosystem-wide coordinated migration)
- `node:sqlite` is still experimental in Node 22 — use `node:fs/promises` JSON store for v1
- `tsup` is no longer maintained — tsdown is its direct successor and the correct choice

### Expected Features

The PRD is fully defined. All P1 features are known quantities — no discovery needed. The MVP is scoped to a demo-ready state with one complete provider type (Physician) and stubs for all 48 remaining types.

See full details: `.planning/research/FEATURES.md`

**Must have (table stakes) — all required for v1 demo:**
- NPI validation (Luhn + format) — gateway data integrity at registry boundary
- Clinical action taxonomy v1.0.0 with Physician full action set — unlocks provider-core's broken free-text scope stage
- AxonTaxonomy API (getActionsForType, validateAction, resolveAction) — the primary provider-core integration surface
- Questionnaire schema (TypeBox) + full Physician questionnaire — proves the system end-to-end
- 49 provider type stubs (correct metadata, empty sections) — prevents onboarding breakage for non-Physician types
- Registry data model + in-memory/file-backed storage + multi-field search
- Neuron endpoint directory with health status and heartbeat tracking
- Ed25519 identity exchange + signed protocol messages
- Stateless connection brokering (AxonBroker.connect()) with audit log
- Protocol specification (5 spec documents in `spec/`)
- Multiple entry points + mock Axon server for consumer integration testing

**Should have — add post-demo incrementally (v1.x):**
- Additional provider type questionnaires (requires clinical domain expert review per type)
- Type-specific taxonomy actions for remaining 48 provider types (marked "v2 pending clinical review" in v1)
- Taxonomy governance tooling

**Defer (v2+):**
- External credential verification (NPPES API, state licensing boards) — requires data licensing
- Production-grade registry backend (database, HA, replication)
- Geo-aware provider search (requires geospatial indexing infrastructure)
- X25519 key exchange for forward secrecy
- Mutual TLS for consumer authentication
- Open foundation governance structure

**Anti-features (never build):**
- PHI storage or transit of any kind — would make Axon a HIPAA covered entity by design
- Patient registration on Axon — violates patient sovereignty and creates a surveillance layer
- Session state retention after handshake — contradicts the "transmits and exits" design principle
- Open registration without Neuron-mediated authentication — enables credential spoofing

### Architecture Approach

The architecture is a strict dependency layering: `src/types/` (no deps) → `data/` (static JSON) → `src/taxonomy/` + `src/registry/` (independent, parallel) → `src/protocol/` → `src/broker/` → `src/client/` (thin facade). The client layer is the only public surface; internal modules are independently testable. Taxonomy and provider-type definitions live in versioned JSON data files, not TypeScript enums — this is the "data-not-code" pattern that enables non-engineer contribution to vocabulary governance.

See full details: `.planning/research/ARCHITECTURE.md`

**Major components:**
1. `src/types/` — Shared TypeScript interfaces; no logic, no dependencies; built first; never mutated after Phase 1
2. `src/taxonomy/` — Hierarchical controlled vocabulary engine; loads `data/taxonomy/v1.0.0.json`; O(1) action ID lookup via Map; provides `getActionsForType()`, `validateAction()`, `resolveAction()`
3. `src/questionnaires/` — Declarative conditional questionnaire repository; one TypeScript data file per provider type; references taxonomy action IDs (validated at startup)
4. `src/registry/` — NPI-keyed directory; `RegistryStore` interface with `InMemoryRegistryStore` v1 implementation; NPI Luhn validation; multi-field search; atomic file writes
5. `src/protocol/` — Ed25519 key pair generation, message signing/verification, consent token format; uses only `node:crypto`; decoupled from registry by design
6. `src/broker/` — Stateless handshake sequencing: discover → verify credentials → check endpoint → grant/deny → audit log → exit; holds no session state
7. `src/client/` — Thin public API facade (`AxonRegistry`, `AxonBroker`, `AxonTaxonomy`, `AxonQuestionnaires`); adds auth token validation before delegating; multiple tsdown entry points

**Key patterns:**
- **Data-not-code**: Taxonomy JSON files allow vocabulary updates without code changes or package releases
- **Storage abstraction interface**: `RegistryStore` interface enables v1 in-memory swap with v2 database without registry logic changes
- **Stateless broker**: Every `connect()` call is a complete atomic transaction; no session state; Axon exits after grant
- **Consumer-specific entry points**: `@careagent/axon/taxonomy` for provider-core; full `@careagent/axon` for neuron; prevents unnecessary code loading

### Critical Pitfalls

See full details: `.planning/research/PITFALLS.md`

1. **Taxonomy granularity trap** — Define a "granularity test" before authoring: Can two providers of the same type meaningfully differ at this level? Can a provider select their scope in under 2 minutes? Start with two levels (atomic + specific). Build Physician taxonomy first, run simulated onboarding, calibrate before Phase 2 begins.

2. **Replay attack vulnerability in handshake protocol** — Every challenge-response message MUST include a cryptographically random nonce (≥16 bytes), a timestamp with a 5-minute validity window, and both party identities bound into the signed payload. The broker must maintain a short-lived nonce cache. Design this into the spec before Phase 4 implementation — retrofitting is a breaking protocol change.

3. **Self-attested credentials create false trust** — Surface `verification_source: 'self_attested'` prominently in every API response and search result. Design the credential status flow for progressive verification from day one: `self_attested` → `nppes_matched` → `state_board_verified`. Consider cross-referencing against the NPPES monthly public data download (no API integration required). Never use language implying verification in v1.

4. **Taxonomy-questionnaire-CANS three-way version coupling** — Pin questionnaires to a minimum taxonomy version (`minimum_taxonomy_version` field). Build a compatibility matrix test that runs on every taxonomy or questionnaire change: load every questionnaire, resolve every taxonomy action ID it references, fail if any are missing. Establish the ID immutability rule in Phase 1: once published, action IDs never change within a major version.

5. **Ed25519 key format mismatch** — Choose one canonical wire format (recommend: raw 32-byte public key, base64url-encoded) and document it in `spec/identity.md`. Provide explicit conversion utilities for Node.js DER format. Validate against RFC 8032 test vectors. A mismatch causes signature verification failures that are extremely difficult to debug across consumers.

---

## Implications for Roadmap

The component dependency graph is unambiguous and maps directly to a six-phase structure. Phase 2 (Questionnaires) and Phase 3 (Registry) have no dependency on each other and can be built in parallel. The critical serialization points are: types must be stable before anything else, taxonomy must be stable before questionnaires, registry interface must be stable before broker.

### Phase 1: Types, Taxonomy Data, and Provider Type Definitions

**Rationale:** `src/types/` has zero dependencies and is imported by every other module — it must be built first and treated as locked after this phase. The taxonomy JSON data and provider-type definitions are static artifacts that Phase 2 and Phase 5 both depend on. Granularity decisions made here are expensive to reverse.

**Delivers:** Stable shared TypeScript interfaces; `data/taxonomy/v1.0.0.json` with Physician action set + cross-type actions; `data/provider-types.json` with all 49 type definitions; `src/taxonomy/` module with `getActionsForType()`, `validateAction()`, `resolveAction()`, semver version management

**Addresses:** Clinical action taxonomy, taxonomy versioning, NPI validation (self-contained, no other deps), AxonTaxonomy API

**Avoids:** Taxonomy granularity trap (Pitfall 1) — run simulated onboarding before proceeding; taxonomy ID-hierarchy conflation (Pitfall 14) — treat IDs as opaque stable identifiers from day one; state scope variation (Pitfall 2) — add `practice_authority_dependent` flag to state-variable actions; multi-type provider gap (Pitfall 10) — implement `getActionsForTypes()` plural as union from the start

**Research flag:** Standard patterns — no additional phase research needed. Architecture is fully specified in PRD.

---

### Phase 2: Questionnaire Repository (parallel with Phase 3)

**Rationale:** Questionnaires depend on taxonomy schemas being stable (Phase 1 output) but have no dependency on the registry or protocol. Phase 2 and Phase 3 can proceed in parallel.

**Delivers:** TypeBox questionnaire schema; full Physician questionnaire with conditional branching (surgical/non-surgical, academic/private, subspecialty); 48 stub questionnaires (valid metadata, empty sections); `AxonQuestionnaires.getForType()` API; questionnaire path analyzer for build-time validation

**Addresses:** Questionnaire schema, full Physician questionnaire, 49 provider type stubs, `listAvailableTypes()` completeness

**Avoids:** Questionnaire conditional logic untestability (Pitfall 9) — build path analyzer; require topological ordering of conditions; enumerate Physician branching paths as named test fixtures; taxonomy-questionnaire version coupling (Pitfall 5) — add `minimum_taxonomy_version` field and compatibility matrix test; CANS field drift (Pitfall 15) — validate `cans_field` paths against provider-core schema

**Research flag:** Standard patterns for the TypeBox schema work. The Physician questionnaire content (which specific actions map to which subspecialties) requires clinical domain expert input — this is the one Phase 2 element that may need clinical review, not engineering research.

---

### Phase 3: Registry, Credentials, and Neuron Endpoints (parallel with Phase 2)

**Rationale:** The registry depends only on `src/types/` (Phase 1). It has no dependency on taxonomy or questionnaires. Phase 3 defines the `RegistryStore` interface that Phase 4 (Broker) requires.

**Delivers:** NPI Luhn validation; `RegistryStore` interface + `InMemoryRegistryStore` with atomic JSON file persistence; `CredentialRecord` management with `verification_source` progressive trust model; Neuron endpoint directory with passive heartbeat tracking; multi-field search (NPI, name, specialty, provider type, org, credential status); `registry_status` field for deactivation lifecycle; audit log foundation (JSONL, append-only, separate file from registry data)

**Addresses:** NPI validation, registry data model, registry search, file-backed persistence, Neuron endpoint directory, credential record storage

**Avoids:** File corruption on concurrent writes (Pitfall 6) — write queue serialization + atomic rename (`write to .tmp, then fs.rename()`); self-attested false trust (Pitfall 3) — surface `verification_source` prominently; design progressive trust levels; NPI deactivation not tracked (Pitfall 7) — add `registry_status` and `deactivated_at` fields; heartbeat polling bomb (Pitfall 11) — passive tracking only; on-demand health check during brokering

**Research flag:** Standard patterns — file-backed storage with atomic writes is well-documented. No additional research needed.

---

### Phase 4: Protocol Specification and Connection Broker

**Rationale:** The broker depends on the registry store interface (Phase 3) and the protocol module (which is self-contained with only `node:crypto`). Protocol can start as soon as types are stable; broker cannot finalize until registry interface is stable. This phase also produces the 5 spec documents — write specs alongside implementation, not after.

**Delivers:** `src/protocol/identity.ts` — Ed25519 key pair generation, canonical wire format, DER conversion utilities, RFC 8032 test vectors; `src/protocol/message.ts` — AxonMessage signing/verification with nonce + timestamp; `src/protocol/consent.ts` — consent token format and verification; `src/broker/handshake.ts` — stateless handshake state machine with nonce cache; broker audit logging; `spec/` — 5 protocol specification documents

**Addresses:** Ed25519 identity exchange, signed protocol messages, connection brokering, consent token verification, audit log for brokering events, Axon protocol specification

**Avoids:** Replay attack vulnerability (Pitfall 4) — nonces ≥16 bytes, 5-minute timestamp windows, nonce cache in broker, explicit replay tests; Ed25519 key format mismatch (Pitfall 8) — canonical base64url wire format, DER conversion utilities, RFC 8032 test vectors; bearer token false security (Pitfall 13) — abstract `AuthProvider` interface, `StaticTokenAuthProvider` for v1, document limitations explicitly

**Research flag:** The protocol security properties (nonce design, timestamp window sizing, nonce cache eviction strategy) are well-documented in cryptographic literature but merit careful review during implementation. The spec documents should be reviewed against RFC 8032 and the Trust over IP Foundation P2P trust whitepaper before finalizing.

---

### Phase 5: Client Facade, Package Exports, and Mock Server

**Rationale:** The client facade is a pure aggregation layer — it cannot be built until all four internal modules are stable. This phase produces the public API surface and enables consumer integration testing.

**Delivers:** `src/client/` — `AxonRegistry`, `AxonBroker`, `AxonTaxonomy`, `AxonQuestionnaires` classes with auth token validation; tsdown multi-entry configuration (`index`, `taxonomy`, `questionnaires`, `types`); auto-generated `package.json` exports field; mock Axon server for consumer integration testing

**Addresses:** API client exports, multiple entry points, mock Axon server, zero runtime dependencies verification

**Avoids:** Three-way version coupling (Pitfall 5) — run full compatibility matrix test (load all questionnaires, resolve all taxonomy action IDs, validate all `cans_field` paths); CANS schema drift (Pitfall 15) — cross-repo integration tests

**Research flag:** Standard patterns — tsdown multi-entry configuration is well-documented. No additional research needed.

---

### Phase 6: Documentation and Governance

**Rationale:** Documentation is most useful when written against a complete, tested implementation. Protocol specs (`spec/`) are the exception — they are written in Phase 4 alongside implementation. This phase finalizes developer docs, the questionnaire authoring guide, and the taxonomy governance process.

**Delivers:** `docs/architecture.md`, `docs/protocol.md`, `docs/taxonomy.md`, `docs/questionnaire-authoring.md`, `docs/governance.md`; spec document finalization; questionnaire authoring guide enabling non-engineer clinical contributor workflow

**Addresses:** Open protocol specification ("open foundation" claim), questionnaire governance, taxonomy governance process

**Research flag:** No engineering research needed. This phase is execution, not exploration.

---

### Phase Ordering Rationale

- **Types first** because every module imports from `src/types/`. A type change cascades to all modules; establishing stable types eliminates cross-module churn.
- **Taxonomy before Questionnaires** because questionnaire option values are taxonomy action IDs — questionnaire validation fails without a stable taxonomy to validate against.
- **Registry before Broker** because the broker uses the `RegistryStore` interface for every credential check and endpoint lookup. The interface contract must be stable.
- **Protocol alongside Registry (not after)** because `src/protocol/` has no dependency on `src/registry/`. Starting protocol in Phase 4 rather than Phase 3 is conservative; the only constraint is that types are stable.
- **Client last** because it is a pure facade over all four modules — building it before any module is stable means constant rework.
- **Phases 2 and 3 parallel** because questionnaires depend only on taxonomy (Phase 1) and registry depends only on types (Phase 1). Neither depends on the other.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against official sources and npm registry as of 2026-02-21. tsdown 0.20.3, vitest 4.0.17, TypeScript 5.9.3, pnpm 10.30.1 all current stable. |
| Features | HIGH | PRD is fully defined with 39 requirements. Feature scope is clear. The only uncertainty is Physician questionnaire content (clinical, not technical) and which provider types clinical reviewers prioritize for v1.x. |
| Architecture | HIGH | Based on direct PRD review. All component boundaries, data flows, and dependency relationships are derived from authoritative project documents. No inference required. |
| Pitfalls | HIGH | Top 5 critical pitfalls all have HIGH confidence ratings in PITFALLS.md, backed by authoritative sources (NPPES, RFC 8032, healthcare terminology literature, Node.js documentation). |

**Overall confidence:** HIGH

### Gaps to Address

- **Physician questionnaire clinical content**: Which specific actions map to neurosurgery vs. family medicine vs. oncology is a clinical governance question, not an engineering question. Needs input from a clinical domain expert before Phase 2 implementation. The engineering scaffold (schema, conditional logic, stub) can be built first.

- **State scope-of-practice flags**: The taxonomy needs `practice_authority_dependent` flags on state-variable actions (e.g., `order.medication` for Advanced Practice Providers). Determining which specific actions require this flag for each provider type requires regulatory research (AANP, AMA, state board sources) that is deferred to the phase where each provider type is fully authored.

- **NPPES public data download integration**: The pitfalls research recommends cross-referencing the NPPES monthly CSV for lightweight NPI verification in v1 (no API integration, no runtime dep). This was not scoped in the PRD. Clarify during Phase 3 planning: is this in scope for v1 or deferred?

- **Nonce cache eviction strategy**: The broker needs a short-lived nonce cache to prevent replay attacks. The PRD does not specify the implementation detail (in-memory Map with TTL, LRU cache, etc.). Finalize during Phase 4 spec authoring — this is a design decision, not a research gap.

---

## Sources

### Primary (HIGH confidence)
- `/Users/medomatic/Documents/Projects/axon/PRD.md` — Authoritative product requirements; 39 requirements, 6 phases, full data models, component boundaries
- `/Users/medomatic/Documents/Projects/axon/.planning/PROJECT.md` — Authoritative project context
- [tsdown GitHub / tsdown.dev](https://tsdown.dev) — v0.20.3 verified current; feature set confirmed
- [Vitest 4.0 blog post](https://vitest.dev/blog/vitest-4) — v4.0.17 release confirmed Oct 22 2025
- [TypeScript GitHub releases](https://github.com/microsoft/typescript/releases) — 5.9.3 current stable
- [pnpm blog 2025](https://pnpm.io/blog/2025/12/29/pnpm-in-2025) — v10.30.1 current
- [TypeBox GitHub](https://github.com/sinclairzx81/typebox) — 0.34.48 stable; 1.0 confirmed ESM-only breaking rename
- [Node.js crypto docs](https://nodejs.org/api/crypto.html) — Ed25519 support confirmed
- [NPPES NPI Registry](https://npiregistry.cms.hhs.gov/) — Self-reported credential model baseline
- [CAQH ProView](https://www.caqh.org/solutions/provider-data/credentialing-suite) — Primary source verification as table stakes
- [Da Vinci PDex Plan-Net IG](https://build.fhir.org/ig/HL7/davinci-pdex-plan-net/) — FHIR provider directory standard; updated Jan 2026

### Secondary (MEDIUM confidence)
- [HHS/ASPE Barriers and Opportunities for Improving Interstate Licensure](https://aspe.hhs.gov/) — State-by-state scope of practice variation documented
- [AANP State Practice Environment](https://www.aanp.org/advocacy/state/state-practice-environment) — NP scope variation confirmed
- [Keygen blog — Ed25519 keys in Node.js](https://keygen.sh/blog/how-to-use-hexadecimal-ed25519-keys-in-node/) — DER encoding confusion documented
- [Trust over IP Foundation P2P Trust Whitepaper](https://trustoverip.github.io/WP0010-toip-foundation-whitepaper/trust/p2p_trust/) — P2P trust infrastructure patterns
- [PMC — Constructing a concise medical taxonomy](https://pmc.ncbi.nlm.nih.gov/articles/PMC545132/) — Taxonomy granularity problem documented
- [oxlint v1.0 InfoQ](https://www.infoq.com/news/2025/08/oxlint-v1-released/) — v1 stable confirmed June 2025

### Tertiary (LOW confidence)
- None identified. All critical findings have HIGH or MEDIUM confidence backing.

---

*Research completed: 2026-02-21*
*Ready for roadmap: yes*
