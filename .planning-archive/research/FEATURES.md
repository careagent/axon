# Feature Research

**Domain:** Healthcare provider registry, clinical taxonomy, and trust/identity infrastructure
**Researched:** 2026-02-21
**Confidence:** HIGH (PRD fully defined; ecosystem well-understood; external systems verified via web research)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that authorized consumers (provider-core, patient-core, neuron) assume exist. Missing these = the ecosystem cannot function.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| NPI lookup by 10-digit identifier | NPI is the universal provider identifier in US healthcare; every registry lookup starts here | LOW | Luhn check + format validation; NPPES sets the expectation — every real directory keys on NPI |
| Provider search by specialty/name/organization | Patients and systems need to discover providers without knowing their NPI | MEDIUM | v1: string matching; v2: geo-aware, ranked results |
| Credential status query (active/expired/suspended/revoked) | Patient CareAgents must verify a provider is in good standing before establishing a care relationship | LOW | v1: self-attested; status field is the critical output |
| Neuron endpoint directory | Without a known endpoint, patient-core cannot reach the provider's Neuron — discovery is broken | LOW | URL + health status + last heartbeat; must be updateable by the owning Neuron |
| Provider/organization registration | Neuron must be able to register organizations and their providers | LOW | NPI-keyed; ownership model (only registering Neuron can update credentials) |
| Credential record storage (license, certification, privilege) | Credentialing is the minimum bar for any provider directory; CAQH ProView demonstrates this is baseline | MEDIUM | v1: self-attested; v2: primary source verification via NPPES/state boards |
| Structured credential format with versioning | Credentials change; CANS.md must know which taxonomy version and which credential schema was used | LOW | Already defined in PRD CredentialRecord interface |
| Connection brokering (discover → verify → connect → step out) | The handshake sequence is Axon's reason for existence — without it, peer-to-peer sessions cannot be established | HIGH | Stateless post-handshake; audit log required |
| Ed25519 identity exchange (challenge-response) | Cryptographic identity is required for any trust infrastructure; bearer tokens alone are insufficient for a network claiming to be open and auditable | MEDIUM | Node.js built-in crypto; no external dep; sufficient for v1 |
| Signed protocol messages | Every protocol-level message must be verifiable — prevents spoofing, replay, and impersonation | MEDIUM | Ed25519 signature over canonical payload; verified on receipt |
| Consent token verification | Patient consent must be cryptographically verifiable at the Neuron before any clinical session opens | MEDIUM | Signed by patient's key pair; verified by Neuron; Axon never touches or stores consent tokens |
| Audit log for brokering events | Any trust infrastructure requires auditability — who connected to whom and when | LOW | Connection-level only; no clinical content; required for governance and dispute resolution |
| Clinical action taxonomy (controlled vocabulary) | Without a shared vocabulary, scope.permitted_actions in CANS.md cannot be validated, matched, or enforced — the whitelist model collapses | HIGH | 7 atomic actions; hierarchical dot-notation IDs; provider type mapping for all 49 types |
| Taxonomy versioning with semver | CANS.md must record which taxonomy version was used; major versions may require migration | LOW | Semver; CANS records scope.taxonomy_version; stable IDs within a major version |
| getActionsForType() / validateAction() API | Provider-core's onboarding scope stage needs to query valid actions for a provider type and validate selections | LOW | Core API surface; taxonomy is the data, the class is the interface |
| Questionnaire schema and getForType() API | Provider-core's careagent init consumes type-specific questionnaires; the schema must be stable for incremental questionnaire authoring | MEDIUM | Conditional branching, CANS field mapping, taxonomy-backed options |
| 49 provider type stubs (all types registered, even if empty) | listAvailableTypes() must return all 49 types or provider-core onboarding breaks when a non-Physician provider self-identifies | LOW | Correct metadata + empty sections array is sufficient for v1 |
| Full Physician questionnaire (v1 demo requirement) | The demo requires at least one complete questionnaire to prove the system works end-to-end | HIGH | Conditional branching on surgical/non-surgical, specialty, privileges, academic vs. private practice |
| NPI validation (Luhn check + format) | Invalid NPIs must be rejected at the registry boundary; this is a fundamental data integrity requirement | LOW | 10-digit, Luhn algorithm; Node.js built-in |
| File-backed persistence for v1 registry | Registry data must survive process restart for any meaningful demo | LOW | JSON file store; no external dep; production backend is v2 |
| Zero runtime npm dependencies | Axon mirrors provider-core's constraint; supply chain risk is a real concern for infrastructure packages | LOW | All runtime via Node.js built-ins; devDependencies for build/test only |
| TypeBox schemas for all data models | Runtime validation is required; TypeBox is already the ecosystem standard (provider-core uses it) | LOW | Consistent with existing ecosystem; compile-time + runtime validation |
| Multiple entry points (taxonomy-only, registry-only, types-only) | Consumer-specific entry points prevent unnecessary code loading; taxonomy-only is the most common import for provider-core | LOW | tsdown multi-entry configuration |

