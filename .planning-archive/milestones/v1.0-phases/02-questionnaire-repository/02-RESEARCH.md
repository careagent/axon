# Phase 2: Questionnaire Repository - Research

**Researched:** 2026-02-21
**Domain:** Declarative conditional questionnaire data modeling, TypeBox schema design, JSON data files with cross-domain validation (taxonomy + CANS field paths)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Conditional logic model:**
- Questions presented one at a time, designed for minimal typing
- Mostly flat sequences per provider type -- no complex branching trees
- Simple single-answer show/hide conditions where needed (e.g., an early answer can hide/show later questions)
- No compound conditions (no AND/OR). One previous answer drives each condition
- Conditions only reference previous answers within the same questionnaire (self-contained)
- When a conditional question is skipped, its CANS field is omitted from output (no defaults)

**Answer types:**
- Yes/no (boolean) and single-select only
- No free-text input, no multi-select
- Answer options are predefined in the questionnaire data

**Physician questionnaire focus:**
- Primary purpose: determine scope of practice (what clinical actions this physician can perform digitally)
- Taxonomy actions are **assigned automatically** based on questionnaire answers -- the physician never sees or selects action IDs
- Surgical/non-surgical distinction is NOT a primary concern -- Axon mediates digital CareAgent interactions, not physical procedures
- Focus on digitally-relevant scope: charting, ordering, interpreting, educating, coordinating

**Stub questionnaires:**
- All 48 non-Physician types get structurally valid stubs with correct metadata and zero questions
- Schema-valid, empty questions array -- honest about being stubs

**Data format:**
- JSON data files, consistent with taxonomy pattern (data/taxonomy/v1.0.0.json)
- Not TypeScript objects -- data is data

### Claude's Discretion

- CANS field mapping cardinality (one-to-one vs one-to-many per question)
- Inline mapping vs separate mapping table structure
- Taxonomy action assignment rules location (inside questionnaire data vs separate)
- CANS field path validation timing (build time vs load time)
- File organization (one file per type vs bundled)
- Versioning strategy for questionnaire data

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QUES-01 | TypeBox schema for questionnaire format with conditional logic, CANS field mapping, and taxonomy-backed options | TypeBox schemas following the established Phase 1 pattern: `Type.Object()` for structure, `Type.Union([Type.Literal()])` for enums, `Type.Optional()` for conditional fields. TypeCompiler.Compile() for validation. Simplified from PRD to match CONTEXT.md decisions (boolean + single-select only, no compound conditions). |
| QUES-02 | Full Physician questionnaire with conditional branching, taxonomy-backed scope selection, and CANS field mapping | JSON data file at `data/questionnaires/physician.json`. Questions focused on digitally-relevant scope determination. Taxonomy action assignment rules embedded as declarative mappings (answer value -> action IDs to grant). Conditional branching via simple `show_when` referencing a prior question's answer. |
| QUES-03 | Stub questionnaires for all 48 remaining provider types (valid metadata, empty sections) | Generated or hand-authored JSON files. Each stub has correct `provider_type`, `display_name`, `version`, `taxonomy_version`, and an empty `questions` array. All 48 must pass schema validation. |
| QUES-04 | `AxonQuestionnaires.getForType()` returns the appropriate questionnaire for a given provider type | Static class following `AxonTaxonomy` pattern. Lazy-loads questionnaire data. Builds a `Map<providerTypeId, Questionnaire>` index. Returns validated questionnaire object or undefined. |
| QUES-05 | All taxonomy actions referenced in questionnaire options exist in the current taxonomy version | Cross-validation at load time: iterate all questionnaire option values that reference taxonomy action IDs, call `AxonTaxonomy.validateAction()` for each. Throw on invalid references. This runs once during lazy initialization. |
| QUES-06 | All CANS field paths referenced in questionnaire mappings are valid against the CANS schema | Define a CANS field path allowlist (TypeBox schema or string set) representing valid CANS.md field paths. Validate all `cans_field` references in questionnaire data at load time. |
</phase_requirements>

---

## Summary

Phase 2 builds a declarative questionnaire repository that provider-core consumes during onboarding. The core challenge is designing a JSON data format that captures conditional question logic, maps answers to CANS.md fields, and assigns taxonomy-backed scope actions -- all without imperative code. The user's decisions simplify the PRD's original design significantly: only boolean (yes/no) and single-select answer types, no compound conditions, no free-text, and taxonomy actions are assigned automatically rather than selected by the provider.

The questionnaire schema must be a TypeBox schema (following the Phase 1 pattern) that validates JSON data files at load time. The schema needs to express: (1) questionnaire metadata (provider type, version, display name), (2) an ordered list of questions with answer type and predefined options, (3) simple conditional display rules (show this question only when a prior answer equals a specific value), (4) CANS field path mappings per question, and (5) taxonomy action assignment rules that map answer combinations to granted action IDs. The data format is JSON files in `data/questionnaires/`, mirroring the `data/taxonomy/v1.0.0.json` pattern.

Cross-validation is the most technically interesting aspect: at load time, every taxonomy action ID referenced in questionnaire data must be validated against `AxonTaxonomy.validateAction()`, and every CANS field path must be validated against a defined allowlist. This catches data authoring errors at startup rather than at onboarding runtime. The `AxonQuestionnaires` static class follows the same lazy-initialization pattern as `AxonTaxonomy`.

