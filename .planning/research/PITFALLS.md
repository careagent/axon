# Domain Pitfalls

**Domain:** Healthcare provider registry, clinical action taxonomy, trust/identity infrastructure
**Project:** @careagent/axon
**Researched:** 2026-02-21

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or fundamental architectural failures.

---

### Pitfall 1: Taxonomy Granularity Trap -- Too Fine or Too Coarse

**What goes wrong:** The clinical action taxonomy is built at the wrong level of granularity. Too coarse (just `chart`, `order`, `perform`) and the whitelist-only scope model cannot distinguish between a neurosurgeon and a dermatologist. Too fine (`perform.craniotomy.posterior_fossa.suboccipital_approach`) and the taxonomy becomes unmaintainable, providers cannot navigate it during onboarding, and every subspecialty evolution requires a taxonomy release.

**Why it happens:** Healthcare terminologies face this exact problem. SNOMED CT contains over 350,000 concepts because clinical precision demands specificity. ICD-10 has over 70,000 codes. The instinct is to be "complete" -- to capture every clinical action at maximum specificity. But Axon is not a billing or charting system. It is a scope-definition vocabulary. The appropriate granularity is the level at which scope permissions differ between provider types, not the level at which clinical documentation differs.

**Consequences:**
- Too fine: Taxonomy balloons from hundreds to thousands of entries. Physician onboarding takes 30 minutes of scope selection. Taxonomy maintenance requires continuous clinical review for every subspecialty. The provider-core hardening engine must match against an unwieldy action space.
- Too coarse: Two providers with the same type but different subspecialties get identical permitted_actions. The scope whitelist fails to differentiate. The hardening engine cannot enforce meaningful boundaries.

**Prevention:**
- Define a "granularity test" before authoring the taxonomy: Can two providers of the same type but different subspecialties have meaningfully different permitted_actions at this level? If no, go finer. Can a provider select their scope in under 2 minutes? If no, go coarser.
- Start with two levels: atomic action + specific action (e.g., `perform.craniotomy`, not `perform.craniotomy.posterior_fossa`). Add a third level only when two providers of the same type genuinely need different permissions at that sub-action.
- The v1 Physician-only scope is the right time to test this. Build the Physician taxonomy, run a simulated onboarding, and measure: How many actions does a neurosurgeon select? A family medicine physician? If both select 40+ actions, the granularity is likely wrong.
- Design the taxonomy ID scheme to support future depth without breaking existing IDs. `chart.operative_note` can later gain children `chart.operative_note.spine` without invalidating the parent.

**Detection:**
- Warning sign: The taxonomy data file exceeds 500 actions for a single provider type before you have covered all 49 types.
- Warning sign: Simulated onboarding for a single provider takes more than 15 scope-selection choices.
- Warning sign: Two subspecialties within the same provider type (e.g., cardiology vs. neurology under Physician) end up with identical permitted_actions.

**Phase relevance:** Phase 1 (Taxonomy Data). This must be resolved before the taxonomy data is authored. Changing granularity after questionnaires are built (Phase 2) forces a rewrite of both.

**Confidence:** HIGH -- well-documented problem in healthcare terminology literature (PMC articles on SNOMED/LOINC granularity, constructing concise medical taxonomies).

---

### Pitfall 2: State-by-State Scope of Practice Variation Ignored in Taxonomy Design

**What goes wrong:** The taxonomy maps actions to provider types as if scope of practice is nationally uniform. It is not. A Nurse Practitioner in Arizona has full practice authority (can prescribe independently), while an NP in California has restricted practice authority (requires physician supervision for certain prescriptive actions). An optometrist in Oklahoma can perform certain laser procedures; in many other states they cannot. The taxonomy says "NPs can do `order.medication`" but reality says "NPs in some states can do `order.medication` and in others they need `order.medication` with a supervising physician co-signature."

**Why it happens:** The temptation is to model the "ideal" or "most permissive" scope for each provider type. HHS/ASPE documented significant inconsistencies across state regulatory frameworks including education verification, examination standards, and scope of practice definitions. 50 states plus territories means 50+ regulatory regimes. Modeling this accurately seems impossible for v1.

**Consequences:**
- A provider's CANS.md lists `order.medication` as a permitted action, but their state does not allow independent prescribing for their provider type. The CareAgent operates outside legal scope.
- Legal liability exposure: the system asserts a provider can do something they legally cannot.
- If discovered post-launch, requires either a taxonomy redesign (adding state qualifiers to every action) or a separate state-override mechanism bolted on.