### Differentiators (Competitive Advantage)

Features that make Axon meaningfully different from NPPES, CAQH ProView, Da Vinci PDex directories, and generic PKI infrastructure. These are where Axon competes on design philosophy.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Stateless handshake broker (exits the path after connection grant) | No other healthcare directory exits the path — they remain intermediaries. Axon is unique in architecturally guaranteeing it cannot surveil clinical communication after handshake | MEDIUM | Stateless by design; connection-level audit log only; clinical content flows peer-to-peer |
| No PHI anywhere in the infrastructure layer | NPPES, CAQH, and FHIR directories typically handle some patient-adjacent data. Axon's PHI-zero guarantee is a genuine architectural differentiator — it cannot be a HIPAA covered entity by design | LOW | Enforced by architecture, not policy; patients never registered; consent tokens never stored |
| Clinical action taxonomy as a shared controlled vocabulary across the entire ecosystem | No existing system maps provider types to atomic clinical actions in a hierarchical, versioned, machine-readable format that CANS.md, skills, and the hardening engine all share. SNOMED CT is for diagnoses; CPT is for billing — neither maps provider types to permitted actions | HIGH | 7 atomic actions → N sub-actions → 49 provider type applicability mappings; solves the free-text scope problem |
| Provider type → permitted action mapping (49 types × 7 atomic actions) | Existing taxonomies (SNOMED, CPT, LOINC) don't answer "what can a Certified Athletic Trainer do?" in machine-readable form. Axon's taxonomy answers this for all 49 types | HIGH | Each action declares applicable_types[]; enables automatic scope validation at onboarding and hardening |
| Questionnaire-to-CANS field mapping (declarative, not imperative) | Interview logic in most credentialing systems is hardcoded. Axon's questionnaire schema is declarative data — clinical domain experts can author new questionnaires without writing code | MEDIUM | cans_field + transform fields in Question interface; authoring guide enables non-engineer contribution |
| Conditional questionnaire branching based on prior answers | Most provider directories ask flat question sets. Axon's questionnaire supports conditional display (e.g., surgical scope questions only appear if the provider selects surgical practice) | MEDIUM | QuestionCondition interface with equals/includes/not_equals operators |
| Open protocol specification (spec/ documents) | The handshake, identity, message, consent, and credential specs are human-readable and independently implementable — making Axon a true open foundation, not a proprietary API | LOW | 5 spec documents; sufficient for independent implementation; key for open governance |
| Closed participant list as a security property (not a limitation) | Most APIs are designed for open access. Axon's closed participant list (3 authorized consumers only) is a deliberate security architecture that eliminates an entire class of attack surface | LOW | Package-level API keys in v1; mutual TLS in v2; not a limitation but a trust boundary |
| Taxonomy as versioned JSON data (not hardcoded enums) | Hardcoded enums require code changes for taxonomy evolution. Axon's taxonomy is a versioned data file — professional societies or governance committees can contribute without touching source code | LOW | data/taxonomy/v1.0.0.json; version compatibility checking in client |
| Mock Axon server for consumer integration testing | Provider-core, patient-core, and neuron need a testable Axon without a live registry. The mock server is a differentiator for developer experience within the ecosystem | MEDIUM | Enables isolated testing of all three consumers; required for CI |
| Taxonomy version recorded in every CANS.md | When the taxonomy evolves, existing CANS documents must know what version they were generated against. No other system in this space tracks this. scope.taxonomy_version enables safe migration | LOW | New CANS field; minor effort, high future value |

