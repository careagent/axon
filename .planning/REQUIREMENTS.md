# Requirements: @careagent/axon

**Defined:** 2026-02-21
**Core Value:** Axon must provide a trusted, open, neutral discovery and handshake layer so that any patient CareAgent can find any provider CareAgent and establish a direct peer-to-peer connection — without Axon ever touching PHI or remaining in the communication path after the handshake.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Package Foundation

- [x] **AXON-01**: Package scaffold with pnpm, TypeScript, tsdown build, vitest testing, and zero runtime npm dependencies
- [x] **AXON-02**: Package exports TypeScript types, classes, and data for authorized consumers (provider-core, patient-core, neuron)
- [x] **AXON-03**: Multiple entry points: full package, taxonomy-only, questionnaires-only, types-only

### Clinical Action Taxonomy

- [x] **TAXO-01**: Hierarchical action vocabulary with dot-notation identifiers under seven atomic actions (chart, order, charge, perform, interpret, educate, coordinate)
- [x] **TAXO-02**: Every action maps to one or more of the 49 provider types via `applicable_types`
- [x] **TAXO-03**: Taxonomy is versioned with semver; CANS.md records which taxonomy version was used (`scope.taxonomy_version`)
- [x] **TAXO-04**: `AxonTaxonomy.getActionsForType()` returns all valid actions for a given provider type
- [x] **TAXO-05**: `AxonTaxonomy.validateAction()` confirms an action ID exists in the current taxonomy version
- [x] **TAXO-06**: Full Physician (MD, DO) action set in v1; common cross-type actions for all 49 types; type-specific actions for others are v2
- [x] **TAXO-07**: Taxonomy data is a versioned JSON data file (`data/taxonomy/v1.0.0.json`), not hardcoded enums

### Questionnaire Repository

- [x] **QUES-01**: TypeBox schema for questionnaire format with conditional logic, CANS field mapping, and taxonomy-backed options
- [x] **QUES-02**: Full Physician questionnaire with conditional branching (surgical/non-surgical, academic/private practice), taxonomy-backed scope selection, and CANS field mapping
- [x] **QUES-03**: Stub questionnaires for all 48 remaining provider types (valid metadata, empty sections)
- [x] **QUES-04**: `AxonQuestionnaires.getForType()` returns the appropriate questionnaire for a given provider type
- [x] **QUES-05**: All taxonomy actions referenced in questionnaire options exist in the current taxonomy version
- [x] **QUES-06**: All CANS field paths referenced in questionnaire mappings are valid against the CANS schema

### Registry

- [x] **REGI-01**: TypeBox schemas for RegistryEntry, NeuronEndpoint, CredentialRecord, OrganizationAffiliation
- [x] **REGI-02**: NPI validation (Luhn check algorithm with 80840 prefix, 10-digit format validation)
- [x] **REGI-03**: In-memory registry with file-backed JSON persistence for development (atomic write-to-temp-then-rename pattern)
- [x] **REGI-04**: `AxonRegistry` supports provider/Neuron registration, credential management, and search
- [x] **REGI-05**: Search supports queries by NPI, name, specialty, provider type, organization, and credential status

### Protocol

