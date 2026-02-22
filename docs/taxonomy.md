# Taxonomy Guide

The Axon clinical action taxonomy is a hierarchical vocabulary of provider actions using dot-notation identifiers. It maps what each provider type can do in digital care. The taxonomy is a versioned JSON data file, not hardcoded code -- changes to the taxonomy do not require code changes.

## Action Hierarchy

Actions use dot-notation with mostly two levels. Surgical procedures use three levels.

```
chart
  chart.progress_note
  chart.communication
  chart.history_and_physical
  chart.consultation_note
  chart.operative_note
  chart.discharge_summary
  chart.procedure_note
  chart.referral_letter

order
  order.medication
  order.controlled_substance
  order.laboratory
  order.imaging
  order.procedure
  order.referral
  order.diet
  order.activity_restriction
  order.home_health
  order.durable_medical_equipment

charge
  charge.evaluation_management
  charge.procedure_coding
  charge.modifier_selection
  charge.diagnosis_coding
  charge.cpt_selection

perform
  perform.physical_exam
  perform.injection
  perform.laceration_repair
  perform.biopsy
  perform.incision_drainage
  perform.suturing
  perform.cast_splint
  perform.critical_care
  perform.intubation
  perform.central_line
  perform.lumbar_puncture
  perform.surgical.*              <-- 3-level hierarchy
    perform.surgical.craniotomy
    perform.surgical.appendectomy
    perform.surgical.cholecystectomy
    perform.surgical.hernia_repair
    perform.surgical.joint_replacement
    perform.surgical.spinal_fusion
    perform.surgical.coronary_bypass
    perform.surgical.cardiac_catheterization

interpret
  interpret.imaging_study
  interpret.laboratory_result
  interpret.electrocardiogram
  interpret.pathology_report
  interpret.pulmonary_function
  interpret.electrodiagnostic
  interpret.genetic_test

educate
  educate.patient_education
  educate.medication_counseling
  educate.informed_consent
  educate.discharge_instructions
  educate.risk_benefit_discussion

coordinate
  coordinate.referral
  coordinate.care_transition
  coordinate.insurance_authorization
  coordinate.specialist_consultation
  coordinate.social_services
  coordinate.case_management
  coordinate.multidisciplinary_conference
```

Seven atomic action categories: `chart`, `order`, `charge`, `perform`, `interpret`, `educate`, `coordinate`. Most actions are two levels deep (e.g., `chart.progress_note`, `order.medication`). Only surgical procedures use three levels (`perform.surgical.craniotomy`, `perform.surgical.cardiac_catheterization`, etc.).

The taxonomy contains 61 actions in v1.0.0.

## Provider Types

49 provider types organized into 8 categories. See [data/taxonomy/v1.0.0.json](../data/taxonomy/v1.0.0.json) for the complete list.

| Category | Count | Examples |
|----------|-------|----------|
| medical | 5 | physician, advanced_practice_provider, nursing, nursing_support, pharmacy |
| allied_health | 24 | physical_rehabilitation, occupational_therapy, speech_language, nutrition_dietetics, chiropractic |
| behavioral_health | 1 | behavioral_mental_health |
| dental | 1 | dental |
| diagnostics | 7 | radiology_imaging, laboratory, cardiac_vascular_diagnostics, neurodiagnostics, medical_physics |
| emergency | 1 | emergency_prehospital |
| surgical | 2 | surgical, anesthesia_technology |
| administrative | 8 | health_information_coding, community_public_health, patient_navigation, clinical_research |

Each provider type has an `id`, `display_name`, `category`, and `member_roles` array listing the specific professional roles it encompasses.

## Action Mapping

Every action maps to one or more provider types through the `applicable_types` field.

**Cross-type actions** -- 6 actions are available to all 49 provider types:

| Action | Description |
|--------|-------------|
| `chart.progress_note` | Document patient clinical progress |
| `chart.communication` | Document clinical communications |
| `educate.patient_education` | Provide patient education |
| `educate.discharge_instructions` | Provide discharge instructions |
| `coordinate.referral` | Coordinate referrals |
| `coordinate.care_transition` | Coordinate care transitions |

**Type-restricted actions** -- Most actions are restricted to specific provider types. Examples:

- `perform.surgical.cardiac_catheterization` -- physician only
- `order.controlled_substance` -- physician, advanced_practice_provider
- `order.medication` -- physician, advanced_practice_provider, dental, podiatry, vision_optometry
- `charge.evaluation_management` -- physician, advanced_practice_provider, health_information_coding

Cross-type actions explicitly list all 49 types; there is no inheritance mechanism. Each action's `applicable_types` is the complete list of types that can use it.

## Versioning

The taxonomy uses semantic versioning (semver). Current version: `1.0.0`.

The version string is recorded in a provider's CANS record as `scope.taxonomy_version`.