### Anti-Features (Deliberately NOT Building)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| PHI storage or transit | Seems necessary for clinical coordination | Makes Axon a HIPAA covered entity; creates liability, compliance burden, and a high-value breach target; destroys the "open foundation" architectural guarantee | Clinical content flows peer-to-peer between installations after the handshake; Axon never touches it |
| Patient registration on Axon | Seems needed for patient discovery | Creates a central database of who is seeking care — directly violates patient sovereignty, creates HIPAA exposure, and makes Axon a surveillance layer | Patient identity is presented directly to the Neuron during the consent handshake, peer-to-peer, never touching Axon |
| Third-party API access | Ecosystem participants want to build on Axon | Turns trust infrastructure into an integration surface; expands attack surface; creates versioning and backward compatibility obligations that conflict with the open foundation model | Third-party applications integrate through Neuron, which provides a controlled integration surface |
| Real-time clinical messaging relay | Seems efficient to route messages through Axon | Puts Axon in the clinical communication path permanently; creates latency, single-point-of-failure, and clinical content handling; contradicts the "exits the path" design principle | After handshake, communication flows directly through Neuron; Axon is not a message broker |
| Credential issuance | Seems like a natural extension of credential verification | Credential issuance requires regulatory authority that Axon does not have and should not have; blurs the line between neutral infrastructure and regulatory body | Credentials are issued by state licensing boards, certification bodies, and institutions; Axon verifies, it does not issue |
| Production database for v1 | Teams want robust data storage from day one | Adds external runtime dependency (Postgres, MySQL, SQLite) that conflicts with zero-dep constraint; blocks demo velocity; premature optimization | In-memory/file-backed JSON store for v1; production backend is v2 when the system is validated |
| Geo-aware search in v1 | Location-based search is expected in modern provider directories | Requires geospatial indexing (PostGIS or similar), address normalization, and external geocoding — all external dependencies that conflict with zero-dep and block demo | v1: simple string matching on location field; v2: geo-aware with proper infrastructure |
| Full questionnaires for all 49 provider types in v1 | Complete coverage seems professional | Each questionnaire requires clinical domain expert review to correctly map provider scope — this is not an engineering problem but a clinical governance problem; shipping incorrect scope mappings is worse than shipping stubs | v1: Physician fully built as proof of concept; all 48 others are valid stubs; complete incrementally with clinical reviewers |
| External credential verification in v1 (NPPES API, state boards) | Seems necessary for trustworthy credentials | NPPES bulk data requires data licensing; state board APIs are inconsistent and some don't exist; adds network dependencies that complicate the zero-dep model; CAQH ProView took years to build primary source verification | v1: self-attested with NPI format + Luhn validation; v2: NPPES integration after licensing is resolved |
| Open registration (any provider registers without authentication) | Democratizes access | Enables credential spoofing, registry poisoning, and impersonation — destroys the trust model Axon is built to provide | Neuron acts as the authenticated gateway for provider registration; only the registered Neuron can update credentials for its providers |
| Session state maintenance after handshake | Seems helpful for connection management | Contradicts the stateless broker design; creates state that can be observed, leaked, or subpoenaed; making Axon session-aware puts it back in the clinical path | Session state lives in the CareAgents and Neuron; Axon is stateless post-handshake |
| Taxonomy free-text entries or escape hatches | Providers may have edge-case actions not in the taxonomy | Free-text defeats the entire purpose of a controlled vocabulary; the hardening engine and skills system cannot validate free-text; one escape hatch breaks the whitelist model | Taxonomy governance process for adding new actions via minor version bumps; edge cases go through the governance process, not around it |