**Prevention:**
- Explicitly acknowledge in the taxonomy data model that `applicable_types` is a necessary-but-not-sufficient condition. The taxonomy says "this type CAN perform this action in jurisdictions that allow it." The CANS.md generation must combine taxonomy + credential state + practice authority.
- Add a `regulatory_notes` field (already in the PRD data model) and populate it for known state-variable actions. Do not attempt to encode 50 state rulesets in v1.
- Add a `requires_supervision` or `practice_authority_dependent` boolean flag to actions where scope varies by state. This signals to provider-core that additional verification is needed during onboarding.
- Document this explicitly in the taxonomy guide: "The taxonomy defines clinical capability. State law defines legal authority. The CANS.md must reflect both."

**Detection:**
- Warning sign: A user reports that their CareAgent suggests actions outside their state's scope of practice.
- Warning sign: During questionnaire design for Advanced Practice Providers (Phase 2 extension / v2), every question about scope requires a "depends on your state" qualifier.

**Phase relevance:** Phase 1 (Taxonomy Data) for the flag design; Phase 2 (Questionnaires) for the onboarding integration; deferred to v2 for full state-by-state mapping.

**Confidence:** HIGH -- ASPE, HHS, AANP, and AMA all document extensive state-by-state variation.

---

### Pitfall 3: Self-Attested Credentials Create a False Sense of Trust

**What goes wrong:** v1 uses self-attested credentials with NPI format validation. The system verifies that an NPI is syntactically valid (10 digits, passes Luhn check) but does not verify that the NPI belongs to the person claiming it, that their license is actually active, or that their stated specialty matches their actual training. Anyone who knows a valid NPI format can register as any provider.

**Why it happens:** External credential verification (NPPES API, state licensing boards) is explicitly deferred to v2. NPI format validation catches typos but not impersonation. The NPPES system itself notes that all information is self-reported and CMS only verifies the SSN and that the business address is valid. The system inherits NPPES's own weakness and compounds it by not even checking against the NPPES public data.

**Consequences:**
- A patient CareAgent discovers a "provider" whose credentials are entirely fabricated. The handshake completes. Trust is established on a lie.
- If Axon is positioned as "trust infrastructure," self-attestation fundamentally undermines the trust claim. Users may assume "registered on Axon" means "verified" when it does not.
- When v2 adds real verification, existing self-attested entries must be re-verified or grandfathered, creating a two-tier trust problem.

**Prevention:**
- Make credential verification status maximally visible. The `verification_source: 'self_attested'` field exists in the PRD. Ensure it is prominently surfaced in every API response, every search result, and every connection brokering step. The patient CareAgent must display "credentials are self-reported and unverified" before any trust decision.
- Add a v1 "lightweight verification" step: cross-reference the NPI against the NPPES public data download (a monthly CSV, not a live API). This verifies that the NPI exists, is active, and matches the claimed name/specialty. This does not require an API integration -- it is a static data file check.
- Design the credential status flow to support progressive verification from day one. `self_attested` -> `nppes_matched` -> `state_board_verified` -> `institution_verified`. Each level adds trust without breaking the prior level.
- Never use language like "verified provider" or "trusted credentials" in v1. Use "registered" and "self-attested."

**Detection:**
- Warning sign: Documentation, API responses, or UI language implies verification that does not exist.
- Warning sign: No plan for how self-attested entries transition to verified entries in v2.
- Warning sign: The NPPES public data download is not being used even though it is freely available.

**Phase relevance:** Phase 3 (Registry Data Model). The credential model must be designed with progressive verification in mind from the start, even if v1 only implements self-attestation.

**Confidence:** HIGH -- NPPES documentation explicitly states self-reported nature; credential verification industry (Verisys, ProviderTrust, Medwave) all document these gaps.

---

### Pitfall 4: Handshake Protocol Designed Without Replay Attack Prevention

**What goes wrong:** The connection brokering handshake uses Ed25519 signatures on protocol messages, but if the challenge-response mechanism does not include proper nonces, timestamps, and sequence binding, signed messages can be captured and replayed. An attacker captures a valid `connection_request` message and replays it to establish unauthorized connections.

**Why it happens:** The PRD specifies Ed25519 signatures and challenge-response proving key possession, but does not detail nonce generation, timestamp windows, or message binding. It is easy to implement "sign this message, verify that signature" and believe the protocol is secure, while missing that the signed message must be non-replayable.

