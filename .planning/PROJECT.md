# @careagent/axon

## What This Is

The open foundation network layer for the CareAgent ecosystem. Axon is a pnpm TypeScript package that provides a national provider/organization registry, connection brokering, protocol specification, clinical action taxonomy, and onboarding questionnaire repository — enabling sovereign CareAgent installations to discover each other, verify credentials, and establish peer-to-peer clinical communication channels. It transmits, it does not think. The intelligence lives in the CareAgents. Axon governs the channel between them.

## Core Value

Axon must provide a trusted, open, neutral discovery and handshake layer so that any patient CareAgent can find any provider CareAgent and establish a direct peer-to-peer connection — without Axon ever touching PHI or remaining in the communication path after the handshake.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] National provider/organization registry keyed by NPI with credential verification and Neuron endpoint directory
- [ ] Connection broker implementing the handshake sequence (discover → verify → connect → step out)
- [ ] Axon protocol specification (handshake, identity exchange via Ed25519, message format, consent verification, credential format)
- [ ] Clinical action taxonomy — hierarchical controlled vocabulary under 7 atomic actions (chart, order, charge, perform, interpret, educate, coordinate) mapped to 49 provider types
- [ ] Onboarding questionnaire repository — conditional question sets per provider type that feed CANS.md generation (Physician fully built for v1, 48 stubs)
- [ ] TypeScript API client for authorized internal consumers (provider-core, patient-core, neuron)
- [ ] NPI validation (Luhn check, 10-digit format)
- [ ] In-memory/file-backed registry storage for v1 (production backend is v2)
- [ ] Taxonomy versioning with semver — CANS.md records which taxonomy version was used
- [ ] Registry search by NPI, name, specialty, provider type, organization, credential status

### Out of Scope

- Real PHI handling — Axon never touches protected health information, by design
- Patient registration — patients are sovereign, never registered on Axon
- Third-party API access — third parties integrate through Neuron, not Axon
- Real-time clinical messaging — Axon is for discovery and handshake, not ongoing communication
- Credential issuance — Axon verifies credentials, it does not issue them
- Production database (v2) — v1 uses in-memory/file-backed storage
- Geo-aware search (v2) — v1 uses simple string matching on location
- Full questionnaires for all 49 types (v2) — each requires domain expert clinical review
- External credential verification via NPPES/state boards (v2) — v1 uses self-attested with NPI validation
- Mutual TLS for consumer authentication (v2) — v1 uses bearer tokens
- X25519 key exchange for forward secrecy (v2) — v1 Ed25519 is sufficient

## Context

**Ecosystem:**
- `@careagent/provider-core` (fully built, v1 phases 1-5 complete) — provider-side CareAgent plugin with CANS.md activation, 9-stage onboarding, 6-layer hardening, immutable audit trail, clinical skills, refinement engine
- `@careagent/patient-core` (PRD complete, not yet built) — patient-side CareAgent plugin with Patient Chart vault, care network, data sovereignty
- `@careagent/neuron` (README only, not yet built) — organization-level Axon node for routing patient connections to provider CareAgents, local discovery, scheduling/billing, third-party API

**The taxonomy problem:**
Provider-core's onboarding currently asks for free-text `scope.permitted_actions`. This breaks the whitelist-only scope model — there is no shared language between CANS documents, skills, and the hardening engine. The clinical action taxonomy on Axon solves this by providing a controlled vocabulary that onboarding, skills, and hardening all reference.

**The questionnaire integration:**
After onboarding Stage 3 (Credentials) identifies the provider's type, the type-specific questionnaire from Axon extends the interview with conditional questions. Answers must be in proper format to programmatically generate the provider's CANS.md. For v1 demo, only the Physician (MD, DO) questionnaire is fully built.

**The 49 provider categories:**
Physicians, Advanced Practice Providers, Nursing, Nursing Support, Pharmacy, Dental, Behavioral/Mental Health, Physical Rehabilitation, Occupational Therapy, Speech & Language, Respiratory, Audiology, Vision/Optometry, Radiology/Imaging, Laboratory, Surgical, Emergency/Prehospital, Nutrition/Dietetics, Podiatry, Chiropractic, Midwifery, Genetic Counseling, Orthotics & Prosthetics, Recreational Therapy, Creative Arts Therapy, Acupuncture & Traditional Medicine, Massage & Bodywork, Athletic Training, Sleep Medicine, Cardiac/Vascular Diagnostics, Neurodiagnostics, Dialysis/Nephrology, Wound Care, Sterile Processing, Health Information/Coding, Community/Public Health, Home Health/Hospice, Patient Navigation, Lactation, Vision Rehabilitation, Deaf/Hard of Hearing Services, Anesthesia Technology, Clinical Research, Organ/Tissue, Rehabilitation Engineering, Kinesiotherapy, Child Life, Medical Physics, Ophthalmic.

**Authorized consumers (closed participant list):**
Only `@careagent/provider-core`, `@careagent/patient-core`, and `@careagent/neuron` communicate with Axon. No third-party access.

**Existing artifacts:**
- Full PRD at `/Users/medomatic/Documents/Projects/axon/PRD.md` with data models, API surfaces, 39 requirements, 6 phases, and traceability matrix
- Existing TODO at `.planning/todos/pending/2026-02-21-build-permitted-actions-taxonomy.md`

## Constraints

- **Zero runtime npm dependencies**: Same pattern as provider-core — all deps in devDependencies, runtime uses only Node.js built-ins
- **Tech stack**: TypeScript ~5.7, pnpm, tsdown ~0.20, vitest ~4.0, @sinclair/typebox ~0.34, Node.js >=22.12.0
- **No PHI**: Never, by design — Axon is not a HIPAA covered entity
- **Synthetic data only**: No real provider credentials in development
- **Taxonomy is data, not code**: Versioned JSON data files, not hardcoded enums
- **Questionnaires are data, not code**: Declarative data structures, not imperative interview logic
- **License**: Apache 2.0
- **Physician-only for v1 demo**: Full taxonomy and questionnaire for Physicians; other 48 types are valid stubs

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Zero runtime deps | Match provider-core pattern; minimize supply chain risk | — Pending |
| In-memory/file-backed registry for v1 | Production infra blocks demo; defer to v2 | — Pending |
| Ed25519 for identity exchange | Node.js built-in crypto support; sufficient for v1 | — Pending |
| Physician-only questionnaire for v1 | Each type requires clinical domain expert review | — Pending |
| Taxonomy as versioned JSON data | Allows evolution without code changes; enables external contribution | — Pending |
| Self-attested credentials for v1 | External verification (NPPES, state boards) requires API integration | — Pending |
| Closed participant list | Axon is infrastructure, not an integration surface; third parties use Neuron | — Pending |

---
*Last updated: 2026-02-21 after initialization*
