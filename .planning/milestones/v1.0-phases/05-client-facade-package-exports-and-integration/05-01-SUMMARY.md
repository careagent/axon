---
phase: 05-client-facade-package-exports-and-integration
plan: 01
subsystem: api
tags: [tsdown, multi-entry, subpath-exports, namespace, esm]

# Dependency graph
requires:
  - phase: 01-taxonomy-data-layer
    provides: taxonomy schemas and AxonTaxonomy class
  - phase: 02-questionnaire-repository
    provides: questionnaire schemas and AxonQuestionnaires class
  - phase: 03-provider-registry
    provides: registry schemas and AxonRegistry class
  - phase: 04-protocol-specification-and-connection-broker
    provides: protocol schemas and AxonBroker class
provides:
  - Axon namespace object with Registry, Broker, Taxonomy, Questionnaires
  - AXON_VERSION export
  - Subpath exports: ./taxonomy, ./questionnaires, ./types
  - Multi-entry tsdown build producing separate chunks per subpath
  - Runtime TypeBox schema re-exports from types subpath
affects: [05-02, 05-03, provider-core, neuron]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-entry-build, subpath-exports, namespace-facade]

key-files:
  created: []
  modified:
    - src/index.ts
    - src/types/index.ts
    - tsdown.config.ts
    - package.json

key-decisions:
  - "Axon namespace uses `as const` for full readonly type narrowing"
  - "TypeBox runtime schemas re-exported from types/index.ts alongside type-only exports (no ambiguous export conflicts)"
  - "Protocol schemas exported as value exports from types/index.ts while protocol types remain type-only exports to avoid ambiguity"

patterns-established:
  - "Subpath export pattern: package.json exports map with import + types conditions"
  - "Namespace facade pattern: const Axon = { Registry, Broker, ... } as const"

requirements-completed: [AXON-02, AXON-03, CLIT-01, CLIT-02]

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 5 Plan 01: Client Facade, Package Exports, and Integration Summary

**Axon namespace facade with AXON_VERSION, multi-entry tsdown build, and four subpath exports (., ./taxonomy, ./questionnaires, ./types)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T15:31:50Z
- **Completed:** 2026-02-22T15:33:36Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `Axon` namespace object grouping Registry, Broker, Taxonomy, Questionnaires for convenient `Axon.Registry` style imports
- Exported `AXON_VERSION` constant from main entry point
- Converted single-entry tsdown build to multi-entry build producing separate chunks for taxonomy, questionnaires, and types
- Added subpath exports to package.json enabling tree-shakeable `@careagent/axon/taxonomy` imports
- Re-exported runtime TypeBox schemas from types subpath for consumers needing runtime validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Axon namespace facade and AXON_VERSION to src/index.ts, extend types entry** - `f110ab2` (feat)
2. **Task 2: Configure multi-entry tsdown build and package.json subpath exports** - `7770592` (feat)

## Files Created/Modified
- `src/index.ts` - Added Axon namespace object, AXON_VERSION, named imports for facade construction
- `src/types/index.ts` - Added runtime TypeBox schema re-exports from all four domains (taxonomy, questionnaires, registry, protocol)
- `tsdown.config.ts` - Converted to multi-entry build with 4 entry points
- `package.json` - Added subpath exports for ./taxonomy, ./questionnaires, ./types with import + types conditions

## Decisions Made
- Axon namespace uses `as const` assertion for full readonly type narrowing on the facade object
- Runtime TypeBox schemas are re-exported from `src/types/index.ts` as value exports alongside existing type-only imports -- no ambiguous export conflicts since TypeScript handles `import type` vs `export` correctly
- Protocol schema values (ConnectRequestSchema etc.) exported from types while protocol types (ConnectRequest etc.) remain `export type` to maintain the existing ambiguity avoidance pattern from Phase 04-02

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Multi-entry build infrastructure ready for Plan 02 to add `./mock` subpath entry
- All four existing subpath exports verified working with runtime checks
- Zero runtime dependencies maintained

## Self-Check: PASSED

- All 4 source files verified present
- All 8 dist output files verified present (4 .js + 4 .d.ts)
- Commit f110ab2 verified in git log
- Commit 7770592 verified in git log

---
*Phase: 05-client-facade-package-exports-and-integration*
*Completed: 2026-02-22*