**Consequences:**
- Replay attacks allow unauthorized connection establishment.
- If Axon steps out after the handshake (by design), a replayed handshake gives the attacker the Neuron endpoint and connection details permanently.
- Retrofitting replay protection into an already-deployed protocol requires a breaking protocol version change.

**Prevention:**
- Every challenge-response MUST include: a cryptographically random nonce (at least 16 bytes), a timestamp with a maximum validity window (e.g., 5 minutes), and the identity of both parties bound into the signed payload.
- The Axon broker must track recently-used nonces within the validity window to reject replays. This is the one piece of state Axon must maintain during brokering (even though brokering is described as "stateless").
- The `AxonMessage` type already includes `message_id` (UUID v4) and `timestamp`. Add a `nonce` field. Make the signature cover all three plus both `sender` and `recipient` identities.
- Write explicit replay attack tests: capture a valid handshake, replay it 1 second later, verify it is rejected.

**Detection:**
- Warning sign: The protocol spec in `spec/handshake.md` does not mention nonces, replay attacks, or timestamp validation.
- Warning sign: The broker has no state whatsoever -- not even a short-lived nonce cache.
- Warning sign: Integration tests pass with the same message sent twice.

**Phase relevance:** Phase 4 (Protocol Specification and Connection Broker). Must be designed into the protocol spec before implementation.

**Confidence:** HIGH -- replay attacks are a well-documented vulnerability in challenge-response protocols; P2P trust infrastructure literature explicitly calls this out.

---

### Pitfall 5: Taxonomy-Questionnaire-CANS Coupling Creates a Three-Way Versioning Nightmare

**What goes wrong:** The taxonomy, questionnaires, and CANS.md format are three separate versioned artifacts that must stay in sync. A taxonomy version bump adds new actions. Questionnaires reference taxonomy action IDs for scope selection options. CANS.md records the taxonomy version used. If these three evolve independently, a questionnaire references an action that does not exist in the current taxonomy, or a CANS.md contains actions from a taxonomy version the current system does not recognize.

**Why it happens:** The PRD correctly identifies that the CANS.md should record `scope.taxonomy_version`. But the questionnaire also references taxonomy actions (in select options for permitted_actions). And the questionnaire has its own version. Three independent version numbers that must be kept in lockstep is a maintenance trap.

**Consequences:**
- Questionnaire v1.2.0 references `perform.robotic_surgery` added in taxonomy v1.3.0, but a system running taxonomy v1.2.0 rejects the action during validation.
- A CANS.md generated with taxonomy v1.0.0 contains `perform.craniotomy`. Taxonomy v2.0.0 renames it to `perform.surgical.craniotomy`. The CANS.md is now invalid against the current taxonomy.
- Provider-core pins taxonomy v1.0.0 while Axon ships v1.1.0. The questionnaire references v1.1.0 actions. Onboarding breaks.

**Prevention:**
- Pin questionnaires to a minimum taxonomy version. Each questionnaire declares `minimum_taxonomy_version: "1.0.0"` and the system validates at load time that the active taxonomy satisfies the minimum.
- Never remove or rename action IDs within a major version. The PRD's semver strategy is correct but must be enforced with automated tests: a test that loads taxonomy v1.0.0 action IDs and verifies they all exist in the latest v1.x.x.
- Build a compatibility matrix test that is run on every taxonomy or questionnaire change: load every questionnaire, resolve every taxonomy action it references, fail if any are missing.
- Consider bundling the taxonomy version with the questionnaire release rather than versioning them independently. A "questionnaire release" includes both the questionnaire data and the minimum taxonomy snapshot it was validated against.

**Detection:**
- Warning sign: A questionnaire references a taxonomy action ID that does not exist when you run `AxonTaxonomy.validateAction()` against it.
- Warning sign: Provider-core and Axon are on different taxonomy versions with no compatibility check.
- Warning sign: The CANS.md `scope.taxonomy_version` field is never checked at read time.

**Phase relevance:** Phase 1 (Taxonomy) and Phase 2 (Questionnaires). The versioning contract must be established in Phase 1 and enforced in Phase 2.

**Confidence:** HIGH -- this is a direct consequence of the PRD's three-artifact architecture; standard versioning problem in any system with cross-referencing versioned data.

---

## Moderate Pitfalls

Mistakes that cause significant rework or degrade system quality.

---

### Pitfall 6: File-Backed Registry Corrupts Under Concurrent Access

