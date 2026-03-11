# Phase 2: Questionnaire Repository - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Declarative conditional questionnaire system that provider-core consumes during onboarding. Full Physician questionnaire that automatically assigns taxonomy-backed scope based on answers. Valid stubs (zero questions) for all 48 other provider types. Questions are presented one at a time with yes/no and single-select answers — no free-text, no multi-select.

</domain>

<decisions>
## Implementation Decisions

### Conditional logic model
- Questions presented one at a time, designed for minimal typing
- Mostly flat sequences per provider type — no complex branching trees
- Simple single-answer show/hide conditions where needed (e.g., an early answer can hide/show later questions)
- No compound conditions (no AND/OR). One previous answer drives each condition
- Conditions only reference previous answers within the same questionnaire (self-contained)
- When a conditional question is skipped, its CANS field is omitted from output (no defaults)

### Answer types
- Yes/no (boolean) and single-select only
- No free-text input, no multi-select
- Answer options are predefined in the questionnaire data

### Physician questionnaire focus
- Primary purpose: determine scope of practice (what clinical actions this physician can perform digitally)
- Taxonomy actions are **assigned automatically** based on questionnaire answers — the physician never sees or selects action IDs
- Surgical/non-surgical distinction is NOT a primary concern — Axon mediates digital CareAgent interactions, not physical procedures
- Focus on digitally-relevant scope: charting, ordering, interpreting, educating, coordinating

### Stub questionnaires
- All 48 non-Physician types get structurally valid stubs with correct metadata and zero questions
- Schema-valid, empty questions array — honest about being stubs

### Data format
- JSON data files, consistent with taxonomy pattern (data/taxonomy/v1.0.0.json)
- Not TypeScript objects — data is data

### Claude's Discretion
- CANS field mapping cardinality (one-to-one vs one-to-many per question)
- Inline mapping vs separate mapping table structure
- Taxonomy action assignment rules location (inside questionnaire data vs separate)
- CANS field path validation timing (build time vs load time)
- File organization (one file per type vs bundled)
- Versioning strategy for questionnaire data

</decisions>

<specifics>
## Specific Ideas

- "These should be assigned, not selected" — physicians should never interact with taxonomy action IDs. The questionnaire determines scope behind the scenes.
- "We are talking about everything other than performing and doing surgical skills" — digital CareAgent scope is what matters, not physical procedure privileges.
- Questions should be simple enough to answer quickly by text — yes/no preferred, single-select when needed.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-questionnaire-repository*
*Context gathered: 2026-02-21*