---

## Feature Dependencies

```
[NPI Validation]
    └──required by──> [Provider/Org Registration]
                          └──required by──> [Neuron Endpoint Directory]
                                                └──required by──> [Connection Brokering]

[Clinical Action Taxonomy (data)]
    └──required by──> [AxonTaxonomy API (getActionsForType, validateAction)]
                          └──required by──> [Questionnaire Schema + Physician Questionnaire]
                                                └──required by──> [provider-core onboarding scope stage]

[Registry Data Model + NPI Validation]
    └──required by──> [AxonRegistry CRUD + Search]
                          └──required by──> [Connection Brokering]
                                                └──required by──> [Audit Log]

[Ed25519 Identity Exchange]
    └──required by──> [Signed Protocol Messages]
                          └──required by──> [Connection Brokering]
                                                └──required by──> [Consent Token Verification]

[Taxonomy Versioning]
    └──enhances──> [Clinical Action Taxonomy]
    └──required by──> [CANS.md scope.taxonomy_version field]

[TypeBox Schemas]
    └──underpins──> [All data models, protocol messages, questionnaire format]

[Full Physician Questionnaire]
    └──depends on──> [Questionnaire Schema]
    └──depends on──> [Clinical Action Taxonomy] (taxonomy-backed scope options)

[Mock Axon Server]
    └──depends on──> [All Phase 1-4 components]
    └──enables──> [Consumer integration testing for provider-core, patient-core, neuron]

[Multiple Entry Points]
    └──depends on──> [All Phase 1-4 components complete and exported]
```

### Dependency Notes

- **NPI Validation required before Registration:** The registry boundary must reject invalid NPIs before any data is persisted. This is Phase 3 foundational work.
- **Taxonomy required before Questionnaires:** Questionnaire options reference taxonomy action IDs; validation fails if taxonomy is not present. Phase 2 depends on Phase 1.
- **Registry required before Broker:** The broker queries the registry for credential status and Neuron endpoint during every connection request. Phase 4 depends on Phase 3.
- **Ed25519 identity required before Broker:** The broker validates signed challenge-responses; without identity exchange, there is no authentication in the handshake. Phase 4 is a single unified deliverable.
- **All phases required before API Client / Mock Server:** Phase 5 packages what Phases 1-4 build; cannot be tested in integrated form before prior phases are complete.

---

## MVP Definition

### Launch With (v1 — Demo-ready)

The minimum required to demonstrate the full CareAgent ecosystem with a real Physician provider.

- [ ] **NPI validation (Luhn + format)** — gate at the registry boundary; foundational data integrity
- [ ] **Clinical action taxonomy v1.0.0 (Physician full set + common cross-type actions)** — the critical unlock for provider-core's broken free-text scope stage
- [ ] **AxonTaxonomy API (getActionsForType, validateAction, resolveAction)** — what provider-core consumes during onboarding
- [ ] **Questionnaire schema (TypeBox)** — stable contract for all 49 type files
- [ ] **Full Physician questionnaire** — proves the questionnaire system works end-to-end for the demo provider type
- [ ] **49 provider type stubs (correct metadata, empty sections)** — listAvailableTypes() returns all 49; onboarding does not break for non-Physician types
- [ ] **Registry data model + in-memory/file-backed storage** — provider and Neuron registration, credential storage, search
- [ ] **Registry search (NPI, name, specialty, provider type, org, credential status)** — patient-core discovery depends on this
- [ ] **Neuron endpoint directory (URL, health status, heartbeat)** — patient-core cannot initiate a connection without the Neuron endpoint
- [ ] **Axon protocol specification (5 spec documents in spec/)** — required for the "open foundation" claim; documents the handshake, identity, message, consent, credential standards
- [ ] **Ed25519 identity exchange + signed messages** — cryptographic identity is the trust primitive; without it, the "trust infrastructure" claim is hollow
- [ ] **Connection brokering (AxonBroker.connect())** — the end-to-end handshake sequence
- [ ] **Audit log for brokering events** — connection-level; required for governance
- [ ] **AxonRegistry, AxonBroker, AxonTaxonomy, AxonQuestionnaires exported from package** — the API client surface
- [ ] **Multiple entry points** — taxonomy-only import for provider-core; full package for neuron
- [ ] **Mock Axon server for consumer integration testing** — provider-core, patient-core, and neuron need testable Axon

