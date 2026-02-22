# @careagent/axon

## What This Is

The open foundation network layer for the CareAgent ecosystem. Axon is a pnpm TypeScript package providing a national provider/organization registry, Ed25519 connection brokering, clinical action taxonomy (61 actions across 49 provider types), conditional onboarding questionnaires, and a mock HTTP server — enabling sovereign CareAgent installations to discover each other, verify credentials, and establish peer-to-peer clinical communication channels. It transmits, it does not think. The intelligence lives in the CareAgents. Axon governs the channel between them.

## Core Value

Axon must provide a trusted, open, neutral discovery and handshake layer so that any patient CareAgent can find any provider CareAgent and establish a direct peer-to-peer connection — without Axon ever touching PHI or remaining in the communication path after the handshake.

## Requirements

### Validated

- ✓ National provider/organization registry keyed by NPI with credential verification and Neuron endpoint directory — v1.0
- ✓ Connection broker implementing the handshake sequence (discover → verify → connect → step out) — v1.0
- ✓ Axon protocol specification (handshake, identity exchange via Ed25519, message format, consent verification, credential format) — v1.0
- ✓ Clinical action taxonomy — hierarchical controlled vocabulary under 7 atomic actions mapped to 49 provider types — v1.0
- ✓ Onboarding questionnaire repository — conditional question sets per provider type that feed CANS.md generation — v1.0
- ✓ TypeScript API client for authorized internal consumers (provider-core, patient-core, neuron) — v1.0
- ✓ NPI validation (Luhn check, 10-digit format) — v1.0
- ✓ In-memory/file-backed registry storage for v1 — v1.0
- ✓ Taxonomy versioning with semver — CANS.md records which taxonomy version was used — v1.0
- ✓ Registry search by NPI, name, specialty, provider type, organization, credential status — v1.0

### Active

(None — next milestone will define new requirements)

### Out of Scope

- Real PHI handling — Axon never touches protected health information, by design
- Patient registration — patients are sovereign, never registered on Axon
- Third-party API access — third parties integrate through Neuron, not Axon
- Real-time clinical messaging — Axon is for discovery and handshake, not ongoing communication
- Credential issuance — Axon verifies credentials, it does not issue them
- Session state after handshake — contradicts the "transmits and exits" design principle
- Free-text taxonomy entries — defeats the controlled vocabulary purpose
- Open registration without Neuron — enables credential spoofing

### Deferred to v2

- Production database backend (database, replication, high availability)
- Geo-aware search with geospatial indexing and address normalization
- Full questionnaires for all 49 types (each requires domain expert clinical review)
- External credential verification via NPPES/state boards
- Mutual TLS for consumer authentication
- X25519 key exchange for forward secrecy
- Full action sets for all 49 provider types
- Open foundation governance structure

## Context

**Current state:** v1.0.0 shipped (2026-02-22). Standalone production server deployed. 253 tests, 0 runtime deps, >80% coverage.

**Tech stack:** TypeScript 5.9, pnpm, tsdown 0.20, vitest 4.0, @sinclair/typebox 0.34, Node.js >=22.12.0

**Ecosystem:**
- `@careagent/provider-core` (fully built, v1 phases 1-5 complete) — provider-side CareAgent plugin with CANS.md activation, 9-stage onboarding, 6-layer hardening, immutable audit trail, clinical skills, refinement engine
- `@careagent/patient-core` (PRD complete, not yet built) — patient-side CareAgent plugin with Patient Chart vault, care network, data sovereignty
- `@careagent/neuron` (README only, not yet built) — organization-level Axon node for routing patient connections to provider CareAgents

**Authorized consumers (closed participant list):**
Only `@careagent/provider-core`, `@careagent/patient-core`, and `@careagent/neuron` communicate with Axon. No third-party access.

**Known tech debt:**
- README.md and docs/questionnaire-authoring.md say "12 questions" for physician (actual: 13)
- README.md `new AxonRegistry()` example missing required `filePath` argument
- 1 pending todo: build-permitted-actions-taxonomy (may be v2 scope)
- README.md does not yet document the standalone server, Docker deployment, or GitHub Packages publishing

## Constraints

- **Zero runtime npm dependencies**: All deps in devDependencies, runtime uses only Node.js built-ins
- **Tech stack**: TypeScript ~5.9, pnpm, tsdown ~0.20, vitest ~4.0, @sinclair/typebox ~0.34, Node.js >=22.12.0
- **No PHI**: Never, by design — Axon is not a HIPAA covered entity
- **Synthetic data only**: No real provider credentials in development
- **Taxonomy is data, not code**: Versioned JSON data files, not hardcoded enums
- **Questionnaires are data, not code**: Declarative data structures, not imperative interview logic
- **License**: Apache 2.0
- **Physician-only for v1**: Full taxonomy and questionnaire for Physicians; other 48 types are valid stubs

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Zero runtime deps | Match provider-core pattern; minimize supply chain risk | ✓ Good — 0 deps in package.json |
| In-memory/file-backed registry for v1 | Production infra blocks demo; defer to v2 | ✓ Good — atomic write-to-temp-then-rename works well |
| Ed25519 for identity exchange | Node.js built-in crypto support; sufficient for v1 | ✓ Good — clean JWK import/export, base64url wire format |
| Physician-only questionnaire for v1 | Each type requires clinical domain expert review | ✓ Good — 48 valid stubs prevent runtime errors |
| Taxonomy as versioned JSON data | Allows evolution without code changes; enables external contribution | ✓ Good — 61 actions, 49 types, semver versioned |
| Self-attested credentials for v1 | External verification (NPPES, state boards) requires API integration | ✓ Good — verification_source required field surfaces trust level |
| Closed participant list | Axon is infrastructure, not an integration surface; third parties use Neuron | ✓ Good — clear security boundary |
| TypeBox schema-first design | Runtime validation + static types from single source | ✓ Good — consistent across all modules |
| Stateless broker pipeline | No session state after handshake; every connect() is atomic | ✓ Good — clean separation, no connection leaks |
| Hash-chained audit trail | Tamper-evident JSONL with SHA-256 chain | ✓ Good — verifyChain() detects tampering |
| ASCII over Mermaid for docs | Universal rendering without special tooling | ✓ Good — works in any markdown viewer |
| 2-level taxonomy hierarchy (3 for surgical) | Balance between specificity and manageability | ✓ Good — 61 actions cover physician scope adequately |
| Standalone server with bearer token auth | Neuron instances need authenticated access; simple token-per-registration | ✓ Good — persistent tokens survive restarts |
| Docker + Caddy for VPS deployment | Auto TLS, reverse proxy, non-root container, health checks | ✓ Good — single `docker compose up` deploys |
| GitHub Packages for npm distribution | Private registry for @careagent scoped packages | ✓ Good — v* tag triggers automated publish |

---
*Last updated: 2026-02-22 after standalone server deployment*
