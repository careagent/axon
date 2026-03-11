# Phase 6: Documentation and Release - Research

**Researched:** 2026-02-22
**Domain:** Technical documentation, open-source release preparation, developer guides
**Confidence:** HIGH

## Summary

Phase 6 is a pure documentation and release-preparation phase with no new runtime code. All five prior phases are complete: the package scaffold, taxonomy, questionnaires, registry, protocol, broker, client facade, mock server, and integration tests are all implemented and passing. The task is to produce documentation that enables an unfamiliar developer to understand the architecture, extend the taxonomy, author new questionnaires, and contribute to the project.

The codebase is well-structured with clear module boundaries (taxonomy, questionnaires, registry, protocol, broker, mock, types), five existing spec documents in `spec/`, a comprehensive README, and extensive inline JSDoc. The documentation work is primarily authoring new markdown files in `docs/` and `CONTRIBUTING.md`, plus finalizing the existing spec documents with cross-references. No libraries or build tooling are needed -- this is markdown authoring constrained by the existing implementation.

**Primary recommendation:** Write documentation code-first -- every architecture diagram, API reference, and example must reflect the actual implementation (not the aspirational README). Use the neuron README style as the tone/format reference: concise sections, ASCII diagrams, table-heavy, no unnecessary prose.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOCS-01 | Architecture guide (`docs/architecture.md`) | Codebase structure fully mapped: 6 src modules, dependency graph, data flow from taxonomy through questionnaires/registry to broker/mock. Design decisions documented in STATE.md decisions log. |
| DOCS-02 | Protocol specification (5 spec documents in `spec/`) | All 5 specs exist from Phase 4 (handshake, identity, message, consent, credential). Need finalization with cross-references and a `docs/protocol.md` overview that links to all 5. |
| DOCS-03 | Governance model (`docs/governance.md`) | README references `docs/governance.md` as existing but file does not exist yet. Must cover taxonomy versioning, protocol change proposals, and contribution governance. V2 defers full foundation governance (GOV-01, GOV-02). |
| DOCS-04 | Taxonomy guide (`docs/taxonomy.md`) | Taxonomy is fully implemented: 7 atomic actions, dot-notation hierarchy, 49 provider types, semver versioning, JSON data file at `data/taxonomy/v1.0.0.json`. AxonTaxonomy API is static class with lazy-loaded indexes. |
| DOCS-05 | Questionnaire authoring guide (`docs/questionnaire-authoring.md`) | Full physician questionnaire as reference (12 questions, conditional branching, action_assignments, CANS field mapping). TypeBox schema, 4-step validation pipeline in loader, CANS field allowlist, 48 stub format documented. |
| DOCS-06 | CONTRIBUTING.md and release preparation | Package.json has build/test scripts. pnpm workspace, vitest 80% coverage thresholds, tsdown multi-entry build. Apache 2.0 license. No existing CONTRIBUTING.md. |
</phase_requirements>

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Markdown | N/A | All documentation format | Universal, renders on GitHub, no build step |
| ASCII diagrams | N/A | Architecture and flow diagrams | Zero-dependency, renders in terminals, version-controllable |

### Supporting

No additional libraries needed. This phase is pure documentation authoring.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ASCII diagrams | Mermaid | Mermaid renders on GitHub but is harder to edit, less portable to terminals/text editors |
| Markdown tables | HTML tables | HTML is more flexible but harder to maintain and read in source |
| Inline code examples | Linked code examples | Inline stays current with copy; linked risks staleness but avoids duplication |

## Architecture Patterns

### Documentation File Structure

```
docs/
├── architecture.md           # DOCS-01: Component layers, dependency graph, data flow, design decisions
├── protocol.md               # DOCS-02: Protocol overview linking to the 5 spec/ documents
├── governance.md              # DOCS-03: Governance model for taxonomy, protocol, and contributions
├── taxonomy.md                # DOCS-04: Action hierarchy, versioning, extension process
└── questionnaire-authoring.md # DOCS-05: Step-by-step guide for clinical domain experts
spec/
├── handshake.md               # DOCS-02: Already exists, needs cross-reference finalization
├── identity.md                # DOCS-02: Already exists, needs cross-reference finalization
├── message.md                 # DOCS-02: Already exists, needs cross-reference finalization
├── consent.md                 # DOCS-02: Already exists, needs cross-reference finalization
└── credential.md              # DOCS-02: Already exists, needs cross-reference finalization
CONTRIBUTING.md                # DOCS-06: Development setup, testing, governance reference
```

