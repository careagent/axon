---
phase: 02-questionnaire-repository
verified: 2026-02-21T22:01:00Z
status: passed
score: 9/9 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 8/9
  gaps_closed:
    - "Physician questionnaire now has surgical/non-surgical conditional branching: surgical_subspecialty question added at array index 9 with show_when { question_id: surgical_practice, equals: true }. surgical_practice at index 8 precedes it — valid ordering, no forward reference."
  gaps_remaining: []
  regressions: []
human_verification: []
---

# Phase 2: Questionnaire Repository Verification Report

**Phase Goal:** Provider-core onboarding can retrieve a complete, conditional questionnaire for Physicians that produces CANS.md-compatible answers, with valid stubs for all other provider types
**Verified:** 2026-02-21T22:01:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (previous status: gaps_found, 8/9)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TypeBox schema validates questionnaire JSON at load time, rejecting malformed data | VERIFIED | `src/questionnaires/schemas.ts` exports `QuestionnaireValidator = TypeCompiler.Compile(QuestionnaireSchema)`. Loader Step 1 calls `QuestionnaireValidator.Check(data)` and throws on failure. Test `loadQuestionnaire throws for invalid schema data` exercises this path. |
| 2 | CANS field path allowlist rejects invalid cans_field references | VERIFIED | `src/questionnaires/cans-fields.ts` exports `VALID_CANS_FIELDS: Set<string>` with 11 valid paths. Loader Step 3 calls `VALID_CANS_FIELDS.has(question.cans_field)`. All 13 physician.json questions use valid CANS fields (scope.practice_setting, scope.supervision_level, scope.permitted_actions, provider.subspecialty). No invalid paths found. |
| 3 | Loader cross-validates taxonomy action IDs against AxonTaxonomy.validateAction() | VERIFIED | Loader Step 2 iterates every `action_assignments.grants` entry and calls `AxonTaxonomy.validateAction(actionId)`. All 40 physician action IDs cross-referenced against `data/taxonomy/v1.0.0.json`. All valid. Test `all taxonomy action IDs in physician questionnaire are valid` proves this. |
| 4 | Loader rejects forward-referencing show_when conditions | VERIFIED | Loader Step 4 maintains `seenIds: Set<string>` and throws if `show_when.question_id` is not already in the set. surgical_practice (index 8) appears before surgical_subspecialty (index 9) — valid. Test `loadQuestionnaire throws for show_when forward reference` exercises this path. |
| 5 | AxonQuestionnaires.getForType() returns a questionnaire or undefined | VERIFIED | `src/questionnaires/questionnaires.ts` implements `static getForType(providerTypeId: string): Questionnaire | undefined` via Map lookup. Returns undefined for unknown types. Returns Questionnaire for all 49 known types. Tested in questionnaires.test.ts. |
| 6 | AxonQuestionnaires.getForType('physician') returns a questionnaire with all three conditional branching paths | VERIFIED | Physician questionnaire has 13 questions and 3 show_when branches: (1) supervision_role shown only when practice_setting=academic, (2) controlled_substances shown only when prescribing=true, (3) surgical_subspecialty shown only when surgical_practice=true. All three branching dimensions (academic/private, prescribing/non-prescribing, surgical/non-surgical) are present. |
| 7 | AxonQuestionnaires.getForType('nursing') (and all 48 non-Physician types) returns a valid stub with empty questions array | VERIFIED | All 49 JSON files present (ls data/questionnaires/ | wc -l = 49). All 48 non-physician files have `questions: []`. All pass QuestionnaireValidator.Check(). Tested by `physician questionnaire has questions; all stubs have zero`. |
| 8 | Every taxonomy action ID in physician questionnaire passes AxonTaxonomy.validateAction() | VERIFIED | 40 action IDs in physician.json all exist in `data/taxonomy/v1.0.0.json` actions array. Enforced at load time by AxonTaxonomy.validateAction() in loader Step 2. Test proves this (QUES-05). |
| 9 | pnpm test passes with >80% coverage | VERIFIED | 77 tests pass across 4 test files. Coverage: 95.32% statements, 91.66% branches, 95.45% functions, 95.19% lines — all above 80% threshold. All questionnaire module files at 100% across all metrics. |

**Score:** 9/9 truths verified

### Gap Closure Detail

**Previously failed truth:** "Physician questionnaire has show_when conditions demonstrating conditional branching (surgical/non-surgical)"

**Resolution:** A `surgical_subspecialty` question was added at array index 9 (after `surgical_practice` at index 8) with:

