# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Trusted, open, neutral discovery and handshake layer so any patient CareAgent can find any provider CareAgent and establish a direct peer-to-peer connection -- without touching PHI or remaining in the path after handshake.
**Current focus:** Phase 4: Protocol Specification and Connection Broker

## Current Position

Phase: 4 of 6 (Protocol Specification and Connection Broker)
Plan: 2 of 3 in current phase
Status: In Progress
Last activity: 2026-02-22 -- Completed 04-02-PLAN.md (Connection broker pipeline and audit trail)

Progress: [████████████████████] 67%

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 4min
- Total execution time: 0.63 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3 | 17min | 6min |
| 2 | 3 | 7min | 2min |
| 3 | 2 | 6min | 3min |
| 4 | 2 | 8min | 4min |

**Recent Trend:**
- Last 5 plans: 1min, 3min, 3min, 2min, 6min
- Trend: stable

*Updated after each plan completion*
| Phase 02 P01 | 2min | 2 tasks | 7 files |
| Phase 02 P02 | 4min | 2 tasks | 51 files |
| Phase 02 P03 | 1min | 1 tasks | 1 files |
| Phase 03 P01 | 3min | 2 tasks | 6 files |
| Phase 03 P02 | 3min | 2 tasks | 5 files |
| Phase 04 P01 | 2min | 2 tasks | 6 files |
| Phase 04 P02 | 6min | 2 tasks | 7 files |

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

### Pending Todos

1 pending todo -- see .planning/todos/pending/2026-02-21-build-permitted-actions-taxonomy.md

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 04-02-PLAN.md
Resume file: .planning/phases/04-protocol-specification-and-connection-broker/04-02-SUMMARY.md
