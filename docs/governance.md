# Governance Model

Axon governance covers changes to the clinical action taxonomy and the communication protocol. This document describes the practical processes for proposing, reviewing, and approving changes in v1.

Foundation-level governance (organizational structure, board, formal decision-making) is planned for v2.

## Taxonomy Changes

The taxonomy defines provider actions and their mappings to provider types. Changes follow this process:

**1. Open an issue** with:

| Field | Description |
|-------|-------------|
| Action ID | Dot-notation identifier (e.g., `perform.wound_debridement`) |
| Display name | Human-readable name |
| Description | What the action represents clinically |
| `applicable_types` | Which provider type IDs can perform this action |
| `governed_by` | Governing bodies (`state_board`, `institution`, `specialty_board`, `federal`, `professional_association`) |
| Clinical justification | Why this action is needed and how it differs from existing actions |

**2. Clinical domain review.** Provider-type-specific actions (those restricted to a subset of types) require review by someone with domain knowledge of the affected provider types. Cross-type actions that apply to all 49 types require broader review.

**3. Version bump.** Apply [semver rules](./taxonomy.md#versioning):

- Adding a new action or expanding `applicable_types`: minor version bump
- Fixing a typo or clarifying a description: patch version bump
- Renaming or removing an action ID: major version bump (requires migration path)

**4. PR review and merge.** The PR must:

- Add the action to `data/taxonomy/v1.0.0.json` (or the next version file)
- Pass `pnpm test` (validates cross-references and schema integrity)
- Include the clinical justification in the PR description

## Protocol Changes

The Axon protocol defines message formats, identity verification, and the handshake process. Protocol specifications live in `spec/`. Changes follow this process:

**1. Open an issue** with:

- Which specification is affected (`spec/handshake.md`, `spec/identity.md`, `spec/message.md`, `spec/consent.md`, `spec/credential.md`)
- What the proposed change is
- Backward compatibility analysis

**2. Discussion before code.** Protocol changes affect all Axon participants (patient-core, provider-core, neuron). Changes must be discussed in the issue before implementation begins.

**3. Version bump.** Protocol changes follow semver:

- Non-breaking extensions (new optional fields, new message types): minor version bump
- Breaking changes (removing fields, changing required fields, altering handshake flow): major version bump with migration path
- Clarifications to spec text without behavior changes: patch version bump

**4. PR process.** Standard PR review. Breaking changes require explicit acknowledgment from affected consumers.

## Versioning Rules

Both the taxonomy and the protocol use semantic versioning independently.

| Component | Current Version | Version Tracks |
|-----------|----------------|----------------|
| Taxonomy | 1.0.0 | The action vocabulary and provider type mappings |
| Protocol | 1.0.0 | The message format, handshake flow, and identity spec |
| Package | (npm version) | The `@careagent/axon` library release |

The taxonomy version is independent of the package version. A single package release may include a taxonomy patch, a protocol minor bump, or no version changes to either.

**Semver semantics (same for taxonomy and protocol):**

| Bump | When | Guarantee |
|------|------|-----------|
| Patch (x.y.Z) | Typo fixes, description clarifications | No behavioral changes |
| Minor (x.Y.0) | New additions, expanded mappings | Backward compatible. Existing IDs/fields unchanged |
| Major (X.0.0) | Removals, renames, breaking changes | Migration path required. Document what changed and how to update |

## Questionnaire Changes

New questionnaires for provider types follow the [questionnaire authoring guide](./questionnaire-authoring.md). The validation pipeline ensures data integrity: all action IDs must exist in the current taxonomy, all CANS field paths must be valid, and conditional display references must be well-ordered.

Questionnaire PRs go through standard review. No special governance process beyond ensuring clinical accuracy.

## Future Governance

Foundation-level governance including organizational structure, formal decision-making processes, and contributor agreements is planned for v2. The current process is designed for a small team of contributors and will be formalized as the project grows.

## See Also

- [docs/taxonomy.md](./taxonomy.md) -- Taxonomy structure, versioning rules, and extension process
- [docs/questionnaire-authoring.md](./questionnaire-authoring.md) -- How to author provider questionnaires
- [docs/architecture.md](./architecture.md) -- System architecture and design decisions