```json
{
  "id": "surgical_subspecialty",
  "text": "What best describes your surgical practice?",
  "answer_type": "single_select",
  "required": true,
  "show_when": {
    "question_id": "surgical_practice",
    "equals": "true"
  },
  "cans_field": "provider.subspecialty",
  "options": [
    { "value": "general_surgery", "label": "General Surgery", ... },
    { "value": "orthopedic", "label": "Orthopedic Surgery", ... },
    { "value": "cardiovascular", "label": "Cardiovascular Surgery", ... },
    { "value": "neurological", "label": "Neurological Surgery", ... },
    { "value": "other_surgical", "label": "Other Surgical Specialty", ... }
  ]
}
```

This satisfies QUES-02's "surgical/non-surgical" branching requirement:
- `surgical_practice` is always shown (the gate question)
- `surgical_subspecialty` appears only when `surgical_practice` is answered `"true"`
- `provider.subspecialty` is a valid CANS field in the allowlist
- Ordering is correct — no forward reference (surgical_practice at index 8, surgical_subspecialty at index 9)
- The 4-step validation pipeline accepts this question without error
- All 77 tests continue to pass; no regressions introduced

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/questionnaires/schemas.ts` | TypeBox schemas + QuestionnaireValidator | VERIFIED | Exports AnswerTypeSchema, QuestionOptionSchema, QuestionConditionSchema, ActionAssignmentSchema, QuestionSchema, QuestionnaireSchema, QuestionnaireValidator. 53 lines, fully substantive. QuestionConditionSchema enforces show_when structure. |
| `src/questionnaires/cans-fields.ts` | VALID_CANS_FIELDS Set | VERIFIED | Exports VALID_CANS_FIELDS as Set<string> with 11 paths. provider.subspecialty is in the set (used by surgical_subspecialty). |
| `src/questionnaires/loader.ts` | JSON loader with 4-step validation | VERIFIED | Implements all 4 steps: schema, taxonomy cross-validation, CANS field validation, show_when ordering. 112 lines, fully substantive. |
| `src/questionnaires/questionnaires.ts` | AxonQuestionnaires static class with lazy init | VERIFIED | Implements _index, index getter, getForType(), listAvailableTypes(). 67 lines, fully substantive. |
| `src/questionnaires/index.ts` | Module barrel re-exports | VERIFIED | Re-exports all 9 symbols from schemas, cans-fields, loader, questionnaires. |
| `src/types/index.ts` | Questionnaire derived types via Static<> | VERIFIED | Exports Questionnaire, Question, QuestionOption, QuestionCondition, ActionAssignment, AnswerType via Static<typeof Schema>. |
| `src/index.ts` | Package-level questionnaire re-exports | VERIFIED | `export * from './questionnaires/index.js'` present at line 2. |
| `data/questionnaires/physician.json` | Full physician questionnaire with 3 show_when branches | VERIFIED | 13 questions, 40 action IDs, 3 show_when conditions (practice_setting=academic, prescribing=true, surgical_practice=true). All three branching axes now present. |
| `data/questionnaires/nursing.json` (and 47 other stubs) | Valid stub with empty questions | VERIFIED | All 48 non-physician files have empty questions arrays, correct provider_type IDs, correct display_names, taxonomy_version: "1.0.0". |
| `test/questionnaires.test.ts` | AxonQuestionnaires API tests | VERIFIED | 10 tests covering getForType, listAvailableTypes, caching, metadata, conditional questions, action assignments. |
| `test/questionnaire-data.test.ts` | Data integrity and cross-validation tests | VERIFIED | 21 tests covering loading completeness, schema validation, QUES-05, QUES-06, show_when ordering, taxonomy version consistency, answer value types, question ID uniqueness, loader error paths. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/questionnaires/loader.ts` | `src/taxonomy/taxonomy.ts` | `AxonTaxonomy.validateAction()` | WIRED | Line 78: `if (!AxonTaxonomy.validateAction(actionId))`. Import at line 6. |
| `src/questionnaires/loader.ts` | `src/questionnaires/cans-fields.ts` | `VALID_CANS_FIELDS.has()` | WIRED | Line 90: `if (!VALID_CANS_FIELDS.has(question.cans_field))`. Import at line 5. |
| `src/questionnaires/questionnaires.ts` | `src/questionnaires/loader.ts` | `loadQuestionnaire()` in lazy init | WIRED | Line 39: `const questionnaire = loadQuestionnaire(type.id)`. Import at line 1. |
| `src/questionnaires/questionnaires.ts` | `src/taxonomy/taxonomy.ts` | `AxonTaxonomy.getProviderTypes()` | WIRED | Line 36: `const providerTypes = AxonTaxonomy.getProviderTypes()`. Import at line 2. |
| `src/types/index.ts` | `src/questionnaires/schemas.ts` | `Static<typeof QuestionnaireSchema>` | WIRED | Exports Questionnaire, Question, etc. via Static<typeof Schema> pattern. |
| `data/questionnaires/physician.json` | `data/taxonomy/v1.0.0.json` | action_assignments.grants reference taxonomy action IDs | WIRED | All 40 action IDs verified present in taxonomy v1.0.0. Enforced at load time by AxonTaxonomy.validateAction() in loader Step 2. |
| `data/questionnaires/physician.json` (surgical_subspecialty) | `data/questionnaires/physician.json` (surgical_practice) | show_when.question_id | WIRED | surgical_subspecialty.show_when.question_id = "surgical_practice". surgical_practice at index 8 precedes surgical_subspecialty at index 9. Loader Step 4 validates this ordering. |
| `test/questionnaires.test.ts` | `src/questionnaires/questionnaires.ts` | imports and tests AxonQuestionnaires | WIRED | AxonQuestionnaires called 14 times across 10 tests. |
| `test/questionnaire-data.test.ts` | `src/questionnaires/questionnaires.ts` | loads all 49 types and validates data integrity | WIRED | getForType called across all 49 types; all loaded and validated. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| QUES-01 | 02-01-PLAN.md | TypeBox schema for questionnaire format with conditional logic, CANS field mapping, and taxonomy-backed options | SATISFIED | schemas.ts implements QuestionnaireSchema with QuestionConditionSchema (show_when), cans_field required per question, action_assignments.grants array for taxonomy-backed options. QuestionnaireValidator compiled and used at load time. |
| QUES-02 | 02-02-PLAN.md | Full Physician questionnaire with conditional branching (surgical/non-surgical, academic/private practice), taxonomy-backed scope selection, and CANS field mapping | SATISFIED | Three show_when branches: supervision_role (academic), controlled_substances (prescribing), surgical_subspecialty (surgical). Both named branching axes (surgical/non-surgical and academic/private practice) are present. 40 taxonomy action IDs validated. All CANS fields valid. |
| QUES-03 | 02-02-PLAN.md | Stub questionnaires for all 48 remaining provider types (valid metadata, empty sections) | SATISFIED | All 48 non-physician JSON files present with correct provider_type IDs, display_names from taxonomy, taxonomy_version: "1.0.0", and empty questions arrays. |
| QUES-04 | 02-01-PLAN.md | AxonQuestionnaires.getForType() returns the appropriate questionnaire for a given provider type | SATISFIED | getForType() returns Questionnaire for all 49 known types, returns undefined for unknown types. Lazy initialization via AxonTaxonomy.getProviderTypes(). Tested in questionnaires.test.ts. |
| QUES-05 | 02-01-PLAN.md, 02-02-PLAN.md | All taxonomy actions referenced in questionnaire options exist in the current taxonomy version | SATISFIED | Loader Step 2 enforces this at load time via AxonTaxonomy.validateAction(). All 40 physician action IDs independently verified against taxonomy v1.0.0 actions array. Test proves this. |
| QUES-06 | 02-01-PLAN.md, 02-02-PLAN.md | All CANS field paths referenced in questionnaire mappings are valid against the CANS schema | SATISFIED | Loader Step 3 enforces this at load time via VALID_CANS_FIELDS.has(). All 4 CANS fields used by physician.json (scope.practice_setting, scope.supervision_level, scope.permitted_actions, provider.subspecialty) are in the 11-path allowlist. Test proves this across all 49 questionnaires. |

**Orphaned requirements:** None. All QUES-01 through QUES-06 are claimed by plans in this phase and fully satisfied.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found | — | — | — |

No TODO, FIXME, placeholder comments, or empty implementations found. No stub return values in implementation files. The new surgical_subspecialty question is fully authored with 5 meaningful options, a valid cans_field, and correct show_when wiring.

---

### Human Verification Required

None. All verification items were determinable programmatically.

---

### Re-Verification Summary

**Previous status:** gaps_found (8/9)
**Current status:** passed (9/9)

**Gap closed:** The surgical/non-surgical conditional branching requirement (QUES-02) is now satisfied. The `surgical_subspecialty` question was added to `data/questionnaires/physician.json` at array index 9, immediately after `surgical_practice` (index 8), with `show_when: { question_id: "surgical_practice", equals: "true" }`. Its cans_field `provider.subspecialty` is valid in the allowlist. The loader's forward-reference check accepts it because surgical_practice precedes it in the array.

**Regressions:** None. All 77 tests continue to pass. Coverage remains above 80% on all metrics (95.32% statements, 91.66% branches). No previously passing truth was affected by the addition of the 13th question.

---

_Verified: 2026-02-21T22:01:00Z_
_Verifier: Claude (gsd-verifier)_