**Primary recommendation:** JSON data files in `data/questionnaires/` with one file per provider type. TypeBox schema in `src/questionnaires/schemas.ts`. Loader with cross-validation in `src/questionnaires/loader.ts`. Static `AxonQuestionnaires` class mirroring `AxonTaxonomy` API style. All 49 questionnaire files pass schema validation; only the Physician file has actual questions.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @sinclair/typebox | ^0.34.48 | TypeBox schemas for questionnaire data format; TypeCompiler for load-time validation | Already in project devDependencies; established pattern from Phase 1 taxonomy schemas |
| TypeScript | ^5.9.3 | Static typing | Already configured with maximum strictness |
| vitest | ^4.0.18 | Test runner | Already configured with 80% coverage thresholds |

### Supporting

No new dependencies required. Phase 2 uses the same stack as Phase 1. The questionnaire module depends on the taxonomy module (for cross-validation) but introduces no new npm packages.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON data files | TypeScript data files (`.ts` with `export const`) | PRD originally suggested TS files, but CONTEXT.md locks "JSON data files, consistent with taxonomy pattern." JSON is data-not-code, consistent with Phase 1. |
| One file per provider type | Single bundled JSON file with all 49 questionnaires | Single file is simpler to load but grows large as questionnaires are filled out (v2). One-per-type makes authoring and diffing easier. Recommend one-per-type. |
| Load-time cross-validation | Build-time validation script | Load-time is simpler (no build step dependency), catches errors at first use, and matches the taxonomy loader pattern. Build-time could be added later as a CI check. |
| CANS field path allowlist | Full CANS TypeBox schema | Full CANS schema is not defined in Axon (CANS is a provider-core concept). An allowlist of known field paths is sufficient and avoids coupling to provider-core internals. |

**Installation:**
```bash
# No new packages needed -- Phase 1 stack covers everything
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── questionnaires/
│   ├── index.ts          # Re-exports AxonQuestionnaires class + schemas
│   ├── questionnaires.ts # AxonQuestionnaires static class (mirrors AxonTaxonomy pattern)
│   ├── schemas.ts        # TypeBox schemas for Questionnaire, Question, QuestionOption, etc.
│   ├── loader.ts         # JSON loader + schema validation + cross-validation
│   └── cans-fields.ts    # CANS field path allowlist for QUES-06 validation
├── taxonomy/             # (existing from Phase 1)
├── types/
│   └── index.ts          # Add Questionnaire types (Static<typeof Schema>)
└── index.ts              # Add questionnaire re-exports

data/
├── taxonomy/
│   └── v1.0.0.json       # (existing from Phase 1)
└── questionnaires/
    ├── physician.json     # Full questionnaire with conditional branching
    ├── nursing.json       # Stub: valid metadata, empty questions
    ├── dental.json        # Stub
    └── ... (46 more stubs)

test/
├── questionnaires.test.ts      # AxonQuestionnaires API tests
├── questionnaire-data.test.ts  # Data integrity + cross-validation tests
├── taxonomy.test.ts             # (existing)
└── taxonomy-data.test.ts        # (existing)
```

### Pattern 1: Simplified Questionnaire Data Schema (adapted from PRD)

**What:** The PRD defines a complex questionnaire schema with sections, multi-select, text input, and validation rules. CONTEXT.md simplifies this dramatically: boolean + single-select only, no compound conditions, flat sequences, no sections grouping. The schema must reflect these locked decisions.

**When to use:** This is the definitive schema for Phase 2.

```typescript
// src/questionnaires/schemas.ts
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

// --- Answer Type ---
// CONTEXT.md locks: "Yes/no (boolean) and single-select only"
const AnswerTypeSchema = Type.Union([
  Type.Literal('boolean'),       // yes/no
  Type.Literal('single_select'), // pick one from options
])

// --- Question Option (for single_select) ---
const QuestionOptionSchema = Type.Object({
  value: Type.String(),          // Machine-readable value (may be taxonomy action ID)
  label: Type.String(),          // Human-readable label shown to provider
  description: Type.Optional(Type.String()), // Optional clarifying text
})

// --- Show/Hide Condition ---
// CONTEXT.md locks: "One previous answer drives each condition"
// No compound conditions (no AND/OR)
const QuestionConditionSchema = Type.Object({
  question_id: Type.String(),    // ID of a PRIOR question in this questionnaire
  equals: Type.String(),         // The value that must match (single value, not array)
})

// --- Taxonomy Action Assignment Rule ---
// Maps an answer to taxonomy action IDs that should be granted
const ActionAssignmentSchema = Type.Object({
  answer_value: Type.String(),           // The answer value that triggers this assignment
  grants: Type.Array(Type.String()),     // Taxonomy action IDs to grant
})

// --- Question ---
const QuestionSchema = Type.Object({
  id: Type.String(),                     // Unique within this questionnaire
  text: Type.String(),                   // The question text
  answer_type: AnswerTypeSchema,
  required: Type.Boolean(),

  // For single_select questions
  options: Type.Optional(Type.Array(QuestionOptionSchema)),

  // Conditional display (show only when prior answer matches)
  show_when: Type.Optional(QuestionConditionSchema),

  // CANS field mapping
  cans_field: Type.String(),             // CANS field path this answer populates

  // Taxonomy action assignments triggered by this answer
  action_assignments: Type.Optional(Type.Array(ActionAssignmentSchema)),
})

// --- Questionnaire (root) ---
const QuestionnaireSchema = Type.Object({
  provider_type: Type.String(),          // Must match a valid provider type ID
  version: Type.String(),               // Semver (e.g., "1.0.0")
  taxonomy_version: Type.String(),       // Taxonomy version these action refs target
  display_name: Type.String(),
  description: Type.String(),
  questions: Type.Array(QuestionSchema), // Ordered list; empty for stubs
})

const QuestionnaireValidator = TypeCompiler.Compile(QuestionnaireSchema)
```