### Add After Validation (v1.x)

Once the demo validates the architecture, these extend coverage without architectural change.

- [ ] **Additional provider type questionnaires** — add as clinical reviewers complete each type; schema is stable
- [ ] **Type-specific taxonomy actions for remaining 48 provider types** — marked "v2 pending clinical review" in v1; each requires domain expert validation
- [ ] **Taxonomy governance tooling** — interface for professional societies to propose and review action additions

### Future Consideration (v2+)

Defer until product-market fit is established and ecosystem is in production.

- [ ] **External credential verification (NPPES API, state board APIs)** — requires data licensing, external network dependency; self-attested is sufficient for demo
- [ ] **Production-grade registry backend (database, HA, replication)** — in-memory/file-backed is sufficient for demo; production deployment triggers v2
- [ ] **Geo-aware provider search** — geospatial indexing, address normalization, geocoding; requires infrastructure investment
- [ ] **X25519 key exchange for forward secrecy** — Ed25519 is sufficient for v1; forward secrecy is a v2 security upgrade
- [ ] **Mutual TLS for consumer authentication** — bearer tokens sufficient for v1; mTLS adds defense-in-depth for production
- [ ] **Open foundation governance structure** — organizational, not technical; requires community formation

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Clinical action taxonomy data (Physician) | HIGH | MEDIUM | P1 |
| AxonTaxonomy API | HIGH | LOW | P1 |
| NPI validation | HIGH | LOW | P1 |
| Physician questionnaire (full) | HIGH | HIGH | P1 |
| 49 provider type stubs | HIGH | LOW | P1 |
| Registry data model + storage | HIGH | MEDIUM | P1 |
| Registry search | HIGH | MEDIUM | P1 |
| Neuron endpoint directory | HIGH | LOW | P1 |
| Ed25519 identity + signed messages | HIGH | MEDIUM | P1 |
| Connection brokering | HIGH | HIGH | P1 |
| Protocol spec (5 documents) | MEDIUM | MEDIUM | P1 |
| Audit log | MEDIUM | LOW | P1 |
| API client exports + entry points | HIGH | LOW | P1 |
| Mock Axon server | HIGH | MEDIUM | P1 |
| Taxonomy versioning | MEDIUM | LOW | P1 |
| TypeBox schemas (all models) | HIGH | LOW | P1 |
| Questionnaire schema (TypeBox) | HIGH | LOW | P1 |
| Additional provider type questionnaires | HIGH | HIGH | P2 |
| Type-specific taxonomy for 48 remaining types | HIGH | HIGH | P2 |
| External credential verification | HIGH | HIGH | P3 |
| Production registry backend | HIGH | HIGH | P3 |
| Geo-aware search | MEDIUM | HIGH | P3 |
| X25519 forward secrecy | MEDIUM | MEDIUM | P3 |
| Mutual TLS | MEDIUM | MEDIUM | P3 |
| Taxonomy governance tooling | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for v1 demo launch
- P2: Should have, add incrementally post-demo
- P3: Defer to v2 until production deployment validated

---

## Competitor Feature Analysis