**What goes wrong:** The v1 in-memory/file-backed registry loses data or corrupts on concurrent writes. Two Neurons register providers simultaneously. Both read the current JSON file, both append their entry, both write. One write overwrites the other. Or the Node.js process crashes mid-write, leaving a truncated JSON file that cannot be parsed on restart.

**Why it happens:** Node.js is single-threaded for JavaScript execution but `fs.writeFile` is not atomic. If the process crashes between truncating the file and completing the write, the file is corrupted. If multiple async operations read-modify-write the same file without serialization, last-write-wins.

**Prevention:**
- Use write-ahead serialization: maintain a write queue that processes one write at a time. Never allow concurrent read-modify-write cycles on the registry file.
- Use atomic file writes: write to a temporary file, then `fs.rename()` (which is atomic on most filesystems) to replace the original. This prevents truncation corruption.
- On startup, validate the JSON file parses correctly. If it does not, fall back to a `.bak` copy that was written before the last successful update.
- Keep the in-memory store as the source of truth. Persist to disk asynchronously but with the atomic write pattern. Accept that a crash loses at most the last write.

**Detection:**
- Warning sign: Tests do not include concurrent registration scenarios.
- Warning sign: No `.bak` or recovery mechanism exists.
- Warning sign: `fs.writeFileSync` or `fs.writeFile` is called directly on the registry file without atomic rename.

**Phase relevance:** Phase 3 (Registry Data Model and Storage).

**Confidence:** HIGH -- well-documented Node.js file I/O issue; multiple sources describe the atomic rename pattern.

---

### Pitfall 7: NPI as Primary Key Without Considering NPI Reuse and Deactivation

**What goes wrong:** The registry uses NPI as the primary key (`npi: string` is the key in `RegistryEntry`), assuming NPIs are permanent unique identifiers. While NPIs are never reused according to CMS policy, NPIs can be deactivated (provider dies, retires, or their enrollment is revoked). A deactivated NPI that remains in the registry as `credential_status: 'active'` misleads patient CareAgents. Worse, the system has no mechanism to detect or reflect NPI deactivation.

**Why it happens:** NPI is the natural key -- every provider has one, it is unique, and it is the standard identifier. But NPI status is dynamic. CMS publishes deactivation data, but v1 does not consume it. The registry becomes stale.

**Prevention:**
- Design the registry entry lifecycle to include a `registry_status` field separate from `credential_status`. A provider can have `registry_status: 'active'` and `credential_status: 'pending'`, or `registry_status: 'deactivated'`.
- For v1, accept staleness but document it. The registry reflects the state at registration time. Add a `last_verified` timestamp to signal data freshness.
- Plan for v2: periodic reconciliation against the NPPES deactivation file (published monthly). Flag entries whose NPIs appear in the deactivation list.
- Never delete deactivated entries. Mark them as deactivated and exclude from search results by default, but retain the audit trail.

**Detection:**
- Warning sign: No mechanism to mark a registry entry as deactivated after initial registration.
- Warning sign: Search results include providers whose NPIs were deactivated months ago.
- Warning sign: The `RegistryEntry` type has no `registry_status` or `deactivated_at` field.

**Phase relevance:** Phase 3 (Registry Data Model).

**Confidence:** MEDIUM -- NPI deactivation data exists (John Snow Labs dataset, CMS NPPES); the risk is real but NPI reuse is not a current CMS practice.

---

### Pitfall 8: Ed25519 Key Format Mismatch Between Node.js and External Systems

**What goes wrong:** Node.js `crypto` module uses DER-encoded keys for Ed25519 operations. The natural representation for Ed25519 public keys is 32 raw bytes (or 64 hex characters). If the protocol spec defines keys as raw bytes but the implementation uses DER, or vice versa, every external implementation (patient-core, provider-core, neuron, or future third-party implementations) must match the encoding. Mismatched key formats cause signature verification failures that are extremely difficult to debug.

**Why it happens:** Node.js does not support hex-encoded Ed25519 keys natively. The `crypto.createPublicKey()` function requires SPKI/DER format. Converting between raw 32-byte keys and DER-wrapped keys requires knowing the exact DER prefix bytes. This is a documented source of confusion.

**Prevention:**
- Choose one canonical key format for the protocol and document it in `spec/identity.md`. Recommendation: use raw 32-byte keys in the protocol wire format (base64url-encoded) because this is implementation-agnostic. Provide utility functions to convert to/from Node.js DER format.
- Build explicit key serialization/deserialization functions and test them against known test vectors from the Ed25519 RFC (RFC 8032).
- Include at least three key format tests: generate key in Node.js, export as protocol format, reimport and verify a signature. This catches round-trip encoding bugs.
- Document the exact DER prefix bytes for Ed25519 keys in the protocol spec so non-Node.js implementations can construct DER keys.