**Key schema design decisions:**

1. **No `sections` grouping.** CONTEXT.md says "mostly flat sequences." Sections add hierarchy that complicates a flat question list. The CANS field mapping on each question is sufficient to know where data goes. Sections can be added in v2 if needed.

2. **`show_when` instead of `condition` with operators.** CONTEXT.md locks "one previous answer drives each condition" and "no AND/OR." A simple `{ question_id, equals }` object covers all needed cases. The `operator` field from the PRD (`equals`, `includes`, `not_equals`) is unnecessary when there are no compound conditions and no multi-select.

3. **`action_assignments` on the question.** This is the mechanism for "taxonomy actions are assigned automatically based on questionnaire answers." Each question can optionally declare: "when this answer is given, grant these taxonomy action IDs." The physician never sees action IDs -- they answer questions, and the system computes their scope.

4. **`taxonomy_version` at questionnaire root.** Pins which taxonomy version the action ID references target. Cross-validation checks that all action IDs in `action_assignments.grants` exist in this taxonomy version.

### Pattern 2: JSON Data File with Cross-Validation Loader

**What:** Load questionnaire JSON data files with the same pattern as the taxonomy loader, plus cross-validation against taxonomy and CANS field paths.

**When to use:** Loading any questionnaire data file.

```typescript
// src/questionnaires/loader.ts
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { QuestionnaireValidator } from './schemas.js'
import { AxonTaxonomy } from '../taxonomy/taxonomy.js'
import { VALID_CANS_FIELDS } from './cans-fields.js'
import type { Questionnaire } from '../types/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function resolveQuestionnairePath(providerTypeId: string): string {
  // Same walk-up pattern as taxonomy loader
  let current = __dirname
  for (let i = 0; i < 4; i++) {
    const candidate = resolve(current, 'data', 'questionnaires', `${providerTypeId}.json`)
    try {
      readFileSync(candidate, 'utf-8')
      return candidate
    } catch {
      current = dirname(current)
    }
  }
  throw new Error(`Could not locate questionnaire data file for "${providerTypeId}"`)
}

export function loadQuestionnaire(providerTypeId: string): Questionnaire {
  const jsonPath = resolveQuestionnairePath(providerTypeId)
  const data: unknown = JSON.parse(readFileSync(jsonPath, 'utf-8'))

  // Step 1: Schema validation
  if (!QuestionnaireValidator.Check(data)) {
    const errors = [...QuestionnaireValidator.Errors(data)]
    const details = errors.map(e => `  ${e.path}: ${e.message}`).join('\n')
    throw new Error(`Questionnaire validation failed for "${providerTypeId}":\n${details}`)
  }

  // Step 2: Cross-validate taxonomy action references (QUES-05)
  for (const question of data.questions) {
    if (question.action_assignments) {
      for (const assignment of question.action_assignments) {
        for (const actionId of assignment.grants) {
          if (!AxonTaxonomy.validateAction(actionId)) {
            throw new Error(
              `Questionnaire "${providerTypeId}" question "${question.id}" ` +
              `references invalid taxonomy action "${actionId}"`
            )
          }
        }
      }
    }
  }

  // Step 3: Cross-validate CANS field paths (QUES-06)
  for (const question of data.questions) {
    if (!VALID_CANS_FIELDS.has(question.cans_field)) {
      throw new Error(
        `Questionnaire "${providerTypeId}" question "${question.id}" ` +
        `references invalid CANS field path "${question.cans_field}"`
      )
    }
  }

  // Step 4: Validate show_when references (condition points to existing prior question)
  const questionIds = new Set<string>()
  for (const question of data.questions) {
    if (question.show_when) {
      if (!questionIds.has(question.show_when.question_id)) {
        throw new Error(
          `Questionnaire "${providerTypeId}" question "${question.id}" ` +
          `show_when references "${question.show_when.question_id}" ` +
          `which is not a prior question`
        )
      }
    }
    questionIds.add(question.id)
  }

  return data
}
```

### Pattern 3: AxonQuestionnaires Static Class (Mirroring AxonTaxonomy)

**What:** Static class with lazy initialization, following the established pattern.

**When to use:** The public API surface for questionnaire access.

```typescript
// src/questionnaires/questionnaires.ts
import { loadQuestionnaire } from './loader.js'
import { AxonTaxonomy } from '../taxonomy/taxonomy.js'
import type { Questionnaire } from '../types/index.js'

export class AxonQuestionnaires {
  private static _index: Map<string, Questionnaire> | undefined

  private static get index(): Map<string, Questionnaire> {
    if (AxonQuestionnaires._index === undefined) {
      AxonQuestionnaires._index = new Map()
      // Load all questionnaires for all known provider types
      const providerTypes = AxonTaxonomy.getProviderTypes()
      for (const type of providerTypes) {
        const questionnaire = loadQuestionnaire(type.id)
        AxonQuestionnaires._index.set(type.id, questionnaire)
      }
    }
    return AxonQuestionnaires._index
  }

  static getForType(providerTypeId: string): Questionnaire | undefined {
    return AxonQuestionnaires.index.get(providerTypeId)
  }

  static listAvailableTypes(): string[] {
    return [...AxonQuestionnaires.index.keys()]
  }
}
```