| Feature | NPPES (CMS) | CAQH ProView | Da Vinci PDex Plan-Net | Axon Approach |
|---------|-------------|--------------|------------------------|---------------|
| NPI-keyed lookup | Yes (the source) | Yes | Yes (via FHIR) | Yes — NPI is the primary key |
| Credential verification | Self-reported only; CMS verifies SSN + address only | Primary source verification (boards, schools, registries) | Delegated to payer; not standardized | v1: self-attested + NPI Luhn; v2: NPPES + state boards |
| Provider search | Basic name/specialty/location via API | Within payer networks only | FHIR-based; payer network scoped | Multi-field search (NPI, name, specialty, type, org, status) |
| Endpoint directory | No (NPPES has no endpoint concept) | No | FHIR endpoint resource | Core feature — Neuron endpoint URL with health status + heartbeat |
| Connection brokering | No | No | No | Core differentiator — discover, verify, connect, exit |
| Cryptographic identity | No | No | OAuth/SMART on FHIR | Ed25519 key pairs; challenge-response; signed messages |
| Clinical action taxonomy | No | No | No | Unique differentiator — 7 atomic actions mapped to 49 provider types |
| Questionnaire system | No | Generic credentialing application | No | Type-specific conditional questionnaires feeding CANS.md generation |
| PHI handling | None (public directory data) | None (credentialing data only) | Patient data via PDex | Never — architectural guarantee |
| Open protocol spec | NPPES API documented but not a protocol | No | HL7 FHIR IG | 5 spec documents; independently implementable |
| Zero runtime dependencies | N/A (web service) | N/A (web service) | N/A (web service) | Yes — Node.js built-ins only |

---

## Sources

- [NPPES NPI Registry](https://npiregistry.cms.hhs.gov/) — Table stakes for NPI-keyed provider lookup; baseline for self-reported credential model (HIGH confidence)
- [CAQH ProView — Credentialing Suite](https://www.caqh.org/solutions/provider-data/credentialing-suite) — Primary source verification as credentialing table stakes; 120-day attestation model; single credentialing application accepted in all 50 states (HIGH confidence)
- [SNOMED CT 101 — IMO Health](https://www.imohealth.com/resources/snomed-ct-101-a-guide-to-the-international-terminology-system/) — Clinical terminology hierarchy features; polyhierarchy design; contrast with CPT/ICD mono-hierarchy billing codes (HIGH confidence)
- [Da Vinci PDex Plan-Net Implementation Guide](https://build.fhir.org/ig/HL7/davinci-pdex-plan-net/) — FHIR-based provider directory standard; features and requirements; US Core 6.1.0 alignment as of January 2026 (HIGH confidence)
- [CARIN Alliance Digital Identity Credential Policy — DirectTrust](https://directtrust.org/blog/news/carin-alliance-announces-nations-first-interoperable-digital-identity-credential-trust-framework-policy-developed-in-partnership-with-directtrust-and-kantara-initiative) — Healthcare trust framework; NIST 800-63 + PKI + RFC 3647 harmonization; 2025 standard (MEDIUM confidence)
- [National Healthcare Directory — CMS 2025](https://downloads.regulations.gov/CMS-2025-0050-0963/attachment_1.pdf) — CMS direction for national provider directory; FHIR as submission standard; 30-day update requirements (MEDIUM confidence)
- [Expert Guide to National Provider Directory — Healthcare IT Today, October 2025](https://www.healthcareittoday.com/2025/10/08/an-experts-guide-to-designing-a-national-provider-directory/) — Industry perspective on directory design; open standards emphasis (MEDIUM confidence)
- [Decentralized Identity for Healthcare — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9907408/) — DID/VC trust network patterns; self-sovereign identity in healthcare; portability and selective disclosure (MEDIUM confidence)
- [GSA PQC Experiment — Ed25519 in Federal Identity](https://www.idmanagement.gov/experiments/unifyia-pqc-experiment/) — Ed25519 usage in hybrid cryptographic identity schemes; healthcare-adjacent federal identity (MEDIUM confidence)

---
*Feature research for: @careagent/axon — Healthcare provider registry, clinical taxonomy, and trust/identity infrastructure*
*Researched: 2026-02-21*
