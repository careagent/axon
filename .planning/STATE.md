# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Trusted, open, neutral discovery and handshake layer so any patient CareAgent can find any provider CareAgent and establish a direct peer-to-peer connection -- without touching PHI or remaining in the path after handshake.
**Current focus:** Phase 6: Documentation and Release

## Current Position

Phase: 6 of 6 (Documentation and Release)
Plan: 3 of 3 in current phase
Status: In Progress
Last activity: 2026-02-22 -- Completed 06-01-PLAN.md (Architecture guide and protocol documentation)

Progress: [██████████████████████████████] 97%

## Performance Metrics

**Velocity:**
- Total plans completed: 17
- Average duration: 4min
- Total execution time: 0.98 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3 | 17min | 6min |
| 2 | 3 | 7min | 2min |
| 3 | 2 | 6min | 3min |
| 4 | 3 | 12min | 4min |
| 5 | 3 | 9min | 3min |
| 5.1 | 1 | 2min | 2min |
| 6 | 2 | 6min | 3min |

**Recent Trend:**
- Last 5 plans: 2min, 4min, 3min, 2min, 3min
- Trend: stable

*Updated after each plan completion*
| Phase 02 P01 | 2min | 2 tasks | 7 files |
| Phase 02 P02 | 4min | 2 tasks | 51 files |
| Phase 02 P03 | 1min | 1 tasks | 1 files |
| Phase 03 P01 | 3min | 2 tasks | 6 files |
| Phase 03 P02 | 3min | 2 tasks | 5 files |
| Phase 04 P01 | 2min | 2 tasks | 6 files |
| Phase 04 P02 | 6min | 2 tasks | 7 files |
| Phase 04 P03 | 4min | 2 tasks | 5 files |
| Phase 05 P01 | 2min | 2 tasks | 4 files |
| Phase 05 P02 | 4min | 2 tasks | 4 files |
| Phase 05 P03 | 3min | 2 tasks | 4 files |
| Phase 05.1 P01 | 2min | 2 tasks | 3 files |
| Phase 06 P02 | 3min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 6 phases derived from dependency graph; Phases 2 and 3 are independent (can run in parallel)
- [Roadmap]: Taxonomy granularity must be calibrated in Phase 1 before Phase 2 questionnaire authoring begins
- [01-01]: Removed isolatedDeclarations from tsconfig -- incompatible with TypeBox schema inference; all other strict flags retained
- [01-01]: Used fixedExtension: false in tsdown for .js/.d.ts output matching package.json exports
- [01-01]: TypeBox schemas define taxonomy data shapes; types derived via Static<typeof Schema>
- [01-02]: Mostly 2-level hierarchy with 3 levels only for surgical procedures (perform.surgical.*)
- [01-02]: 6 common cross-type actions explicitly list all 49 types; no inheritance
- [01-02]: Medication prescribing applicable_types includes dental, podiatry, vision_optometry beyond physician/APP
- [01-03]: Replaced createRequire JSON loading with readFileSync + directory walk-up for bundle compatibility
- [01-03]: Non-null assertion in _buildIndexes instead of defensive undefined guard (dead code elimination)
- [01-03]: Schema validation tested directly via TaxonomyVersionValidator for branch coverage
- [Phase 01]: Replaced createRequire JSON loading with readFileSync + directory walk-up for bundle compatibility
- [02-01]: 4-step validation pipeline in loader: schema, taxonomy cross-validation, CANS field validation, show_when ordering
- [02-01]: CANS field allowlist as explicit Set<string> contract between questionnaires and provider-core
- [02-02]: 12 physician questions covering all 7 atomic action categories with show_when conditional branching
- [02-02]: All action_assignments use string answer_value ('true'/'false') not JSON booleans, matching schema contract
- [02-02]: Error path tests use temporary JSON files for loader validation coverage
- [Phase 02-03]: No action_assignments on surgical_subspecialty -- scope actions already granted by surgical_practice
- [03-01]: verification_source is REQUIRED on CredentialRecord (not optional) to surface verification status prominently
- [03-01]: NPI Luhn algorithm uses constant 24 for 80840 prefix instead of prefixing digits
- [03-01]: Atomic persistence uses write-to-temp-then-rename with randomUUID temp file names
- [03-01]: Persistence format wraps entries in { version: '1.0.0', entries: {...} } for future migration support
- [03-02]: Provider type cross-validation against AxonTaxonomy at registration time (validates type IDs exist in taxonomy)
- [03-02]: Conditional spread pattern for optional fields to comply with exactOptionalPropertyTypes
- [03-02]: Linear scan search with AND logic -- sufficient for v1 development scale
- [04-01]: signPayload requires both privateKey and publicKey because Ed25519 JWK import needs both d and x components
- [04-01]: DenialCode as TypeBox Union of 6 string literals following existing project pattern (not enum)
- [04-01]: NonceStore cleanup runs synchronously on each validate() call; no periodic timer for v1
- [04-01]: Protocol barrel export not wired into src/index.ts yet; deferred to Plan 02 when broker is ready
- [04-02]: Protocol types re-exported as type-only from types/index.ts to resolve ambiguous exports with protocol/index.ts
- [04-02]: Endpoint resolution for individual providers goes through first affiliation's organization_npi
- [04-02]: Stale heartbeat threshold set to 5 minutes (300,000ms) for connection gating
- [04-02]: Entry-level credential_status (not individual credentials) checked for connection gating
- [04-03]: Specs written code-first: every section describes actual implemented behavior from Plans 01 and 02
- [04-03]: Consent spec is explicitly descriptive-only with dedicated section explaining HIPAA boundary rationale
- [04-03]: Denial codes in handshake spec mapped to specific pipeline steps for developer clarity
- [05-02]: Mock server uses real AxonRegistry and AxonBroker internally for schema-validated state management
- [05-02]: Fixture NPIs validated against Luhn algorithm: 1245319599 (org), 1679576722, 1376841239, 1003000126 (providers)
- [05-02]: Failure modes short-circuit before broker pipeline for deterministic test behavior
- [05-02]: neuronTokens map tracks registration_id to NPI for route dispatch
- [05-01]: Axon namespace uses `as const` for full readonly type narrowing
- [05-01]: TypeBox runtime schemas re-exported from types/index.ts alongside type-only exports (no ambiguous export conflicts)
- [05-01]: Protocol schemas exported as value exports from types/index.ts while protocol types remain type-only exports to avoid ambiguity
- [05-03]: Self-referencing link (@careagent/axon: link:.) in devDependencies for package-name import resolution in tests
- [05-03]: Compatibility matrix iterates action_assignments.grants[] (not option-level action_id) matching actual schema shape
- [05-03]: Integration tests use valid Luhn NPIs avoiding fixture collisions
- [05.1-01]: Taxonomy route returns full action objects (not just string IDs) for HTTP consumers without class API access
- [05.1-01]: Hard swap /v1/search to /v1/registry/search with no backward compatibility
- [05.1-01]: Route ordering: /v1/registry/search before /v1/registry/:npi to prevent 'search' matching as NPI
- [06-02]: Used actual taxonomy data (8 categories, 61 actions) rather than plan's approximate counts for documentation accuracy
- [06-02]: Questionnaire authoring guide written for clinical domain experts: JSON-first, no TypeBox/TypeScript jargon
- [06-02]: Governance model scoped to practical v1 processes only -- foundation governance deferred to v2

### Pending Todos

1 pending todo -- see .planning/todos/pending/2026-02-21-build-permitted-actions-taxonomy.md

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 06-02-PLAN.md
Resume file: .planning/phases/06-documentation-and-release/06-02-SUMMARY.md