### Pattern 4: CANS Field Path Allowlist

**What:** A static set of valid CANS.md field paths that questionnaires can reference. This is the validation target for QUES-06.

**When to use:** During questionnaire cross-validation to ensure all `cans_field` values point to real CANS fields.

```typescript
// src/questionnaires/cans-fields.ts

/**
 * Valid CANS field paths that questionnaire answers can populate.
 *
 * These represent the subset of CANS.md fields that type-specific
 * questionnaires are responsible for. Fields populated by generic
 * onboarding stages (provider.name, provider.npi, etc.) are not
 * included -- those are not driven by questionnaire answers.
 *
 * Source: PRD section 2.4.6 "CANS Fields Populated by Questionnaires"
 */
export const VALID_CANS_FIELDS = new Set([
  // Provider fields that type-specific questionnaires refine
  'provider.licenses',
  'provider.certifications',
  'provider.specialty',
  'provider.subspecialty',
  'provider.organizations',

  // Scope fields -- the primary output of the Physician questionnaire
  'scope.permitted_actions',
  'scope.taxonomy_version',
  'scope.practice_setting',         // academic vs private practice
  'scope.supervision_level',        // independent vs supervised

  // Autonomy defaults that type questionnaires may set
  'autonomy.default_level',

  // Skills authorization
  'skills.authorized',
])
```

**Recommendation on CANS field paths:** The CANS schema is not fully defined in Axon (it lives in provider-core). Rather than coupling to provider-core's internal schema, define an allowlist of known field paths that questionnaires can target. This allowlist is authoritative within Axon. If provider-core changes its CANS schema, the allowlist is the single place to update.

### Pattern 5: Physician Questionnaire Data Structure (JSON)

**What:** Example structure of the full Physician questionnaire JSON file showing conditional branching and action assignment.

```json
{
  "provider_type": "physician",
  "version": "1.0.0",
  "taxonomy_version": "1.0.0",
  "display_name": "Physician Onboarding Questionnaire",
  "description": "Determines digital scope of practice for Physician (MD, DO) CareAgents",
  "questions": [
    {
      "id": "practice_setting",
      "text": "Are you in an academic/teaching practice?",
      "answer_type": "boolean",
      "required": true,
      "cans_field": "scope.practice_setting"
    },
    {
      "id": "supervision_role",
      "text": "Do you supervise residents or fellows?",
      "answer_type": "boolean",
      "required": true,
      "show_when": { "question_id": "practice_setting", "equals": "true" },
      "cans_field": "scope.supervision_level"
    },
    {
      "id": "primary_charting",
      "text": "Do you document clinical encounters (progress notes, H&P, consultation notes)?",
      "answer_type": "boolean",
      "required": true,
      "cans_field": "scope.permitted_actions",
      "action_assignments": [
        {
          "answer_value": "true",
          "grants": [
            "chart.progress_note",
            "chart.history_and_physical",
            "chart.consultation_note",
            "chart.communication",
            "chart.referral_letter"
          ]
        }
      ]
    },
    {
      "id": "performs_procedures",
      "text": "Do you perform clinical procedures (injections, biopsies, laceration repair)?",
      "answer_type": "boolean",
      "required": true,
      "cans_field": "scope.permitted_actions",
      "action_assignments": [
        {
          "answer_value": "true",
          "grants": [
            "perform.physical_exam",
            "perform.injection",
            "perform.laceration_repair",
            "perform.biopsy",
            "perform.incision_drainage",
            "perform.suturing",
            "perform.cast_splint"
          ]
        }
      ]
    },
    {
      "id": "surgical_practice",
      "text": "Does your practice include surgical procedures?",
      "answer_type": "boolean",
      "required": true,
      "cans_field": "scope.permitted_actions",
      "action_assignments": [
        {
          "answer_value": "true",
          "grants": [
            "chart.operative_note",
            "perform.surgical.craniotomy",
            "perform.surgical.appendectomy",
            "perform.surgical.cholecystectomy",
            "perform.surgical.hernia_repair",
            "perform.surgical.joint_replacement",
            "perform.surgical.spinal_fusion",
            "perform.surgical.coronary_bypass",
            "perform.surgical.cardiac_catheterization"
          ]
        }
      ]
    },
    {
      "id": "prescribing",
      "text": "Do you prescribe medications?",
      "answer_type": "boolean",
      "required": true,
      "cans_field": "scope.permitted_actions",
      "action_assignments": [
        {
          "answer_value": "true",
          "grants": [
            "order.medication",
            "educate.medication_counseling"
          ]
        }
      ]
    },
    {
      "id": "controlled_substances",
      "text": "Do you prescribe controlled substances (DEA-scheduled)?",
      "answer_type": "boolean",
      "required": true,
      "show_when": { "question_id": "prescribing", "equals": "true" },
      "cans_field": "scope.permitted_actions",
      "action_assignments": [
        {
          "answer_value": "true",
          "grants": ["order.controlled_substance"]
        }
      ]
    }
  ]
}
```

**Key observations about this data design:**