- [x] **PROT-01**: Handshake specification documented in `spec/handshake.md` and implemented in code
- [x] **PROT-02**: Identity exchange using Ed25519 key pairs via Node.js built-in `node:crypto` with canonical base64url wire format
- [x] **PROT-03**: Versioned message format with TypeBox schema validation, nonce (>=16 bytes), and timestamp window (5 minutes)
- [x] **PROT-04**: Consent token format (signed by patient's key pair, verified by Neuron, never stored by Axon)
- [x] **PROT-05**: Credential format standard matching the registry CredentialRecord schema

### Connection Brokering

- [x] **BROK-01**: `AxonBroker.connect()` implements handshake: credential check -> endpoint lookup -> connection grant/deny
- [x] **BROK-02**: Connections with expired/suspended/revoked credentials are denied
- [x] **BROK-03**: All brokering events logged to audit trail (append-only, connection-level, no clinical content)

### Client

- [x] **CLIT-01**: `AxonRegistry`, `AxonBroker`, `AxonTaxonomy`, `AxonQuestionnaires` exported from package entry point
- [x] **CLIT-02**: Consumer-specific entry points (taxonomy-only, registry-only, questionnaires-only, types-only) via tsdown multi-entry
- [x] **CLIT-03**: Mock Axon server for consumer integration testing (provider-core, patient-core, neuron)

### Integration

- [x] **INTG-01**: Provider-core can consume taxonomy for `scope.permitted_actions` selection during onboarding
- [x] **INTG-02**: Patient-core can consume registry for provider discovery and connection initiation
- [x] **INTG-03**: Neuron can consume registry for organization/provider registration and endpoint management

### Documentation

- [ ] **DOCS-01**: Architecture guide (`docs/architecture.md`)
- [ ] **DOCS-02**: Protocol specification (5 spec documents in `spec/`: handshake, identity, message, consent, credential)
- [x] **DOCS-03**: Governance model (`docs/governance.md`)
- [x] **DOCS-04**: Taxonomy guide (`docs/taxonomy.md`)
- [x] **DOCS-05**: Questionnaire authoring guide (`docs/questionnaire-authoring.md`)
- [ ] **DOCS-06**: CONTRIBUTING.md and release preparation

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### External Verification

- **REGI-06**: External credential verification via NPPES API and state licensing board APIs
- **REGI-07**: Production-grade registry backend (database, replication, high availability)
- **REGI-08**: Geo-aware provider search with geospatial indexing and address normalization

### Protocol Enhancements

- **PROT-06**: X25519 key exchange for forward secrecy
- **PROT-07**: Mutual TLS for consumer authentication (replacing v1 bearer tokens)

### Taxonomy Expansion

- **TAXO-08**: Full action sets for all 49 provider types (each requires clinical domain expert review)
- **TAXO-09**: Professional society maintenance interface for taxonomy subsets

### Questionnaire Expansion

- **QUES-07**: Full questionnaires for all 49 provider types (each requires clinical domain expert review)

### Governance

- **GOV-01**: Open foundation governance structure implementation
- **GOV-02**: Protocol change proposal and review process

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| PHI storage or transit | Axon is trust infrastructure, not clinical infrastructure. Handling PHI would make Axon a HIPAA covered entity. Clinical content flows peer-to-peer after handshake. |
| Patient registration on Axon | Patients are sovereign. Registering patients creates a central database of who is seeking care — directly violates patient sovereignty. |
| Third-party API access | Axon is closed infrastructure for authorized ecosystem participants. Third-party applications integrate through Neuron. |
| Real-time clinical messaging relay | Axon is for discovery and handshake, not ongoing communication. After handshake, communication flows directly through Neuron. |
| Credential issuance | Axon verifies credentials, it does not issue them. Credentials come from state licensing boards, certification bodies, and institutions. |
| Production database in v1 | Production infrastructure adds complexity that blocks the demo. v1 uses in-memory/file-backed storage. |
| Geo-aware search in v1 | Location-based search requires geospatial indexing infrastructure. v1 uses simple string matching. |
| Full questionnaires for all 49 types in v1 | Each questionnaire requires clinical domain expert review. v1 builds Physician only; 48 valid stubs. |
| Session state after handshake | Contradicts the "transmits and exits" design principle. Every connect() is a complete atomic transaction. |
| Free-text taxonomy entries | Defeats the controlled vocabulary purpose. The hardening engine cannot validate free-text. Edge cases go through governance. |
| Open registration without Neuron | Enables credential spoofing. Neuron acts as authenticated gateway for provider registration. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AXON-01 | Phase 1: Package Foundation and Clinical Action Taxonomy | Complete |
| TAXO-01 | Phase 1: Package Foundation and Clinical Action Taxonomy | Complete |
| TAXO-02 | Phase 1: Package Foundation and Clinical Action Taxonomy | Complete |
| TAXO-03 | Phase 1: Package Foundation and Clinical Action Taxonomy | Complete |
| TAXO-04 | Phase 1: Package Foundation and Clinical Action Taxonomy | Complete |
| TAXO-05 | Phase 1: Package Foundation and Clinical Action Taxonomy | Complete |
| TAXO-06 | Phase 1: Package Foundation and Clinical Action Taxonomy | Complete |
| TAXO-07 | Phase 1: Package Foundation and Clinical Action Taxonomy | Complete |
| QUES-01 | Phase 2: Questionnaire Repository | Complete |
| QUES-02 | Phase 2: Questionnaire Repository | Complete |
| QUES-03 | Phase 2: Questionnaire Repository | Complete |
| QUES-04 | Phase 2: Questionnaire Repository | Complete |
| QUES-05 | Phase 2: Questionnaire Repository | Complete |
| QUES-06 | Phase 2: Questionnaire Repository | Complete |
| REGI-01 | Phase 3: Registry and Credentials | Complete |
| REGI-02 | Phase 3: Registry and Credentials | Complete |
| REGI-03 | Phase 3: Registry and Credentials | Complete |
| REGI-04 | Phase 3: Registry and Credentials | Complete |
| REGI-05 | Phase 3: Registry and Credentials | Complete |
| PROT-01 | Phase 4: Protocol Specification and Connection Broker | Complete |
| PROT-02 | Phase 4: Protocol Specification and Connection Broker | Complete |
| PROT-03 | Phase 4: Protocol Specification and Connection Broker | Complete |
| PROT-04 | Phase 4: Protocol Specification and Connection Broker | Complete |
| PROT-05 | Phase 4: Protocol Specification and Connection Broker | Complete |
| BROK-01 | Phase 4: Protocol Specification and Connection Broker | Complete |
| BROK-02 | Phase 4: Protocol Specification and Connection Broker | Complete |
| BROK-03 | Phase 4: Protocol Specification and Connection Broker | Complete |
| AXON-02 | Phase 5: Client Facade, Package Exports, and Integration | Complete |
| AXON-03 | Phase 5: Client Facade, Package Exports, and Integration | Complete |
| CLIT-01 | Phase 5: Client Facade, Package Exports, and Integration | Complete |
| CLIT-02 | Phase 5: Client Facade, Package Exports, and Integration | Complete |
| CLIT-03 | Phase 5: Client Facade, Package Exports, and Integration | Complete |
| INTG-01 | Phase 5: Client Facade, Package Exports, and Integration | Complete |
| INTG-02 | Phase 5: Client Facade, Package Exports, and Integration | Complete |
| INTG-03 | Phase 5: Client Facade, Package Exports, and Integration | Complete |
| DOCS-01 | Phase 6: Documentation and Release | Pending |
| DOCS-02 | Phase 6: Documentation and Release | Pending |
| DOCS-03 | Phase 6: Documentation and Release | Complete |
| DOCS-04 | Phase 6: Documentation and Release | Complete |
| DOCS-05 | Phase 6: Documentation and Release | Complete |
| DOCS-06 | Phase 6: Documentation and Release | Pending |

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 after roadmap creation*