### Pattern 1: Code-First Documentation

**What:** Every statement in documentation must reflect actual implemented behavior, not aspirational or planned behavior. Cross-reference source files.
**When to use:** All documentation in this phase.
**Example:** The existing README describes `src/client/` and `src/broker/session.ts` which do not exist in the actual codebase. Architecture docs must describe what actually exists: `src/broker/broker.ts`, `src/broker/audit.ts`, etc.

### Pattern 2: Neuron README Style Consistency

**What:** Follow the neuron project's documentation style: concise "Why/What/What It Does Not Do" structure, ASCII architecture diagrams, tables for tech stack and related repos, code blocks for usage examples.
**When to use:** All new docs and CONTRIBUTING.md.
**Key traits observed from neuron README:**
- Sections use `##` headers with short declarative names
- Architecture shown as ASCII art, not Mermaid
- Tech stack as `| Layer | Choice |` tables
- "What It Does Not Do" sections to set boundaries
- Code examples use `bash` blocks for CLI, `typescript` blocks for API
- No emoji, no badges, no unnecessary decoration

### Pattern 3: Cross-Reference Linking

**What:** Documents link to each other using relative paths. Spec documents link to related specs. Architecture doc links to both specs and source files.
**When to use:** All cross-references between docs/, spec/, and source.
**Example from existing specs:**
```markdown
See [identity.md](./identity.md) for signing details.
See [message.md](./message.md) for the full schema.
```

### Anti-Patterns to Avoid

- **Aspirational documentation:** The README describes files and structures that do not exist (`src/client/`, `docs/architecture.md`, `docs/governance.md`, `docs/protocol.md`). New docs must describe what IS, not what is PLANNED.
- **Duplicating implementation details:** Do not copy-paste entire TypeBox schemas into docs. Reference the source file and show the derived TypeScript interface or a usage example.
- **Writing for the wrong audience:** `docs/questionnaire-authoring.md` is for clinical domain experts, not TypeScript developers. Use clinical terminology, show the JSON structure, minimize TypeScript-specific jargon.
- **Orphaned cross-references:** Every link must resolve. The README references `CONTRIBUTING.md` and `docs/architecture.md` that do not exist yet -- these must be created.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diagram rendering | Custom SVG/image generation | ASCII art in markdown | Zero dependency, version-controllable, renders everywhere |
| API documentation | Auto-generated typedoc | Hand-written architecture guide | Typedoc generates from types but misses design decisions, data flow, and "why" explanations |
| Changelog | Hand-maintained CHANGELOG.md | Defer to v2 (not in requirements) | No CHANGELOG requirement in DOCS-01 through DOCS-06 |

**Key insight:** This phase is authoring, not engineering. The temptation is to build doc generation tooling. Resist it -- write the 6 documents by hand, grounded in the actual codebase.

## Common Pitfalls

### Pitfall 1: README Drift

**What goes wrong:** The existing README (`README.md`) describes structures and APIs that differ from the actual implementation. If new docs are written from the README instead of the source, they inherit these inaccuracies.
**Why it happens:** The README was written before implementation (from the PRD). Implementation diverged.
**How to avoid:** Write docs from source code and test files, not from the README. After docs are complete, reconcile the README with the actual state.
**Warning signs:** Documentation references files like `src/client/index.ts`, `src/broker/session.ts`, `src/broker/handshake.ts`, or `src/registry/credentials.ts` -- none of these exist.

**Specific README inaccuracies to fix:**
- Repository Structure section shows `src/client/` directory -- does not exist (the facade is `src/index.ts` with the `Axon` namespace)
- Shows `src/broker/handshake.ts` and `src/broker/session.ts` -- actual files are `src/broker/broker.ts` and `src/broker/audit.ts`
- Shows `src/registry/credentials.ts` and `src/registry/endpoints.ts` -- actual files are `src/registry/registry.ts`, `src/registry/npi.ts`, `src/registry/persistence.ts`, `src/registry/schemas.ts`
- Shows `src/protocol/consent.ts` and `src/protocol/credential.ts` -- actual files are `src/protocol/identity.ts`, `src/protocol/schemas.ts`, `src/protocol/nonce.ts`, `src/protocol/errors.ts`
- CLI Commands section describes commands (`axon start`, `axon status`, etc.) that do not exist -- Axon is a library package, not a CLI application
- The `docs/` directory does not exist yet but README references it
- `spec/` section lists 4 specs, actual has 5 (credential.md is missing from README spec list)
- Local Development section shows `pnpm dev:registry` and `pnpm dev:mock` which are not in package.json scripts