1. **Actions are assigned, not selected.** The physician answers "Do you prescribe medications?" with yes/no. If yes, `order.medication` and `educate.medication_counseling` are automatically granted. The physician never sees taxonomy action IDs.

2. **`cans_field` can repeat across questions.** Multiple questions map to `scope.permitted_actions`. The consumer (provider-core) aggregates all granted actions into the `scope.permitted_actions` array. This is the "one-to-many" cardinality -- multiple questions contribute to the same CANS field.

3. **Conditional questions use `show_when`.** The `controlled_substances` question only appears if `prescribing` was answered `true`. When skipped, its CANS field contributions are omitted (no defaults).

4. **Boolean answers are stringified.** The `equals` field in `show_when` and `answer_value` in `action_assignments` use `"true"` / `"false"` strings, not JSON booleans. This simplifies the schema (all values are strings) and avoids type discrimination issues in JSON.

### Pattern 6: Stub Questionnaire Structure

**What:** Minimal valid questionnaire for non-Physician provider types.

```json
{
  "provider_type": "nursing",
  "version": "1.0.0",
  "taxonomy_version": "1.0.0",
  "display_name": "Nursing Onboarding Questionnaire",
  "description": "Full questionnaire pending clinical domain expert review",
  "questions": []
}
```

Every stub must:
- Have `provider_type` matching the taxonomy provider type ID exactly
- Have `version` and `taxonomy_version` strings
- Have a meaningful `display_name` and `description`
- Have an empty `questions` array (not missing -- empty)
- Pass TypeBox schema validation

### Anti-Patterns to Avoid

- **Taxonomy action IDs as user-visible labels.** CONTEXT.md is explicit: "physicians should never interact with taxonomy action IDs." Questions ask about clinical activities in plain language; action assignments happen behind the scenes.

- **Complex branching trees.** CONTEXT.md locks "mostly flat sequences." Each questionnaire is a linear list of questions with optional show/hide conditions. No nested question groups, no tree traversal, no multi-path flows.

- **Imperative condition evaluation in data.** Conditions must be purely declarative (`{ question_id, equals }`). No JavaScript expressions, no regex patterns, no function references in the JSON data.

- **Free-text answer types.** CONTEXT.md explicitly excludes free-text. The schema should not include `'text'` or `'number'` answer types even as options -- they would violate the locked decision.

- **Multi-select answer types.** CONTEXT.md explicitly excludes multi-select. Do not include `'multi_select'` in the answer type union.

- **Default values for skipped questions.** CONTEXT.md says "when a conditional question is skipped, its CANS field is omitted from output (no defaults)." The schema must not include a `default_value` field on questions.

- **Storing the 49 stubs as in-memory objects.** Data is data. All questionnaire content lives in JSON files under `data/questionnaires/`. The loader reads them at runtime, just like the taxonomy loader.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Questionnaire JSON schema validation | Manual field-by-field checking | TypeBox TypeCompiler.Compile() | Same pattern as taxonomy schemas; handles nested objects, arrays, optional fields, union types |
| TypeScript types from questionnaire schema | Separate interface declarations | `Static<typeof QuestionnaireSchema>` | Single source of truth; types stay in sync with validators automatically |
| Taxonomy action ID cross-validation | Custom JSON traversal logic | `AxonTaxonomy.validateAction()` | Already exists and is tested; O(1) lookup via Set |
| File discovery (finding all questionnaire JSONs) | Custom glob/readdir logic | Load from known provider type IDs via `AxonTaxonomy.getProviderTypes()` | The provider type list is authoritative; no need to discover files by scanning a directory |
| CANS field path validation | Regex patterns or string parsing | Static `Set<string>` allowlist | Simple, explicit, easy to audit; no regex edge cases |

**Key insight:** The questionnaire system is a data validation pipeline, not a runtime engine. The hard part is ensuring data integrity (schema + cross-validation) at load time. The runtime API is trivially simple (map lookup by provider type ID). Invest effort in the validation pipeline, not in building a questionnaire "engine."

---

## Common Pitfalls

### Pitfall 1: Boolean Values as JSON Booleans vs. Strings

**What goes wrong:** Using JSON `true`/`false` for boolean answers creates type inconsistency with `show_when.equals` and `action_assignments.answer_value`, which are strings. The condition `{ "question_id": "prescribing", "equals": true }` won't match the answer `"true"` (string) and vice versa.

**Why it happens:** Natural to use native JSON booleans for yes/no answers.

**How to avoid:** Standardize all answer values as strings. Boolean questions produce `"true"` or `"false"` string values. All `equals` comparisons and `answer_value` references use strings. This is a schema-level decision, not a runtime quirk.

**Warning signs:** Conditional questions never showing (or always showing) because of type mismatch in equality checks.

### Pitfall 2: Circular or Forward-Referencing Conditions

**What goes wrong:** A `show_when` condition references a question that appears later in the list, or two questions reference each other. This creates impossible evaluation order.

**Why it happens:** Questionnaire authoring error -- questions reordered without updating conditions.

**How to avoid:** Validate at load time that every `show_when.question_id` references a question that appears BEFORE the current question in the array. The loader must track seen question IDs and reject forward references. This is implemented in Pattern 2 above.

**Warning signs:** Loader throws "not a prior question" error.

### Pitfall 3: Missing Stub Files for Provider Types

**What goes wrong:** `AxonQuestionnaires.getForType('some_obscure_type')` throws a file-not-found error because the stub JSON was never created for that provider type.

