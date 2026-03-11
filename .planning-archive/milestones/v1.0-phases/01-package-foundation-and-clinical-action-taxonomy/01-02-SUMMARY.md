---
phase: 01-package-foundation-and-clinical-action-taxonomy
plan: 02
subsystem: taxonomy
tags: [json, taxonomy, clinical-actions, provider-types, versioned-data]

# Dependency graph
requires:
  - phase: 01-01
    provides: "TypeBox schemas (TaxonomyVersionSchema, TaxonomyActionSchema, ProviderTypeSchema) and JSON loader"
provides:
  - "v1.0.0.json taxonomy data with 49 provider types, 61 actions across 7 atomic categories"
  - "Full Physician action set covering chart, order, charge, perform, interpret, educate, coordinate"
  - "6 common cross-type actions explicitly listed for all 49 provider types"
  - "8 three-level surgical actions under perform.surgical.* with parent references"
affects: [01-03-PLAN, phase-2, phase-3]

# Tech tracking
tech-stack:
  added: []
  patterns: [versioned-json-data, common-cross-type-actions, three-level-surgical-hierarchy, dot-notation-action-ids]

key-files:
  created:
    - data/taxonomy/v1.0.0.json
  modified: []

key-decisions:
  - "Mostly 2-level hierarchy with 3 levels only for surgical procedures (perform.surgical.*) where clinical grouping aids organization"
  - "6 common cross-type actions chosen: chart.progress_note, chart.communication, educate.patient_education, educate.discharge_instructions, coordinate.referral, coordinate.care_transition"
  - "order.medication applicable_types includes dental, podiatry, vision_optometry (prescriptive authority providers beyond physician/APP)"
  - "Surgical actions (perform.surgical.*) restricted to physician-only; intubation also available to emergency_prehospital and APP"

patterns-established:
  - "Common cross-type actions: explicitly list all 49 type IDs in applicable_types (no inheritance)"
  - "Three-level actions: use parent field referencing intermediate group (e.g., perform.surgical)"
  - "governed_by mapping: prescribing uses state_board+federal; documentation uses state_board+institution; surgical uses state_board+specialty_board; billing uses institution+federal"

requirements-completed: [TAXO-01, TAXO-02, TAXO-06, TAXO-07]

# Metrics
duration: 5min
completed: 2026-02-21
---

# Phase 1 Plan 02: Taxonomy Data Summary

**v1.0.0.json taxonomy data with 49 provider types, 61 clinical actions under 7 atomic categories, 6 common cross-type actions for all types, and full Physician action set**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-21T22:58:36Z
- **Completed:** 2026-02-21T23:03:19Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- All 49 provider types from PRD 2.4.3 defined with id, display_name, category, and member_roles
- 61 actions covering all 7 atomic categories: chart (8), order (10), charge (5), perform (19), interpret (7), educate (5), coordinate (7)
- 6 common cross-type actions explicitly list all 49 provider type IDs in applicable_types
- Full Physician action set with clinically appropriate applicable_types mappings for other types (APP, nursing, etc.)
- 8 three-level surgical actions under perform.surgical.* with parent references
- JSON validated against TypeBox TaxonomyVersionSchema from Plan 01

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the 49 provider type definitions with categories and member roles** - `44d5ef2` (feat)
2. **Task 2: Author Physician action set and common cross-type actions with applicable_types mappings** - `1cf26e5` (feat)

## Files Created/Modified
- `data/taxonomy/v1.0.0.json` - Complete versioned taxonomy data file with 49 provider types and 61 actions

## Decisions Made
- **Hierarchy depth:** Mostly 2-level with 3 levels only for surgical procedures (perform.surgical.*) where grouping aids UI organization and clinical sense. Per CONTEXT.md, depth is Claude's discretion.
- **Common cross-type actions (6):** chart.progress_note, chart.communication, educate.patient_education, educate.discharge_instructions, coordinate.referral, coordinate.care_transition -- these are universal actions that every provider type performs.
- **Medication prescribing types:** order.medication includes dental, podiatry, and vision_optometry alongside physician and APP (these types have prescriptive authority in most states).
- **Surgical restriction:** All perform.surgical.* actions restricted to physician-only (consistent with surgical scope of practice).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid provider type reference in order.medication**
- **Found during:** Task 2
- **Issue:** Initially used "dentist_prescriber" as an applicable_type, which is not a valid provider type ID in the 49-type list
- **Fix:** Replaced with "dental", and added "podiatry" and "vision_optometry" as additional prescriptive-authority types
- **Files modified:** data/taxonomy/v1.0.0.json
- **Verification:** Node.js script confirmed all applicable_type references resolve to valid provider type IDs
- **Committed in:** 1cf26e5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor data correction. No scope creep.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Taxonomy data file complete and validated against TypeBox schema
- Ready for Plan 03: AxonTaxonomy API class that loads, indexes, and serves this data
- Provider types categorized for UI grouping via getProviderTypesByCategory()
- Common cross-type actions explicit for CANS.md scope.permitted_actions generation

---
*Phase: 01-package-foundation-and-clinical-action-taxonomy*
*Completed: 2026-02-21*

## Self-Check: PASSED

Created file verified on disk: data/taxonomy/v1.0.0.json. Both task commits (44d5ef2, 1cf26e5) verified in git log.