**Detection:**
- Warning sign: Key generation works but signature verification fails intermittently.
- Warning sign: The protocol spec does not specify key encoding format.
- Warning sign: No test vectors from RFC 8032 are used in the test suite.

**Phase relevance:** Phase 4 (Protocol Specification and Connection Broker).

**Confidence:** HIGH -- Node.js documentation and multiple community sources (Keygen blog, GitHub issues) confirm DER encoding confusion with Ed25519.

---

### Pitfall 9: Questionnaire Conditional Logic Becomes Untestable

**What goes wrong:** The Physician questionnaire has conditional branching: surgical vs. non-surgical, academic vs. private practice, subspecialty-specific actions. The conditional logic is encoded as declarative `QuestionCondition` objects in data. As the questionnaire grows, the condition graph becomes a tree with dozens of branches. Some branches are mutually exclusive. Some compound. Testing all paths requires combinatorial explosion of answer sets. Untested paths produce invalid CANS.md output.

**Why it happens:** Declarative conditional logic is the right design (the PRD correctly specifies "questionnaires are data, not code"). But declarative does not mean "automatically tested." Each `QuestionCondition` can reference any prior `question_id` with operators `equals`, `includes`, `not_equals`. Complex questionnaires create a directed graph of conditions. Without systematic path coverage, dead branches or impossible conditions go undetected.

**Prevention:**
- Build a questionnaire path analyzer that traverses the condition graph and enumerates all reachable question sets. Run this as a build-time validation.
- For each questionnaire, generate a "minimum answer set" for each reachable path and verify it produces a valid CANS.md fragment.
- Require that every `QuestionCondition` references a question that appears earlier in the questionnaire (topological ordering). Reject circular or forward references at load time.
- For the Physician questionnaire specifically: enumerate the key branching paths (surgical/non-surgical x academic/private x each major subspecialty group) and write one test fixture per path.

**Detection:**
- Warning sign: The Physician questionnaire has conditions referencing question IDs that do not exist.
- Warning sign: No test exercises a specific conditional branch (e.g., the "surgical + academic + neurosurgery" path).
- Warning sign: A question's `condition` references a question that appears after it in the section ordering.

**Phase relevance:** Phase 2 (Questionnaire Repository).

**Confidence:** MEDIUM -- standard problem with declarative conditional systems; specific to this project's questionnaire architecture.

---

### Pitfall 10: Provider Type Categorization Does Not Match Real-World Provider Identity

**What goes wrong:** The 49 provider categories are clean and mutually exclusive. Real providers are not. A Physician Assistant (PA) working in surgery may identify more with the Surgical category than the Advanced Practice Providers category. A Certified Registered Nurse Anesthetist (CRNA) appears under Advanced Practice Providers but their daily actions overlap heavily with Anesthesia Technology. A provider with multiple certifications (e.g., an RN who is also a IBCLC lactation consultant) must choose a primary type but their scope spans two categories.

**Why it happens:** The 49 categories are modeled as the provider's professional identity, but scope of practice is role-based and context-dependent. A provider's permitted actions depend not just on their credential type but on their current practice setting, institutional privileges, and collaborative agreements.

**Prevention:**
- The `provider_types` field is already an array in the PRD (`provider_types?: string[]`). Ensure the taxonomy lookup (`getActionsForTypes()` -- plural) correctly unions the action sets across multiple types. A provider who is both "Nursing" and "Lactation" gets the union of both action sets.
- During questionnaire design, handle multi-type providers explicitly. If a provider selects two types, both questionnaires should load (in sequence or merged). The PRD already has `getForType()` (singular); add guidance that callers should call it once per type.
- Do not force providers into a single "primary" type. The CANS.md `provider.types[]` is already an array. Let the scope be the union.
- Accept that the 49 categories are a starting taxonomy. Some categories may need to be split or merged based on real-world feedback. Design the category list as versioned data (it already is: `data/provider-types.json`) so it can evolve.

**Detection:**
- Warning sign: `getActionsForType()` is implemented but `getActionsForTypes()` is not, or the plural version is just an alias.
- Warning sign: Onboarding forces a single provider type selection.
- Warning sign: The questionnaire system has no story for providers who select multiple types.

**Phase relevance:** Phase 1 (Provider Type Definitions) and Phase 2 (Questionnaires).