**Why it happens:** 49 files is a lot; easy to miss one. Provider type IDs have inconsistent naming patterns (underscores, abbreviations).

**How to avoid:** Generate stub files programmatically from `AxonTaxonomy.getProviderTypes()`. Write a test that loads every provider type's questionnaire and asserts success. The test should iterate all 49 known provider type IDs and call `getForType()` for each.

**Warning signs:** Test failure listing missing provider types.

### Pitfall 4: `data/questionnaires/` Path Resolution in Bundled Output

**What goes wrong:** Same issue as Phase 1's taxonomy loader -- relative paths from `src/questionnaires/loader.ts` break when bundled to `dist/`.

**Why it happens:** tsdown changes file locations in the bundle.

**How to avoid:** Use the exact same walk-up directory resolution pattern as the taxonomy loader (`loader.ts` line 17-31). The `data/` directory is shipped alongside `dist/` (configured in `package.json` `"files": ["dist", "data"]`), so the walk-up from the module location finds it.

**Warning signs:** `ENOENT` errors for questionnaire files after `pnpm build`.

### Pitfall 5: CANS Field Path Drift

**What goes wrong:** Questionnaire data references CANS field paths that don't exist in provider-core's actual CANS schema, or provider-core changes its schema and Axon's allowlist is stale.

**Why it happens:** CANS is defined in provider-core, not Axon. There's no shared schema at compile time.

**How to avoid:** The CANS field path allowlist in `cans-fields.ts` is the contract. Document it as "these are the CANS fields that Axon questionnaires are authorized to populate." Provider-core must consume these paths. If provider-core changes its schema, `cans-fields.ts` must be updated. Write a comment block in the file explaining this contract.

**Warning signs:** Provider-core ignoring questionnaire output fields because the paths don't match its CANS schema.

### Pitfall 6: Action Assignment Granularity (Too Few or Too Many Questions)

**What goes wrong:** The Physician questionnaire has too few questions (a single "Are you a physician?" that grants all actions) or too many (one question per taxonomy action ID, defeating the "assigned automatically" purpose).

**Why it happens:** Unclear boundary between "meaningful clinical scope determination" and "tedious checkbox form."

**How to avoid:** Group questions by clinical activity domain (charting, prescribing, procedures, surgical, interpretation, coordination). Each question covers a logical cluster of taxonomy actions. The Physician questionnaire should have roughly 10-20 questions -- enough to meaningfully differentiate scope without being tedious. CONTEXT.md's emphasis on "designed for minimal typing" and "yes/no preferred" means fewer, broader questions are better.

**Warning signs:** Questionnaire with 50+ questions (too granular) or 2-3 questions (too coarse).

---

## Code Examples

Verified patterns from the existing codebase (Phase 1 implementation):

### TypeBox Schema for Questionnaire (Complete)

```typescript
// src/questionnaires/schemas.ts
// Follows exact pattern from src/taxonomy/schemas.ts
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

export const AnswerTypeSchema = Type.Union([
  Type.Literal('boolean'),
  Type.Literal('single_select'),
])

export const QuestionOptionSchema = Type.Object({
  value: Type.String(),
  label: Type.String(),
  description: Type.Optional(Type.String()),
})

export const QuestionConditionSchema = Type.Object({
  question_id: Type.String(),
  equals: Type.String(),
})

export const ActionAssignmentSchema = Type.Object({
  answer_value: Type.String(),
  grants: Type.Array(Type.String()),
})

export const QuestionSchema = Type.Object({
  id: Type.String(),
  text: Type.String(),
  answer_type: AnswerTypeSchema,
  required: Type.Boolean(),
  options: Type.Optional(Type.Array(QuestionOptionSchema)),
  show_when: Type.Optional(QuestionConditionSchema),
  cans_field: Type.String(),
  action_assignments: Type.Optional(Type.Array(ActionAssignmentSchema)),
})

export const QuestionnaireSchema = Type.Object({
  provider_type: Type.String(),
  version: Type.String(),
  taxonomy_version: Type.String(),
  display_name: Type.String(),
  description: Type.String(),
  questions: Type.Array(QuestionSchema),
})

export const QuestionnaireValidator = TypeCompiler.Compile(QuestionnaireSchema)
```

### Loader with Cross-Validation (Complete)

