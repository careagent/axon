---
phase: 02-questionnaire-repository
plan: 01
subsystem: questionnaires
tags: [typebox, schema-validation, cans, questionnaire, loader]

# Dependency graph
requires:
  - phase: 01-package-foundation-and-clinical-action-taxonomy
    provides: TypeBox schema patterns, AxonTaxonomy static class, taxonomy data
provides:
  - TypeBox schemas for questionnaire data contract (QuestionnaireSchema, QuestionSchema, etc.)
  - CANS field path allowlist for questionnaire-to-CANS mapping validation
  - Cross-validating loader with 4-step validation pipeline
  - AxonQuestionnaires static class with lazy init and provider type lookup
  - Derived types (Questionnaire, Question, QuestionOption, etc.)
affects: [02-02-questionnaire-data, provider-core]

# Tech tracking
tech-stack:
  added: []
  patterns: [cross-validation-pipeline, cans-field-allowlist]

key-files:
  created:
    - src/questionnaires/schemas.ts
    - src/questionnaires/cans-fields.ts
    - src/questionnaires/loader.ts
    - src/questionnaires/questionnaires.ts
    - src/questionnaires/index.ts
  modified:
    - src/types/index.ts
    - src/index.ts

key-decisions:
  - "4-step validation pipeline in loader: schema, taxonomy cross-validation, CANS field validation, show_when ordering"
  - "CANS field allowlist as explicit Set<string> contract between questionnaires and provider-core"

patterns-established:
  - "Cross-validation pipeline: loader validates schema then cross-references external data sources"
  - "CANS field allowlist: explicit contract between modules via Set membership check"

requirements-completed: [QUES-01, QUES-04, QUES-05, QUES-06]

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 2 Plan 01: Questionnaire Module Infrastructure Summary

**TypeBox schemas with boolean/single_select answer types, 4-step cross-validating loader (schema + taxonomy + CANS + show_when), and AxonQuestionnaires lazy-init API**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T02:30:52Z
- **Completed:** 2026-02-22T02:32:49Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- TypeBox schemas define the complete questionnaire data contract with boolean + single_select answer types, simple show_when conditions, inline action_assignments, and required cans_field per question
- Cross-validating loader performs 4-step validation: schema (TypeBox), taxonomy action IDs (AxonTaxonomy.validateAction), CANS field paths (allowlist), and show_when forward-reference ordering
- AxonQuestionnaires static class provides getForType() and listAvailableTypes() with lazy initialization from AxonTaxonomy.getProviderTypes()
- All derived types available from types/index.ts via Static<typeof Schema>

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TypeBox schemas, CANS field allowlist, and derived types** - `239b7de` (feat)
2. **Task 2: Create cross-validating loader, AxonQuestionnaires class, and module wiring** - `2e7244d` (feat)

## Files Created/Modified
- `src/questionnaires/schemas.ts` - TypeBox schemas for Questionnaire, Question, QuestionOption, QuestionCondition, ActionAssignment, AnswerType with compiled QuestionnaireValidator
- `src/questionnaires/cans-fields.ts` - CANS field path allowlist (11 valid paths) as Set<string>
- `src/questionnaires/loader.ts` - Cross-validating loader with 4-step pipeline (schema, taxonomy, CANS, show_when)
- `src/questionnaires/questionnaires.ts` - AxonQuestionnaires static class with lazy init via AxonTaxonomy.getProviderTypes()
- `src/questionnaires/index.ts` - Module barrel re-exports
- `src/types/index.ts` - Added Questionnaire, Question, QuestionOption, QuestionCondition, ActionAssignment, AnswerType derived types
- `src/index.ts` - Added questionnaires module re-export

## Decisions Made
- 4-step validation pipeline order: schema first (reject structurally invalid data before cross-validation), then taxonomy action IDs, then CANS fields, then show_when ordering -- follows fail-fast principle
- CANS field allowlist as explicit Set<string> rather than regex pattern -- makes the contract between questionnaires and provider-core explicit and auditable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Questionnaire module infrastructure is complete and ready for Plan 02 to populate with JSON data files
- Loader expects files at data/questionnaires/{providerTypeId}.json
- AxonQuestionnaires will load all provider types from taxonomy on first access

## Self-Check: PASSED

All 8 files verified present. Both task commits (239b7de, 2e7244d) verified in git log. TypeScript compilation passes with zero errors.

---
*Phase: 02-questionnaire-repository*
*Completed: 2026-02-21*