**Confidence:** MEDIUM -- based on the PRD's own 49-category structure and healthcare workforce literature on overlapping roles.

---

## Minor Pitfalls

Mistakes that cause friction, tech debt, or user confusion.

---

### Pitfall 11: Neuron Heartbeat Becomes a Polling Bomb

**What goes wrong:** The registry maintains heartbeat status for Neuron endpoints (`last_heartbeat`, `health_status`). If Axon polls every registered Neuron periodically, and the registry grows to thousands of Neurons, the heartbeat polling becomes a significant network load. If Neurons push heartbeats, a flood of heartbeat messages can overwhelm the registry.

**Prevention:**
- For v1, do not implement active polling at all. Record the last heartbeat timestamp when a Neuron voluntarily pings or performs any API operation. Mark endpoints as `unknown` if no activity for a configurable threshold (e.g., 24 hours). Check endpoint reachability on-demand during connection brokering, not proactively.
- For v2, use exponential backoff: poll frequently for recently-registered Neurons, less frequently for established ones. Batch heartbeat checks.

**Phase relevance:** Phase 3 (Neuron Endpoint Directory).

**Confidence:** MEDIUM -- standard distributed systems concern.

---

### Pitfall 12: Audit Log Grows Without Bounds

**What goes wrong:** The PRD specifies audit logging for registration events, credential updates, connection brokering events, and search queries. With file-backed storage, the audit log file grows indefinitely. In production (v2), this becomes a storage and performance concern. In v1, a long-running development instance accumulates a multi-megabyte log that slows down file reads.

**Prevention:**
- Implement log rotation from day one: when the audit log exceeds a size threshold (e.g., 10MB), rotate to a timestamped archive file.
- Separate the audit log file from the registry data file. Never store audit entries in the same JSON file as registry entries.
- Use append-only writes for the audit log (JSONL format: one JSON object per line). This avoids the read-parse-append-serialize-write cycle that the registry file requires.

**Phase relevance:** Phase 3 (Registry) and Phase 4 (Broker audit logging).

**Confidence:** HIGH -- basic operational concern.

---

### Pitfall 13: Bearer Token Authentication Provides No Real Security in v1

**What goes wrong:** v1 uses bearer tokens for consumer authentication. If the bearer tokens are static secrets shared between packages, they provide no meaningful security -- anyone who reads the source code (Apache 2.0, open source) knows the tokens. If the tokens are generated at deployment time, there is no token lifecycle management in v1.

**Prevention:**
- Accept that v1 consumer authentication is trust-on-first-use within a closed development environment. Do not pretend bearer tokens provide security in an open-source package.
- Design the authentication interface abstractly: `interface AuthProvider { authenticate(request): Promise<AuthResult> }`. Implement `StaticTokenAuthProvider` for v1 and `MutualTLSAuthProvider` for v2.
- Do not embed tokens in source code. Use environment variables or a configuration file excluded from version control.
- Document explicitly: "v1 authentication is a development convenience, not a security boundary. Do not deploy v1 authentication in any environment where untrusted parties have network access to Axon."

**Phase relevance:** Phase 4 (Protocol) and Phase 5 (API Client).

**Confidence:** HIGH -- inherent limitation of bearer tokens in open-source packages.

---

### Pitfall 14: Taxonomy Action IDs Conflate Identity with Hierarchy

**What goes wrong:** The taxonomy uses dot-notation for action IDs (`chart.operative_note`). The dot implies hierarchy: `chart` is the parent, `operative_note` is the child. But if the ID is also the stable identifier recorded in CANS.md, reorganizing the hierarchy (moving `chart.operative_note` under a new `chart.surgical` parent to become `chart.surgical.operative_note`) breaks every existing CANS.md reference.

**Prevention:**
- Treat the dot-notation ID as a stable opaque identifier, not a hierarchical path. The hierarchy is expressed through the `parent` and `children` fields in `TaxonomyAction`, not through the ID string.
- Establish a rule: once an action ID is published in a released taxonomy version, it is immutable within that major version. Reorganizing the hierarchy uses the `parent`/`children` fields without changing IDs.
- Add a migration guide for major version bumps that includes an ID mapping table (old ID -> new ID).

**Phase relevance:** Phase 1 (Taxonomy Data).

**Confidence:** HIGH -- standard issue with hierarchical identifiers in versioned systems; SNOMED CT literature documents this as "codes should never change."

---

### Pitfall 15: Questionnaire CANS Field Mappings Assume a Static CANS Schema

