# Questionnaire Authoring Guide

A questionnaire determines a provider's digital scope of practice during onboarding. Each provider type has its own questionnaire. The system validates questionnaire data automatically -- this guide covers what a clinical expert needs to author a new questionnaire.

## Questionnaire Structure

A questionnaire is a JSON file with provider metadata and an array of questions. Here is the top-level format, using the physician questionnaire as an example:

```json
{
  "provider_type": "physician",
  "version": "1.0.0",
  "taxonomy_version": "1.0.0",
  "display_name": "Physician Onboarding Questionnaire",
  "description": "Determines digital scope of practice for Physician (MD, DO) CareAgents",
  "questions": [...]
}
```

| Field | Description |
|-------|-------------|
| `provider_type` | The provider type ID from the taxonomy (e.g., `"physician"`, `"nursing"`, `"dental"`) |
| `version` | Questionnaire version using semver (e.g., `"1.0.0"`) |
| `taxonomy_version` | Which taxonomy version this questionnaire targets (must match a published taxonomy version) |
| `display_name` | Human-readable name shown during onboarding |
| `description` | Brief description of the questionnaire's purpose |
| `questions` | Array of question objects (see below) |

## Question Format

Each question collects one piece of information from the provider. Here is a complete question from the physician questionnaire:

```json
{
  "id": "clinical_charting",
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
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier for the question within this questionnaire |
| `text` | Yes | The question text shown to the provider |
| `answer_type` | Yes | `"boolean"` (yes/no) or `"single_select"` (pick one from a list) |
| `required` | Yes | Whether the question must be answered (`true` or `false`) |
| `options` | For single_select | Array of choices (see below) |
| `show_when` | No | Conditional display rule (see Conditional Questions) |
| `cans_field` | Yes | Which field in the provider's CANS record this answer maps to |
| `action_assignments` | No | Which taxonomy actions are granted based on the answer |

**Options for single_select questions:**

```json
{
  "options": [
    {
      "value": "academic",
      "label": "Academic/Teaching",
      "description": "University-affiliated or teaching hospital"
    },
    {
      "value": "private",
      "label": "Private Practice",
      "description": "Solo or group private practice"
    }
  ]
}
```

Each option has a `value` (stored internally), a `label` (displayed to the provider), and an optional `description` (help text).

## Conditional Questions

Some questions should only appear based on a previous answer. Use `show_when` to create branching logic.

**Example:** The physician questionnaire asks "Does your practice include surgical procedures?" If the answer is yes, a follow-up question asks about the surgical subspecialty. If no, the surgical subspecialty question is skipped.

The surgical practice question:

```json
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
}
```

The conditional follow-up (only shown when surgical_practice is answered "true"):

```json
{
  "id": "surgical_subspecialty",
  "text": "What best describes your surgical practice?",
  "answer_type": "single_select",
  "required": true,
  "options": [
    { "value": "general_surgery", "label": "General Surgery", "description": "Broad-spectrum surgical procedures" },
    { "value": "orthopedic", "label": "Orthopedic Surgery", "description": "Musculoskeletal surgical procedures" },
    { "value": "cardiovascular", "label": "Cardiovascular Surgery", "description": "Heart and vascular surgical procedures" },
    { "value": "neurological", "label": "Neurological Surgery", "description": "Brain and nervous system surgical procedures" },
    { "value": "other_surgical", "label": "Other Surgical Specialty", "description": "Other surgical subspecialty not listed above" }
  ],
  "show_when": {
    "question_id": "surgical_practice",
    "equals": "true"
  },
  "cans_field": "provider.subspecialty"
}
```

The `show_when` format:

```json
{
  "question_id": "id_of_prior_question",
  "equals": "expected_answer_value"
}
```

The referenced question must appear **before** the conditional question in the questions array. The system validates this ordering automatically.

## Action Assignments

Action assignments map questionnaire answers to taxonomy actions. When a provider answers a question, the system uses `action_assignments` to determine which actions to grant.

```json
"action_assignments": [
  {
    "answer_value": "true",
    "grants": [
      "chart.progress_note",
      "chart.history_and_physical"
    ]
  }
]
```

| Field | Description |
|-------|-------------|
| `answer_value` | The answer that triggers the grant. Always a string: `"true"`, `"false"`, or an option value like `"academic"` |
| `grants` | Array of taxonomy action IDs that are granted when this answer is selected |

All action IDs in `grants` must exist in the current taxonomy version. The system validates this automatically. To see which actions are available for a provider type, use `AxonTaxonomy.getActionsForType('type_id')`.

**Boolean question example:** A question about clinical charting grants 5 charting actions when answered "true":

```json
{
  "id": "clinical_charting",
  "text": "Do you document clinical encounters?",
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
}
```

When the provider answers "yes" (stored as `"true"`), they receive all 5 charting actions. When they answer "no", no charting actions are granted.

## Valid CANS Fields

Every question must map to a CANS (Competency, Autonomy, Navigation, Scope) field via its `cans_field` property. The 11 valid field paths are:

| Field Path | Purpose |
|------------|---------|
| `provider.licenses` | Professional licenses held |
| `provider.certifications` | Board certifications and specialty credentials |
| `provider.specialty` | Primary clinical specialty |
| `provider.subspecialty` | Clinical subspecialty |
| `provider.organizations` | Organizational affiliations |
| `scope.permitted_actions` | Taxonomy actions the provider can perform |
| `scope.taxonomy_version` | Taxonomy version used for scope determination |
| `scope.practice_setting` | Practice environment (academic, private, hospital, government) |
| `scope.supervision_level` | Supervision role and level |
| `autonomy.default_level` | Default autonomy level for the provider |
| `skills.authorized` | Authorized clinical skills |

Questions that grant taxonomy actions through `action_assignments` typically use `scope.permitted_actions` as their `cans_field`.

## Stub Questionnaires

The physician questionnaire is fully authored with 12 questions covering all 7 action categories. All other 48 provider types have valid stub questionnaires with correct metadata and an empty questions array.

Stub format (using [data/questionnaires/nursing.json](../data/questionnaires/nursing.json) as an example):

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

Clinical experts should use the [physician questionnaire](../data/questionnaires/physician.json) as a template when authoring new questionnaires for other provider types.

## Validation

The system automatically validates questionnaires when they are loaded:

- **Structure** -- The JSON must match the expected format (correct field names, types, and nesting)
- **Taxonomy actions** -- Every action ID in `action_assignments` `grants[]` must exist in the taxonomy
- **CANS fields** -- Every `cans_field` must be one of the 11 valid field paths listed above
- **Conditional ordering** -- Every `show_when` must reference a question that appears earlier in the array

Run `pnpm test` to validate all questionnaires. Validation errors include the questionnaire name, question ID, and what went wrong.

## Step-by-Step: Author a New Questionnaire

1. **Copy the physician questionnaire** ([data/questionnaires/physician.json](../data/questionnaires/physician.json)) as a starting template.

2. **Update `provider_type`** to the target type ID from the taxonomy (e.g., `"nursing"`, `"dental"`, `"physical_rehabilitation"`).

3. **Update `display_name` and `description`** to reflect the new provider type.

4. **Replace questions** with ones appropriate for the provider type. Consider which clinical activities define the provider's digital scope of practice.

5. **Set `cans_field` mappings** for each question using one of the 11 valid CANS field paths.

6. **Add `action_assignments`** referencing valid taxonomy action IDs for the provider type. Check available actions with `AxonTaxonomy.getActionsForType('type_id')` or refer to [docs/taxonomy.md](./taxonomy.md).

7. **Add `show_when`** for any conditional questions. Ensure the referenced question appears earlier in the array.

8. **Save the file** as `data/questionnaires/{type_id}.json` (e.g., `data/questionnaires/nursing.json`).

9. **Run `pnpm test`** to validate the questionnaire against the schema, taxonomy, and CANS field constraints.

10. **Submit a PR** per the [governance process](./governance.md).

## See Also

- [docs/taxonomy.md](./taxonomy.md) -- For valid action IDs and provider type definitions
- [docs/governance.md](./governance.md) -- For the change submission process
- [docs/architecture.md](./architecture.md) -- For system architecture overview
