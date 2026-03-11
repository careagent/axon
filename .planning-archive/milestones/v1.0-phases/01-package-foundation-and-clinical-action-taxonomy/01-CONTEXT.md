# Phase 1: Package Foundation and Clinical Action Taxonomy - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the @careagent/axon package (pnpm, TypeScript, tsdown, vitest, zero runtime npm deps) and build the hierarchical clinical action vocabulary with full Physician taxonomy data as a versioned JSON data file. The taxonomy defines what actions exist and which of the 49 provider types can perform them. Questionnaires, registry, protocol, and documentation are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Taxonomy hierarchy design
- Seven atomic action categories (chart, order, charge, perform, interpret, educate, coordinate) are **fixed for v1** — no new top-level categories
- Hierarchy depth is Claude's discretion — pick what fits the Physician action set (could be 2 or 3 levels deep where clinically meaningful)
- MD and DO are treated as a **single 'physician' type** with identical action sets; credential distinction lives in the registry (Phase 3)
- Common cross-type actions are a **fixed curated set** — explicitly defined, not derived per-category
- Taxonomy represents **capability eligibility by provider type**, not assigned scope for an individual provider. Who assigns/selects actions (self, institution, governing body) is a policy question for onboarding (Phase 2), not the taxonomy
- Each action includes a `governed_by` field indicating **which authorities govern it** (array — an action can be governed by multiple bodies, e.g., state board + DEA for prescribing)
- Every leaf action has an **ID + human-readable description** — self-documenting for consuming UIs

### Taxonomy data shape
- **Single taxonomy file** (`data/taxonomy/v1.0.0.json`) with a version field inside — single version runtime, not multi-version
- CANS.md stamps `scope.taxonomy_version` as a string for the version active at onboarding time
- Provider types live **inside the taxonomy JSON** — one self-contained file with actions, provider types, and mappings
- Provider types are **grouped under categories** (medical, dental, behavioral health, allied health, etc.) — structured for UI grouping
- Common actions are **explicitly listed per type** — no implicit inheritance; every type's action list is complete and self-contained (redundant but explicit)

### API surface design
- Full introspection: `getProviderTypes()`, `getProviderTypesByCategory()`, `getType(id)` in addition to the required `getActionsForType()` and `validateAction()`
- `getActionsForType()` returns **action IDs only** (string[]) — keeps CANS.md lightweight. Full action objects available via separate method (e.g., `getAction(id)`)
- API style and version access pattern are Claude's discretion (static class vs instantiated, property vs method)

### Package tooling choices
- **Domain-organized source**: `src/taxonomy/`, `src/types/`, `src/index.ts` — scales for Phase 2+ modules
- **Maximum TypeScript strictness**: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **TypeBox introduced in Phase 1** for taxonomy type definitions — establishes the runtime-validatable pattern early
- Test scope is Claude's discretion (data integrity tests, API tests, or both)

### Claude's Discretion
- Taxonomy hierarchy depth (2 or 3 levels, based on clinical fit)
- AxonTaxonomy API style (static class vs instantiated class)
- Version access (property vs method)
- Test strategy scope (data validation + API, or API-only)

</decisions>

<specifics>
## Specific Ideas

- Taxonomy is about capability eligibility, not individual assignment — "Physicians *can* perform these actions" not "Dr. Smith *is authorized* for these actions"
- The `governed_by` array should use known authority types: state_board, institution, specialty_board, federal (DEA, CMS), professional_association
- Provider type categories should mirror standard healthcare workforce classifications (medical, dental, behavioral health, allied health, etc.)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-package-foundation-and-clinical-action-taxonomy*
*Context gathered: 2026-02-21*