**What goes wrong:** Each questionnaire question maps to a CANS field via `cans_field: string` (e.g., `"scope.permitted_actions"`). If provider-core evolves its CANS.md schema (adds fields, renames sections, restructures), the questionnaire mappings break silently. The questionnaire produces output that does not match the consuming schema.

**Prevention:**
- Publish the CANS schema as a shared TypeScript type exported from provider-core (or from a shared types package). Axon's questionnaire validation (QUES-06) should import this type and validate `cans_field` paths against it at build time.
- If a shared type is not feasible for v1, maintain a CANS field allowlist in Axon that is manually synced with provider-core. Run a cross-repo integration test that imports a questionnaire, generates CANS fields, and validates them against provider-core's schema.
- Version the CANS schema independently and record `cans_schema_version` alongside `taxonomy_version` in generated CANS.md.

**Phase relevance:** Phase 2 (Questionnaires) and Phase 5 (Integration).

**Confidence:** MEDIUM -- cross-repo dependency; provider-core is "fully built" so its schema is relatively stable, but evolution is inevitable.

---

## Phase-Specific Warnings

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|---------------|------------|
| Phase 1 | Taxonomy Data | Granularity trap (Pitfall 1); ID-hierarchy conflation (Pitfall 14) | Define granularity test criteria before authoring; treat IDs as opaque |
| Phase 1 | Taxonomy Data | State scope variation (Pitfall 2) | Add `practice_authority_dependent` flag to state-variable actions |
| Phase 1 | Provider Types | Multi-type providers (Pitfall 10) | Ensure `getActionsForTypes()` (plural) works as union, not intersection |
| Phase 2 | Questionnaires | Conditional logic untestable (Pitfall 9) | Build path analyzer; topological ordering validation |
| Phase 2 | Questionnaires | Taxonomy-questionnaire version coupling (Pitfall 5) | Pin questionnaires to minimum taxonomy version; compatibility matrix test |
| Phase 2 | Questionnaires | CANS field drift (Pitfall 15) | Validate cans_field paths against provider-core schema |
| Phase 3 | Registry Storage | File corruption on concurrent writes (Pitfall 6) | Atomic rename writes; write queue serialization |
| Phase 3 | Registry Data | Self-attested credentials false trust (Pitfall 3) | Surface verification_source prominently; consider NPPES data download |
| Phase 3 | Registry Data | NPI deactivation not tracked (Pitfall 7) | Add registry_status field; plan for deactivation reconciliation |
| Phase 3 | Endpoints | Heartbeat polling bomb (Pitfall 11) | Passive heartbeat tracking only in v1; on-demand health checks |
| Phase 4 | Protocol | Replay attack vulnerability (Pitfall 4) | Nonces, timestamp windows, nonce cache in broker |
| Phase 4 | Protocol | Ed25519 key format mismatch (Pitfall 8) | Canonical wire format; DER conversion utilities; RFC 8032 test vectors |
| Phase 4 | Protocol | Bearer token false security (Pitfall 13) | Abstract auth interface; document v1 limitations explicitly |
| Phase 5 | Integration | Three-way versioning (Pitfall 5) | Compatibility matrix test across taxonomy, questionnaire, and CANS |
| Phase 5 | Integration | CANS schema drift (Pitfall 15) | Cross-repo integration tests |

---

## Sources