```typescript
// src/questionnaires/loader.ts
// Follows exact pattern from src/taxonomy/loader.ts
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { QuestionnaireValidator } from './schemas.js'
import { AxonTaxonomy } from '../taxonomy/taxonomy.js'
import { VALID_CANS_FIELDS } from './cans-fields.js'
import type { Questionnaire } from '../types/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function resolveQuestionnairesDir(): string {
  let current = __dirname
  for (let i = 0; i < 4; i++) {
    const candidate = resolve(current, 'data', 'questionnaires')
    try {
      readFileSync(resolve(candidate, '.keep'), 'utf-8') // or check dir exists
      return candidate
    } catch {
      current = dirname(current)
    }
  }
  throw new Error('Could not locate questionnaires data directory')
}

export function loadQuestionnaire(providerTypeId: string): Questionnaire {
  const dir = resolveQuestionnairesDir()
  const jsonPath = resolve(dir, `${providerTypeId}.json`)
  const raw = readFileSync(jsonPath, 'utf-8')
  const data: unknown = JSON.parse(raw)

  // 1. Schema validation
  if (!QuestionnaireValidator.Check(data)) {
    const errors = [...QuestionnaireValidator.Errors(data)]
    throw new Error(
      `Questionnaire schema validation failed for "${providerTypeId}": ` +
      errors.map(e => `${e.path}: ${e.message}`).join('; ')
    )
  }

  // 2. Cross-validate taxonomy action references (QUES-05)
  for (const question of data.questions) {
    if (question.action_assignments !== undefined) {
      for (const assignment of question.action_assignments) {
        for (const actionId of assignment.grants) {
          if (!AxonTaxonomy.validateAction(actionId)) {
            throw new Error(
              `Questionnaire "${providerTypeId}" question "${question.id}" ` +
              `references invalid taxonomy action "${actionId}"`
            )
          }
        }
      }
    }
  }

  // 3. Cross-validate CANS field paths (QUES-06)
  for (const question of data.questions) {
    if (!VALID_CANS_FIELDS.has(question.cans_field)) {
      throw new Error(
        `Questionnaire "${providerTypeId}" question "${question.id}" ` +
        `references invalid CANS field path "${question.cans_field}"`
      )
    }
  }

  // 4. Validate show_when references point to prior questions
  const seenIds = new Set<string>()
  for (const question of data.questions) {
    if (question.show_when !== undefined) {
      if (!seenIds.has(question.show_when.question_id)) {
        throw new Error(
          `Questionnaire "${providerTypeId}" question "${question.id}" ` +
          `show_when references "${question.show_when.question_id}" ` +
          `which is not a prior question`
        )
      }
    }
    seenIds.add(question.id)
  }

  return data
}
```

### Data Integrity Test Pattern

```typescript
// test/questionnaire-data.test.ts
import { describe, it, expect } from 'vitest'
import { AxonQuestionnaires } from '../src/questionnaires/questionnaires.js'
import { AxonTaxonomy } from '../src/taxonomy/taxonomy.js'

const ALL_PROVIDER_TYPE_IDS = AxonTaxonomy.getProviderTypes().map(t => t.id)

describe('questionnaire data integrity', () => {
  it('every provider type has a loadable questionnaire', () => {
    for (const typeId of ALL_PROVIDER_TYPE_IDS) {
      const q = AxonQuestionnaires.getForType(typeId)
      expect(q, `Missing questionnaire for ${typeId}`).toBeDefined()
    }
  })

  it('physician questionnaire has questions', () => {
    const q = AxonQuestionnaires.getForType('physician')
    expect(q).toBeDefined()
    expect(q!.questions.length).toBeGreaterThan(0)
  })

  it('stub questionnaires have zero questions', () => {
    for (const typeId of ALL_PROVIDER_TYPE_IDS) {
      if (typeId === 'physician') continue
      const q = AxonQuestionnaires.getForType(typeId)
      expect(q).toBeDefined()
      expect(q!.questions, `Stub ${typeId} should have empty questions`).toHaveLength(0)
    }
  })

  it('every questionnaire provider_type matches its lookup key', () => {
    for (const typeId of ALL_PROVIDER_TYPE_IDS) {
      const q = AxonQuestionnaires.getForType(typeId)
      expect(q!.provider_type).toBe(typeId)
    }
  })

  it('physician questionnaire has conditional branching', () => {
    const q = AxonQuestionnaires.getForType('physician')!
    const conditionalQuestions = q.questions.filter(q => q.show_when !== undefined)
    expect(conditionalQuestions.length).toBeGreaterThan(0)
  })

  it('physician questionnaire assigns taxonomy actions', () => {
    const q = AxonQuestionnaires.getForType('physician')!
    const withAssignments = q.questions.filter(
      q => q.action_assignments !== undefined && q.action_assignments.length > 0
    )
    expect(withAssignments.length).toBeGreaterThan(0)
  })
})
```

---

## Discretionary Recommendations

These address the areas marked as "Claude's Discretion" in CONTEXT.md.

### CANS Field Mapping Cardinality

**Recommendation: One-to-many (multiple questions can map to the same CANS field).**

Multiple questions should be able to target `scope.permitted_actions`. Each question's `action_assignments` contributes additional actions. The consumer (provider-core) aggregates by collecting all granted action IDs into a single array. This is the natural fit for "determine scope via multiple questions."

### Inline Mapping vs Separate Mapping Table

**Recommendation: Inline -- action assignments live on the question object.**

Separating the mapping into a lookup table adds indirection without benefit. When a clinical expert reads the questionnaire JSON, they should see the question, its answers, and what each answer grants -- all in one place. Inline is more readable and more maintainable.

### Taxonomy Action Assignment Rules Location

**Recommendation: Inside the questionnaire data (the `action_assignments` field on each question).**

This keeps the questionnaire self-contained. A separate "rules" file would create a coupling between two data files that must be kept in sync. The questionnaire JSON is the single source of truth for what each answer means.

### CANS Field Path Validation Timing

**Recommendation: Load time (not build time).**

This matches the taxonomy pattern (TypeBox validates at load time, not build time). Load-time validation catches errors on first use. No build-step dependency is needed. If a CI build-time check is wanted later, it can run `AxonQuestionnaires.getForType()` for all types as a test.

### File Organization

**Recommendation: One JSON file per provider type in `data/questionnaires/`.**

49 files, all the same schema. This makes it trivial to add a new questionnaire: copy a stub, fill in questions. Diffing is easy (each file is self-contained). Matches the flat-file philosophy from the architecture research. The physician file will be larger; the 48 stubs will be tiny.