### Pitfall 2: Wrong Audience for Questionnaire Guide

**What goes wrong:** Writing the questionnaire authoring guide (`DOCS-05`) as a TypeScript developer guide instead of a clinical domain expert guide.
**Why it happens:** The implementer thinks in TypeBox schemas and validation pipelines. The target reader thinks in clinical workflows and scope-of-practice questions.
**How to avoid:** Lead with the JSON structure (the physician questionnaire as a concrete example), not the TypeBox schema. Show what a clinical expert needs to fill in. Mention validation only as "the system will check these constraints automatically."
**Warning signs:** Guide starts with `import { Type } from '@sinclair/typebox'` instead of showing the questionnaire JSON format.

### Pitfall 3: Governance Scope Creep

**What goes wrong:** Writing a full foundation governance document (board structure, voting procedures, funding model) when v1 only needs a process for taxonomy and protocol changes.
**Why it happens:** README and PRD describe Axon as "open foundation infrastructure" and reference full governance. But GOV-01 and GOV-02 are explicitly deferred to v2.
**How to avoid:** DOCS-03 (`docs/governance.md`) should cover: (1) how to propose a new taxonomy action, (2) how to propose a protocol change, (3) versioning rules for both. It should NOT cover foundation structure, board elections, or funding.
**Warning signs:** Document exceeds 2 pages or discusses topics beyond taxonomy/protocol change management.

### Pitfall 4: Spec Over-Editing

**What goes wrong:** Rewriting the 5 existing spec documents from scratch, losing the code-first accuracy established in Phase 4.
**Why it happens:** Desire for "polished" documentation leads to rewrites that introduce inaccuracies.
**How to avoid:** The spec documents were written code-first in Plan 04-03. Finalization should be limited to: adding cross-reference links between specs, ensuring consistent formatting, and adding any missing details. The content is already accurate.
**Warning signs:** Major content changes to spec documents, or spec content that contradicts the implementation.

### Pitfall 5: Missing Mock Server Documentation

**What goes wrong:** Architecture docs describe only the class APIs (AxonTaxonomy, AxonRegistry, AxonBroker, AxonQuestionnaires) but omit the mock HTTP server which is the primary integration surface for consumers.
**Why it happens:** Mock server was added in Phase 5 and extended in Phase 5.1. It is a first-class consumer integration tool but might be treated as a testing afterthought.
**How to avoid:** Architecture docs must include the mock server routes as a distinct component. The mock server is how neuron, patient-core, and provider-core actually interact with Axon in integration tests.

## Code Examples

These are the key patterns that documentation must reference accurately.

### Actual Source Module Structure

```
src/
├── index.ts                    # Main entry: re-exports all modules, Axon namespace, AXON_VERSION
├── types/index.ts              # Derived types (Static<typeof Schema>) + runtime schema re-exports
├── taxonomy/
│   ├── index.ts                # Barrel export
│   ├── schemas.ts              # TypeBox: TaxonomyVersionSchema, TaxonomyActionSchema, etc.
│   ├── loader.ts               # readFileSync + directory walk-up JSON loading
│   └── taxonomy.ts             # AxonTaxonomy static class with lazy Map/Set indexes
├── questionnaires/
│   ├── index.ts                # Barrel export
│   ├── schemas.ts              # TypeBox: QuestionnaireSchema, QuestionSchema, etc.
│   ├── loader.ts               # 4-step validation pipeline (schema, taxonomy, CANS, show_when)
│   ├── questionnaires.ts       # AxonQuestionnaires static class with lazy Map index
│   └── cans-fields.ts          # VALID_CANS_FIELDS Set<string> allowlist
├── registry/
│   ├── index.ts                # Barrel export
│   ├── schemas.ts              # TypeBox: RegistryEntrySchema, CredentialRecordSchema, etc.
│   ├── npi.ts                  # Luhn check digit validation with 80840 prefix
│   ├── persistence.ts          # Atomic write-to-temp-then-rename JSON persistence
│   └── registry.ts             # AxonRegistry class: register, search, credential management
├── protocol/
│   ├── index.ts                # Barrel export
│   ├── schemas.ts              # TypeBox: ConnectRequestSchema, SignedMessageSchema, etc.
│   ├── identity.ts             # Ed25519 key generation, signing, verification (node:crypto)
│   ├── nonce.ts                # NonceStore: replay protection with timestamp window
│   └── errors.ts               # AxonProtocolError hierarchy
├── broker/
│   ├── index.ts                # Barrel export
│   ├── broker.ts               # AxonBroker: stateless connect() pipeline
│   └── audit.ts                # AuditTrail: hash-chained JSONL append-only log
└── mock/
    ├── index.ts                # Barrel export
    ├── server.ts               # createMockAxonServer(): HTTP server for integration testing
    └── fixtures.ts             # DEFAULT_FIXTURES: pre-seeded registry data
```