### Healthcare Terminology and Taxonomy
- [Clinical Classification and Terminology: Some History and Current Observations](https://pmc.ncbi.nlm.nih.gov/articles/PMC61433/) -- PMC article on taxonomy design challenges
- [Maintaining terminology in healthcare](https://rhapsody.health/blog/maintaining-terminology-in-healthcare/) -- Rhapsody Health on terminology maintenance
- [Constructing a concise medical taxonomy](https://pmc.ncbi.nlm.nih.gov/articles/PMC545132/) -- PMC on taxonomy granularity challenges
- [SNOMED CT and LOINC granularity analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC6115234/) -- PMC on complementary granularity levels
- [Quantitative analysis of biomedical terminology comprehensiveness](https://www.nature.com/articles/s41598-025-17737-0) -- Nature Scientific Reports
- [Medical Coding Dictionary Management and Maintenance](https://scdm.org/wp-content/uploads/2024/07/Medical-Coding-Dictionary-Management-Maintenance.pdf) -- SCDM whitepaper

### NPI and Provider Registry
- [NPPES NPI Registry](https://npiregistry.cms.hhs.gov/) -- CMS official registry
- [Using the NPI for Health Care Workforce Evaluation](https://pmc.ncbi.nlm.nih.gov/articles/PMC3983736/) -- PMC on NPPES data quality issues
- [NPPES Data Changes Federal Register](https://www.federalregister.gov/documents/2024/03/04/2024-04517/national-plan-and-provider-enumeration-system-nppes-data-changes) -- CMS data change notice
- [Healthcare Providers Deactivated NPI](https://www.johnsnowlabs.com/marketplace/healthcare-providers-deactivated-national-provider-identifier/) -- John Snow Labs deactivation dataset

### Credential Verification
- [The Worst Credentialing Problems and How to Solve Them](https://medwave.io/2025/06/worst-credentialing-problems-how-to-solve-them/) -- Medwave 2025
- [Common Credentialing Mistakes to Avoid](https://www.prospyrmed.com/blog/post/10-common-credentialing-mistakes-to-avoid) -- Prospyr Med
- [Avoiding Costly Credentialing Issues in Healthcare](https://verisys.com/blog/avoiding-costly-credentialing-issues-healthcare/) -- Verisys
- [Healthcare License Verification and Monitoring](https://verisys.com/solutions/license-verification/) -- Verisys solutions

### Scope of Practice and State Variation
- [Barriers and Opportunities for Improving Interstate Licensure](https://aspe.hhs.gov/sites/default/files/documents/405ad876b1de337a81b4db0257666586/barriers-opportunities-improving-interstate-licensure.pdf) -- HHS/ASPE 2024 Issue Brief
- [Multi-State Licensing in Provider Credentialing](https://medwave.io/2025/05/multi-state-licensing-in-provider-credentialing/) -- Medwave 2025
- [State Practice Environment](https://www.aanp.org/advocacy/state/state-practice-environment) -- AANP on NP scope variation
- [What is scope of practice?](https://www.ama-assn.org/practice-management/scope-practice/what-scope-practice) -- AMA

### Cryptography and Protocol
- [SSH Key Best Practices for 2025](https://www.brandonchecketts.com/archives/ssh-ed25519-key-best-practices-for-2025) -- Ed25519 best practices
- [How to Use Hexadecimal Ed25519 Public Keys in Node.js](https://keygen.sh/blog/how-to-use-hexadecimal-ed25519-keys-in-node/) -- Keygen blog on Node.js DER encoding
- [Node.js crypto documentation](https://nodejs.org/api/crypto.html) -- Official Node.js docs
- [SSH Key Management Mistakes](https://www.sshkeybox.com/common-ssh-key-management-mistakes-and-how-to-avoid-them/) -- Key management pitfalls

### P2P Trust Infrastructure
- [Managing trust in peer-to-peer systems](https://www.bcs.org/articles-opinion-and-research/managing-trust-in-peer-to-peer-systems) -- BCS on P2P trust
- [Peer-to-Peer Trust Whitepaper](https://trustoverip.github.io/WP0010-toip-foundation-whitepaper/trust/p2p_trust/) -- Trust over IP Foundation
- [Towards a refined architecture for decentralized identity services](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2025.1696955/full) -- Frontiers 2025

### Healthcare Consent Management
- [Consent Management Challenges in Healthcare Data Sharing 2025](https://secureprivacy.ai/blog/healthcare-data-sharing-challenges-2025) -- SecurePrivacy
- [Google Healthcare Consent Management API](https://cloud.google.com/blog/topics/healthcare-life-sciences/googles-healthcare-consent-management-api-protects-user-data) -- Google Cloud
- [Patient Consent Management by Purpose-Based Model](https://pmc.ncbi.nlm.nih.gov/articles/PMC7674812/) -- PMC on blockchain-based consent

### Healthcare Interoperability Lessons
- [FHIR Standard: Systematic Literature Review](https://pmc.ncbi.nlm.nih.gov/articles/PMC8367140/) -- PMC review of FHIR implementations
- [Building Standards Infrastructure for Healthcare AI](https://blog.hl7.org/building-the-standards-infrastructure-for-healthcare-ai-lessons-from-the-interoperability-journey) -- HL7 blog on interoperability lessons

### Node.js File I/O and Concurrency
- [Mastering Node.js Concurrency: Race Condition Detection](https://medium.com/@zuyufmanna/mastering-node-js-concurrency-race-condition-detection-and-prevention-3e0cfb3ccb07)
- [Node.js race conditions](https://nodejsdesignpatterns.com/blog/node-js-race-conditions/) -- Node.js Design Patterns blog