### Versioning Strategy

**Recommendation: `version` field in each questionnaire JSON, plus `taxonomy_version` to pin the referenced taxonomy version.**

Each questionnaire has its own version (independent of the taxonomy version). The `taxonomy_version` field declares which taxonomy the action ID references target. Cross-validation checks action IDs against the pinned taxonomy version. This allows questionnaires to evolve independently while maintaining referential integrity.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TypeScript data files for questionnaires | JSON data files | CONTEXT.md decision (2026-02-21) | Data-not-code pattern; consistent with taxonomy |
| Complex branching trees with nested conditions | Flat question sequences with simple show/hide | CONTEXT.md decision (2026-02-21) | Dramatically simpler schema and evaluation logic |
| Multi-select and free-text answer types | Boolean + single-select only | CONTEXT.md decision (2026-02-21) | Fewer question types; simpler schema; minimal-typing philosophy |
| Provider selects taxonomy actions directly | Automatic assignment based on answers | CONTEXT.md decision (2026-02-21) | Physicians never see action IDs; scope is computed from clinical activity questions |
| PRD `QuestionnaireSection` grouping | No section grouping (flat questions list) | Simplified based on "flat sequences" decision | Each question carries its own `cans_field`; no intermediate grouping layer |
| PRD `condition.operator` with equals/includes/not_equals | Simple `show_when.equals` only | No compound conditions decision | Single equality check; no operator field needed |

---

## Open Questions

1. **Exact set of Physician questionnaire questions**
   - What we know: Questions should cover charting, prescribing, procedures, surgical scope, interpretation, education, coordination, practice setting (academic/private), and supervision level
   - What's unclear: The exact wording, ordering, and grouping of 10-20 questions for clinically meaningful scope determination
   - Recommendation: The planner should create a dedicated task for Physician questionnaire content authoring. Use the taxonomy action list (`AxonTaxonomy.getActionsForType('physician')`) as the source of actions to assign, and group them into logical question clusters. Aim for 10-20 questions.

2. **CANS field path completeness**
   - What we know: PRD section 2.4.6 lists the fields. The allowlist in `cans-fields.ts` covers the fields type-specific questionnaires can populate.
   - What's unclear: Whether the allowlist is exhaustive, or whether provider-core has additional CANS fields not documented in the PRD
   - Recommendation: Start with the PRD-documented fields. The allowlist is easy to extend. Flag this as a potential integration issue for Phase 5.

3. **Single-select question options for non-scope fields**
   - What we know: Some questions (like `practice_setting`) need single-select rather than boolean, with options like "Academic/Teaching", "Private Practice", "Hospital-Employed", "Government/Military"
   - What's unclear: The exact option sets for non-scope single-select questions
   - Recommendation: Design these during the Physician questionnaire authoring task. The schema supports them; the content requires clinical judgment.

4. **How provider-core aggregates questionnaire output**
   - What we know: Provider-core consumes `AxonQuestionnaires.getForType()` and processes answers. Multiple questions can target the same CANS field (e.g., `scope.permitted_actions`).
   - What's unclear: The exact aggregation logic on provider-core's side (union of all granted actions? Override?)
   - Recommendation: Document the contract: "all `action_assignments.grants` arrays for answered questions are unioned into `scope.permitted_actions`." This is Axon's recommendation; provider-core implements it.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/taxonomy/schemas.ts`, `src/taxonomy/loader.ts`, `src/taxonomy/taxonomy.ts` -- established patterns for TypeBox schemas, JSON data loading, and static class API
- Existing taxonomy data: `data/taxonomy/v1.0.0.json` -- all 49 provider type IDs, all taxonomy action IDs, the reference dataset for cross-validation
- PRD.md sections 2.4.4 (Questionnaire Schema), 2.4.5 (v1 Scope), 2.4.6 (CANS Fields) -- the original design that CONTEXT.md decisions refine
- CONTEXT.md Phase 2 decisions -- locked decisions on answer types, conditional logic, data format, and taxonomy action assignment model

### Secondary (MEDIUM confidence)
- Architecture research (`.planning/research/ARCHITECTURE.md`) -- component boundaries, data flow, and recommended project structure
- Phase 1 research (`.planning/phases/01-package-foundation-and-clinical-action-taxonomy/01-RESEARCH.md`) -- TypeBox patterns, loader patterns, static class patterns

### Tertiary (LOW confidence)
- Physician questionnaire question content -- requires clinical domain judgment; the exact question set is a content authoring task, not a technical research finding

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages; reuses Phase 1 stack entirely
- Architecture patterns: HIGH -- directly extends established Phase 1 patterns (TypeBox schemas, JSON loader, static class); no novel architecture
- Schema design: HIGH -- CONTEXT.md decisions simplify the PRD schema dramatically; the resulting schema is straightforward TypeBox
- Cross-validation: HIGH -- taxonomy validation already exists (`AxonTaxonomy.validateAction()`); CANS field validation is a simple Set lookup
- Physician questionnaire content: MEDIUM -- schema is clear, but the actual question content requires clinical judgment during authoring
- CANS field path allowlist: MEDIUM -- based on PRD section 2.4.6, but provider-core may have additional fields not documented

**Research date:** 2026-02-21
**Valid until:** 2026-04-21 (no external dependencies to go stale; validity tied to Phase 1 taxonomy data stability)