### Package Entry Points

```typescript
// Full package
import { Axon, AxonRegistry, AxonBroker, AxonTaxonomy, AxonQuestionnaires } from '@careagent/axon'

// Taxonomy only (for provider-core scope selection)
import { AxonTaxonomy } from '@careagent/axon/taxonomy'

// Questionnaires only
import { AxonQuestionnaires } from '@careagent/axon/questionnaires'

// Types only (TypeBox schemas + derived types)
import type { RegistryEntry, TaxonomyAction } from '@careagent/axon/types'

// Mock server (for integration testing)
import { createMockAxonServer } from '@careagent/axon/mock'
```

### Mock Server HTTP Routes

```
POST   /v1/neurons                      # Register a Neuron (organization)
GET    /v1/neurons/:id                  # Get Neuron state
PUT    /v1/neurons/:id/endpoint         # Heartbeat / endpoint update
POST   /v1/neurons/:id/providers        # Register a provider under a Neuron
DELETE /v1/neurons/:id/providers/:npi   # Remove a provider (no-op in v1)
GET    /v1/taxonomy/actions?type=...    # Get taxonomy actions for provider type
GET    /v1/questionnaires/:typeId       # Get questionnaire for provider type
GET    /v1/registry/search?...          # Search registry (name, npi, specialty, etc.)
GET    /v1/registry/:npi                # Direct NPI lookup
POST   /v1/connect                      # Broker connection (signed message)
```

### Dependency Graph (for architecture.md)

```
                 ┌─────────┐
                 │  types/  │  (schemas + derived types)
                 └────┬────┘
          ┌───────────┼───────────┐
          ▼           ▼           ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ taxonomy │ │ registry │ │ protocol │
    └────┬─────┘ └────┬─────┘ └────┬─────┘
         │            │            │
         ▼            │            │
  ┌──────────────┐    │            │
  │questionnaires│    │            │
  └──────┬───────┘    │            │
         │            │            │
         │     ┌──────┴─────┐     │
         │     │   broker   │◄────┘
         │     └──────┬─────┘
         │            │
         ▼            ▼
    ┌──────────────────────┐
    │        mock/         │  (uses all modules)
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │      index.ts        │  (Axon namespace, re-exports all)
    └──────────────────────┘
```

### Key Design Decisions to Document

These are from STATE.md and must be explained in `docs/architecture.md`:

1. **Stateless broker** -- Every `connect()` is a self-contained atomic operation. No session state.
2. **Data-not-code taxonomy** -- Taxonomy is a versioned JSON file (`data/taxonomy/v1.0.0.json`), not hardcoded enums. Enables governance-controlled updates without code changes.
3. **Closed participant list** -- Only patient-core, provider-core, and neuron can talk to Axon. No third-party API access.
4. **Patient-initiated connections** -- Patients always initiate. Broker never contacts providers.
5. **Transmit and exit** -- Axon facilitates discovery and handshake, then exits. Never in the clinical data path.
6. **Zero runtime dependencies** -- All dependencies (TypeBox) are inlined by tsdown at build time.
7. **Self-attested credentials in v1** -- `verification_source` is required but only `self_attested` is used. Data model ready for progressive verification.
8. **Hash-chained audit trail** -- JSONL with SHA-256 prev_hash chain for tamper evidence. No clinical content.

### Questionnaire JSON Structure (for authoring guide)

