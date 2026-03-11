---
phase: 03-registry-and-credentials
plan: 01
subsystem: registry
tags: [typebox, npi, luhn, persistence, atomic-write]

# Dependency graph
requires:
  - phase: 01-package-foundation-and-clinical-action-taxonomy
    provides: TypeBox schema patterns, Static<typeof Schema> type derivation, project build toolchain
provides:
  - TypeBox schemas for all registry data types (RegistryEntry, CredentialRecord, NeuronEndpoint, OrganizationAffiliation, RegistrySearchQuery)
  - Compiled validators (RegistryEntryValidator, CredentialRecordValidator, NeuronEndpointValidator, RegistrySearchQueryValidator)
  - NPI Luhn validation function (validateNPI)
  - Atomic file persistence helpers (persistRegistry, loadRegistry)
  - Registry type exports from src/types/index.ts
affects: [03-02, 04-protocol, 05-facade]

# Tech tracking
tech-stack:
  added: [node:fs, node:path, node:crypto]
  patterns: [atomic-write-to-temp-then-rename, luhn-check-digit-with-prefix-constant, union-literal-status-enums]

key-files:
  created:
    - src/registry/schemas.ts
    - src/registry/npi.ts
    - src/registry/persistence.ts
    - src/registry/index.ts
    - test/npi.test.ts
  modified:
    - src/types/index.ts

key-decisions:
  - "verification_source is REQUIRED on CredentialRecord (not optional) to surface verification status prominently"
  - "NPI Luhn algorithm uses constant 24 for 80840 prefix instead of prefixing digits"
  - "Atomic persistence uses write-to-temp-then-rename with randomUUID temp file names"
  - "Persistence format wraps entries in { version: '1.0.0', entries: {...} } for future migration support"

patterns-established:
  - "Registry union literal enums: Type.Union([Type.Literal('value1'), ...]) for status/type fields"
  - "Atomic file write: writeFileSync to .tmp then renameSync to target path"
  - "Load-time validation: RegistryEntryValidator.Check() on each deserialized entry"

requirements-completed: [REGI-01, REGI-02]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 3 Plan 01: Registry Schemas, NPI Validation, and Persistence Summary

**TypeBox schemas for registry data model with NPI Luhn validation and atomic write-to-temp-then-rename persistence helpers**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T11:44:28Z
- **Completed:** 2026-02-22T11:47:26Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- TypeBox schemas defining RegistryEntry, CredentialRecord, NeuronEndpoint, OrganizationAffiliation, RegistrySearchQuery with compiled validators
- NPI validation implementing Luhn check digit algorithm with 80840 prefix constant (validates CMS example 1234567893)
- Atomic persistence helpers using write-to-temp-then-rename pattern with randomUUID temp file names
- Comprehensive NPI test suite with 14 test cases covering valid NPIs, invalid formats, and Luhn check failures
- Registry types exported from src/types/index.ts via Static<typeof Schema> pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Registry TypeBox schemas, NPI validation, and persistence helpers** - `b07d759` (feat)
2. **Task 2: NPI validation test suite** - `cd6ea9b` (test)

## Files Created/Modified
- `src/registry/schemas.ts` - TypeBox schemas for all registry data types with compiled validators
- `src/registry/npi.ts` - NPI Luhn validation with 80840 prefix constant
- `src/registry/persistence.ts` - Atomic JSON file read/write with write-to-temp-then-rename
- `src/registry/index.ts` - Module barrel re-exporting schemas, NPI validator, persistence helpers
- `src/types/index.ts` - Added 8 registry type exports (RegistryEntry, NeuronEndpoint, CredentialRecord, etc.)
- `test/npi.test.ts` - 14 NPI validation tests (valid NPIs, invalid formats, Luhn failures)

## Decisions Made
- **verification_source is REQUIRED:** Made verification_source a required field on CredentialRecord rather than optional, ensuring every credential record surfaces its verification status prominently
- **Constant 24 for Luhn prefix:** Used the constant-24 shortcut instead of literally prefixing 80840 digits, following CMS specification
- **Atomic persistence format:** Wrapped entries in `{ version: '1.0.0', entries: {...} }` to enable future format migrations
- **Synchronous file operations:** All persistence uses synchronous Node.js fs APIs (writeFileSync, renameSync, readFileSync) for simplicity at v1 development scale

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected invalid NPI test data**
- **Found during:** Task 2 (NPI validation test suite)
- **Issue:** Plan specified NPI `1114025222` as a valid NPI, but Luhn computation shows it has an incorrect check digit (expected 8, actual 2)
- **Fix:** Replaced with verified valid NPI `1114025228` (correct check digit computed via Luhn algorithm)
- **Files modified:** test/npi.test.ts
- **Verification:** All 14 NPI tests pass including CMS example 1234567893
- **Committed in:** cd6ea9b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test data)
**Impact on plan:** Minor test data correction. Algorithm implementation unchanged. No scope creep.

## Issues Encountered
None beyond the test data correction documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All registry schemas, validators, NPI validation, and persistence helpers are ready for Plan 02
- Plan 02 (AxonRegistry class) can import schemas from `./schemas.js`, validateNPI from `./npi.js`, and persistence from `./persistence.js`
- Types are available from `../types/index.js` for the registry class implementation

## Self-Check: PASSED

- All 6 files verified present on disk
- Both task commits (b07d759, cd6ea9b) verified in git history
- Build produces valid dist with zero errors
- All 91 tests pass (14 NPI + 77 existing)

---
*Phase: 03-registry-and-credentials*
*Completed: 2026-02-22*