| Change Type | Version Bump | Rules | Examples |
|-------------|-------------|-------|----------|
| Patch (1.0.x) | Fix typos, clarify descriptions | No action ID or mapping changes | Fix a typo in `display_name` |
| Minor (1.x.0) | Add new actions or provider type mappings | No existing action IDs removed | Add `perform.wound_debridement` |
| Major (x.0.0) | Rename or remove action IDs | Requires migration path | Rename `chart.progress_note` |

The taxonomy version is independent of the npm package version. A package release can ship a taxonomy patch, minor, or major version bump.

## Data File Format

The taxonomy data lives at `data/taxonomy/v1.0.0.json`. Structure:

```json
{
  "version": "1.0.0",
  "effective_date": "2026-02-21",
  "description": "Axon clinical action taxonomy v1.0.0 ...",
  "provider_types": [
    {
      "id": "physician",
      "display_name": "Physician",
      "category": "medical",
      "member_roles": ["MD", "DO"]
    }
  ],
  "actions": [
    {
      "id": "chart.progress_note",
      "atomic_action": "chart",
      "display_name": "Progress Note",
      "description": "Document a patient's clinical progress ...",
      "applicable_types": ["physician", "advanced_practice_provider", "..."],
      "governed_by": ["state_board", "institution"],
      "added_in": "1.0.0"
    },
    {
      "id": "perform.surgical.craniotomy",
      "atomic_action": "perform",
      "display_name": "Craniotomy",
      "description": "Surgical opening of the skull ...",
      "applicable_types": ["physician"],
      "governed_by": ["state_board", "specialty_board"],
      "parent": "perform.surgical",
      "added_in": "1.0.0"
    }
  ]
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Semver version of the taxonomy |
| `effective_date` | string | Date this version took effect |
| `description` | string | Human-readable description |
| `provider_types[]` | array | All provider types with id, display_name, category, member_roles |
| `actions[].id` | string | Dot-notation identifier (e.g., `chart.progress_note`) |
| `actions[].atomic_action` | string | One of the 7 categories: chart, order, charge, perform, interpret, educate, coordinate |
| `actions[].display_name` | string | Human-readable name |
| `actions[].description` | string | What this action represents |
| `actions[].applicable_types` | string[] | Provider type IDs that can perform this action |
| `actions[].governed_by` | string[] | Governing bodies: state_board, institution, specialty_board, federal, professional_association |
| `actions[].parent` | string? | Parent action ID (only for 3-level surgical actions) |
| `actions[].added_in` | string | Taxonomy version when this action was introduced |
| `actions[].deprecated_in` | string? | Taxonomy version when this action was deprecated |

## API Reference

The `AxonTaxonomy` class provides a static API for querying the taxonomy. Data is lazy-loaded on first access.

```typescript
import { AxonTaxonomy } from '@careagent/axon'
```

| Method | Returns | Description |
|--------|---------|-------------|
| `getVersion()` | `string` | Get taxonomy version (e.g., `'1.0.0'`) |
| `validateAction(actionId)` | `boolean` | Check if an action ID exists in the taxonomy |
| `getAction(actionId)` | `TaxonomyAction \| undefined` | Get the full action object by ID |
| `getActionsForType(providerTypeId)` | `string[]` | Get all action IDs available to a provider type |
| `getProviderTypes()` | `ProviderType[]` | Get all provider types |
| `getProviderTypesByCategory(category)` | `ProviderType[]` | Get provider types filtered by category |
| `getType(id)` | `ProviderType \| undefined` | Get a single provider type by ID |

**Example:**

```typescript
AxonTaxonomy.getVersion()                          // '1.0.0'
AxonTaxonomy.validateAction('chart.progress_note')  // true
AxonTaxonomy.validateAction('chart.nonexistent')    // false
AxonTaxonomy.getActionsForType('physician')         // ['chart.progress_note', 'chart.communication', ...]
AxonTaxonomy.getProviderTypesByCategory('medical')  // [{ id: 'physician', ... }, ...]
```

## Extending the Taxonomy

To propose a new action:

1. **Open an issue** describing the clinical action and which provider types need it.
2. **Specify the action ID** using the dot-notation hierarchy. Use an existing category (`chart`, `order`, `charge`, `perform`, `interpret`, `educate`, `coordinate`). Use two levels unless extending the surgical hierarchy.
3. **List `applicable_types`** -- the provider type IDs that can perform this action.
4. **List `governed_by`** -- which governing bodies regulate this action (`state_board`, `institution`, `specialty_board`, `federal`, `professional_association`).
5. **Update the taxonomy data file** (`data/taxonomy/v1.0.0.json` or the next version file). Add the action to the `actions` array.
6. **Run `pnpm test`** to verify data integrity. Tests validate all cross-references between actions and provider types.
7. **Submit a PR** for review per the [governance process](./governance.md).

New actions that do not remove or rename existing IDs are a minor version bump. See versioning rules above.

## See Also

- [docs/architecture.md](./architecture.md) -- System architecture and design decisions
- [docs/questionnaire-authoring.md](./questionnaire-authoring.md) -- How to author provider questionnaires
- [docs/governance.md](./governance.md) -- Governance model for taxonomy and protocol changes
