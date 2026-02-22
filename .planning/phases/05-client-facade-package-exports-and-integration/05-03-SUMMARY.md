---
phase: 05-client-facade-package-exports-and-integration
plan: 03
subsystem: testing
tags: [compatibility-matrix, integration-testing, subpath-exports, mock-server, consumer-patterns]

# Dependency graph
requires:
  - phase: 05-client-facade-package-exports-and-integration
    plan: 01
    provides: multi-entry tsdown build and subpath exports for taxonomy, questionnaires, types
  - phase: 05-client-facade-package-exports-and-integration
    plan: 02
    provides: createMockAxonServer and DEFAULT_FIXTURES for integration testing
provides:
  - Compatibility matrix test suite cross-validating questionnaire-taxonomy data integrity
  - Consumer integration tests for provider-core, patient-core, and neuron import patterns
  - Mock subpath export (./mock) wired into build and package.json
  - All 5 subpath exports verified (., ./taxonomy, ./questionnaires, ./types, ./mock)
affects: [provider-core, patient-core, neuron, phase-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [compatibility-matrix-testing, consumer-integration-testing, self-referencing-package-link]

key-files:
  created:
    - test/compatibility-matrix.test.ts
    - test/integration/entry-points.test.ts
  modified:
    - tsdown.config.ts
    - package.json

key-decisions:
  - "Self-referencing link (@careagent/axon: link:.) in devDependencies for package-name import resolution in tests"
  - "Compatibility matrix iterates action_assignments.grants[] (not option-level action_id) matching actual schema shape"
  - "Integration tests use valid Luhn NPIs (1000000061, 1000000079, 1000000087, 1000000095) avoiding fixture collisions"

patterns-established:
  - "Compatibility matrix pattern: cross-validate data integrity across all modules in a dedicated test suite"
  - "Consumer integration pattern: import via package name to validate exports map resolution chain"

requirements-completed: [INTG-01, INTG-02, INTG-03]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 5 Plan 03: Compatibility Matrix and Consumer Integration Tests Summary

**Compatibility matrix cross-validating taxonomy-questionnaire data integrity, 5-subpath export verification, and consumer integration tests for provider-core, patient-core, and neuron import patterns**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T15:38:55Z
- **Completed:** 2026-02-22T15:42:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Wired mock module into tsdown build (5 entry points total) and added ./mock subpath export to package.json
- Created compatibility matrix test suite validating all questionnaire action references resolve in taxonomy and all CANS fields are in allowlist
- Created entry point API surface tests verifying all 5 subpath exports contain their documented APIs
- Created consumer integration tests: provider-core taxonomy consumption, patient-core search + connect with real Ed25519 crypto, neuron registration + provider management + heartbeat
- All 222 tests pass (207 existing + 7 compatibility matrix + 8 consumer integration)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add mock entry to build and create compatibility matrix tests** - `0cd7263` (feat)
2. **Task 2: Create consumer integration tests using @careagent/axon package imports** - `9e16367` (feat)

## Files Created/Modified
- `tsdown.config.ts` - Added src/mock/index.ts as 5th entry point in multi-entry build
- `package.json` - Added ./mock subpath export and @careagent/axon self-referencing link in devDependencies
- `test/compatibility-matrix.test.ts` - Cross-validation suite: questionnaire-taxonomy action references, CANS field validity, and all 5 entry point API surface checks
- `test/integration/entry-points.test.ts` - Consumer integration tests importing via @careagent/axon package name for all three consumer patterns

## Decisions Made
- Used self-referencing link (`"@careagent/axon": "link:."` in devDependencies) instead of pnpm link --global for cleaner single-repo package-name resolution in tests
- Compatibility matrix tests iterate `question.action_assignments[].grants[]` (actual schema shape) rather than the plan's described `option.action_assignments[].action_id` pattern which did not match the schema
- Integration test NPIs (1000000061, 1000000079, 1000000087, 1000000095) all validated against Luhn algorithm and chosen to avoid collision with fixture NPIs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed compatibility matrix test to match actual schema shape**
- **Found during:** Task 1 (compatibility matrix tests)
- **Issue:** Plan described iterating `question.options[].action_assignments[].action_id` but the actual QuestionSchema has `action_assignments` at the question level with `grants: string[]` (not at the option level with `action_id`)
- **Fix:** Changed iteration to `question.action_assignments[].grants[]` matching the real ActionAssignmentSchema
- **Files modified:** test/compatibility-matrix.test.ts
- **Verification:** All 222 tests pass
- **Committed in:** 0cd7263 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed provider-core test to match getActionsForType return type**
- **Found during:** Task 2 (consumer integration tests)
- **Issue:** Plan's example code used `action.id` on return values of `getActionsForType()`, but this method returns `string[]` (action ID strings), not `TaxonomyAction[]` objects
- **Fix:** Changed to iterate string values directly with `actionId.toMatch(pattern)` instead of `action.id.toMatch(pattern)`
- **Files modified:** test/integration/entry-points.test.ts
- **Verification:** All 222 tests pass
- **Committed in:** 9e16367 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs in plan example code)
**Impact on plan:** Both fixes corrected plan examples to match actual schema/API shapes. No architectural changes.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 complete: all 3 plans executed, all subpath exports working, all integration tests passing
- Package ready for consumption by provider-core, patient-core, and neuron
- Zero runtime dependencies maintained
- 222 total tests covering all modules

## Self-Check: PASSED

- All 4 source/test files verified present
- Commit 0cd7263 verified in git log
- Commit 9e16367 verified in git log

---
*Phase: 05-client-facade-package-exports-and-integration*
*Completed: 2026-02-22*