```json
{
  "provider_type": "physician",
  "version": "1.0.0",
  "taxonomy_version": "1.0.0",
  "display_name": "Physician Onboarding Questionnaire",
  "description": "Determines digital scope of practice for Physician (MD, DO) CareAgents",
  "questions": [
    {
      "id": "unique_question_id",
      "text": "Human-readable question text",
      "answer_type": "boolean | single_select",
      "required": true,
      "options": [                    // Only for single_select
        { "value": "key", "label": "Display Text", "description": "Optional help text" }
      ],
      "show_when": {                  // Optional conditional display
        "question_id": "prior_question_id",
        "equals": "expected_value"
      },
      "cans_field": "scope.permitted_actions",  // Must be in VALID_CANS_FIELDS
      "action_assignments": [         // Optional taxonomy action grants
        {
          "answer_value": "true",
          "grants": ["chart.progress_note", "chart.history_and_physical"]
        }
      ]
    }
  ]
}
```

### Valid CANS Fields (for authoring guide)

```
provider.licenses
provider.certifications
provider.specialty
provider.subspecialty
provider.organizations
scope.permitted_actions
scope.taxonomy_version
scope.practice_setting
scope.supervision_level
autonomy.default_level
skills.authorized
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded enum-based taxonomies | Data-as-JSON with runtime loading | v1.0.0 design decision | Taxonomy changes do not require code changes |
| Inline questionnaire logic | Declarative JSON questionnaires with validation pipeline | v1.0.0 design decision | Clinical experts can author questionnaires without TypeScript knowledge |
| Manual credential verification | Data model supports progressive verification levels | v1.0.0 (self_attested only) | v2 can add NPPES/state board verification without schema migration |

## Open Questions

1. **README reconciliation scope**
   - What we know: The README has significant drift from implementation (wrong file paths, non-existent CLI commands, aspirational directory structure)
   - What's unclear: Should Phase 6 also update the README to match reality, or leave it as-is?
   - Recommendation: Include README correction as part of DOCS-06 (release preparation). The README is the first thing a new contributor sees and must be accurate at release.

2. **Spec finalization depth**
   - What we know: The 5 spec documents were written code-first in Phase 4 and are already accurate
   - What's unclear: What "finalization" means beyond adding cross-reference links
   - Recommendation: Limit spec finalization to: (a) consistent header format across all 5, (b) cross-reference links between related specs, (c) "See also" sections linking to `docs/protocol.md` overview. No content rewrites.

3. **Governance model depth for v1**
   - What we know: GOV-01 and GOV-02 (full foundation governance) are explicitly v2. DOCS-03 requires a `docs/governance.md`.
   - What's unclear: How much governance detail is appropriate for v1
   - Recommendation: Focus governance doc on practical process: (1) taxonomy extension proposal process, (2) protocol change proposal process, (3) semver versioning rules for taxonomy and protocol. Defer organizational governance (board, voting, foundation structure) to v2.

## Sources

### Primary (HIGH confidence)

- **Axon source code** (`/Users/medomatic/Documents/Projects/axon/src/`) -- All 27 TypeScript source files read and analyzed
- **Existing spec documents** (`/Users/medomatic/Documents/Projects/axon/spec/`) -- All 5 specs read (handshake, identity, message, consent, credential)
- **Project state** (`.planning/STATE.md`) -- All 30+ accumulated decisions reviewed
- **Requirements** (`.planning/REQUIREMENTS.md`) -- DOCS-01 through DOCS-06 requirements mapped
- **Package configuration** (`package.json`, `tsconfig.json`, `tsdown.config.ts`, `vitest.config.ts`) -- Build/test toolchain verified
- **Neuron README** (`/Users/medomatic/Documents/Projects/neuron/README.md`) -- Documentation style reference analyzed

### Secondary (MEDIUM confidence)

- **Taxonomy data** (`data/taxonomy/v1.0.0.json`) -- Structure and content verified (49 provider types, 7 atomic actions)
- **Physician questionnaire** (`data/questionnaires/physician.json`) -- Full 12-question structure verified as authoring guide reference
- **Stub questionnaire format** (`data/questionnaires/nursing.json`) -- Minimal valid structure confirmed

### Tertiary (LOW confidence)

- None. All findings are based on direct source code analysis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No libraries needed; pure markdown authoring
- Architecture: HIGH -- Complete codebase read, all modules and dependencies mapped
- Pitfalls: HIGH -- README drift verified against actual source files; audience mismatch identified from requirements text; governance scope confirmed from v2 requirements

**Research date:** 2026-02-22
**Valid until:** 2026-04-22 (stable -- documentation of implemented code, no moving targets)
