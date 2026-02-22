# @careagent/axon

**The open foundation network layer for the CareAgent ecosystem.**

@careagent/axon is the trust registry, discovery service, connection broker, and protocol specification that makes cross-installation communication between sovereign CareAgent installations possible. It is the pathway between Neurons — it transmits, it does not think. The intelligence lives in the CareAgents. Axon governs the channel between them.

---

## What This Package Does

@careagent/axon is a TypeScript library that provides:

**1. Clinical Action Taxonomy** — a versioned, data-driven taxonomy of clinical actions organized by provider type. The taxonomy governs what each provider type is permitted to do on the network. See [docs/taxonomy.md](docs/taxonomy.md).

**2. Provider Questionnaire System** — declarative JSON questionnaires that determine a provider's digital scope of practice during onboarding. Clinical domain experts author questionnaires without writing code. See [docs/questionnaire-authoring.md](docs/questionnaire-authoring.md).

**3. Provider Registry** — an NPI-keyed directory of registered providers and organizations with credential records and Neuron endpoint tracking. Patients are never registered on Axon.

**4. Connection Broker** — a stateless pipeline that brokers the initial handshake between a patient's CareAgent and a provider's Neuron using Ed25519 signed messages. Axon steps out of the way after the handshake -- clinical content flows peer to peer.

**5. Protocol Specification** — the handshake, identity, message, consent, and credential standards that make the network interoperable. See [spec/](spec/).

**6. Mock HTTP Server** — a development server used by @careagent/neuron, @careagent/provider-core, and @careagent/patient-core for integration testing. See [docs/architecture.md](docs/architecture.md).

Direct third-party access to Axon is not permitted. All third-party integration happens through Neuron -- see [careagent/neuron](https://github.com/careagent/neuron).

---

## The Neuron: The Organizational Endpoint

A Neuron is a lightweight application run by any NPI-holding organization — a medical practice, hospital, pharmacy, imaging center, or laboratory. It is the public-facing endpoint for that organization on the Axon network.

The Neuron sits between Axon and the individual provider CareAgents behind it. Provider CareAgents are never exposed directly to the Axon network — they sit behind Neuron, which manages all inbound and outbound connections on their behalf.

The Neuron maintains a barebones list of established patient care relationships — not clinical data, only the routing information needed to connect an incoming patient CareAgent to the correct provider CareAgent. When a patient's CareAgent initiates a connection, Axon brokers the initial handshake and then hands off to Neuron. From that point forward, Neuron manages the communication. Axon is no longer in the path.

This separation is deliberate. Axon handles discovery and initial trust. The Neuron handles the ongoing relationship.

See [careagent/neuron](https://github.com/careagent/neuron) for full documentation.

---

## Core Principle: Axon Must Be an Open Foundation

Axon cannot be proprietary infrastructure controlled by a single commercial entity. Every provider-patient CareAgent connection passes through it for the handshake. That kind of infrastructure must be:

- **Community governed** — no single entity controls the network
- **Fully auditable** — every architectural decision and line of code is open
- **Permanently available** — the foundation can outlive any individual company or project
- **Free at the organizational level** — no access fees for Neurons to register or patient CareAgents to discover providers

The parallel to other open health infrastructure is instructive. HL7, FHIR, and the NPI registry are the standards and directories that actually got adopted in healthcare — because nobody owns them. Axon follows this precedent.

---

## Architecture

### What Axon Does

**National Provider and Organization Registry**
Maintains a directory of all registered NPI-holding providers and organizations. The NPI is the universal identifier. Any provider or organization running a Neuron is discoverable through Axon. Patients are never registered on Axon.

**Credential Verification**
Verifies that registered providers hold valid licenses and active credentials. A patient's CareAgent can confirm a provider's credential status before initiating a care relationship.

**Neuron Endpoint Directory**
For each registered organization, maintains the Neuron endpoint information that patient CareAgents need to initiate connections.

**Connection Brokering**
When a patient's CareAgent initiates a connection to a provider:

1. Axon verifies the provider's credentials and Neuron endpoint
2. Axon confirms the connection request is legitimate
3. Axon provides the patient's CareAgent with the connection details needed to establish a direct session with Neuron
4. Axon steps out of the way

Clinical content flows directly between the patient's installation and the provider's Neuron, peer to peer, after the handshake. Axon is never in the path of clinical communication.

**Protocol Specification**
Axon defines the rules of the network — the handshake protocol, message format, consent verification sequence, and identity exchange standard. Any two CareAgents implementing the Axon protocol can communicate with each other, regardless of who built them. The protocol specification lives in `spec/` and is the authoritative reference for all implementations.

### What Axon Does Not Do

- **Axon never handles PHI.** Clinical content flows directly between installations after the handshake. Axon sees identities and connection requests — not clinical content.
- **Patients are not registered on Axon.** Only providers and organizations are discoverable. The patient's identity is presented directly to the provider's Neuron during the consent handshake — peer to peer, never stored in Axon's registry.
- **Axon does not store patient data** — not even patient identities.
- **Axon is not in the path of clinical communication** after the handshake is complete.
- **Axon does not control, modify, or observe** the content of communications between CareAgents.
- **Axon is not a third-party integration surface.** Third-party applications do not talk to Axon. They talk to Neuron.

Because Axon never handles protected health information, it is not a covered entity under HIPAA.

### Who Can Talk to Axon

Axon is a closed protocol layer with a defined set of authorized participants:

- **@careagent/patient-core** — queries the registry for provider discovery when a patient has no established relationship and needs to find a provider for the first time
- **@careagent/provider-core** — registers the provider's CareAgent with Neuron at onboarding
- **@careagent/neuron** — registers the organization's endpoint and manages provider credentials in the registry

That is the complete list. No third party, no external application, and no other component communicates directly with Axon. The Neuron is the intentional boundary between the Axon network and everything outside it.

### The Patient With No Established Provider

A patient's CareAgent and Patient Chart exist and function fully before any provider relationship is established. The vault is initialized, the record is theirs, the agent is ready. It is simply quiet — there are no Neuron endpoints in the care network yet.

The patient's CareAgent uses Axon directly — and only — for the initial discovery query to find a provider. Once the consent handshake is complete and the relationship is established, the Neuron endpoint is stored in the patient's care network. All subsequent communication goes directly to Neuron. Axon is not involved again unless the patient is discovering a new provider.

### The Axon Protocol

The Axon protocol is the standard that makes the network interoperable. It defines:

**Handshake Sequence**

For a new relationship:
1. Patient's CareAgent queries the Axon registry by NPI, name, or specialty
2. Axon returns the organization's Neuron endpoint and current credential status
3. Patient's CareAgent initiates a connection to Neuron
4. Neuron presents provider credentials and relationship terms
5. Patient consents through their CareAgent
6. Relationship record is written to the patient's Patient Chart (immutable, timestamped)
7. Provider's Neuron endpoint is stored in the patient's CANS.md care network
8. Direct peer-to-peer clinical session established between the two CareAgents through Neuron
9. Axon is no longer in the path

For an established relationship:
1. Patient's CareAgent connects directly to the stored Neuron endpoint
2. Neuron verifies the existing relationship record
3. Session established — Axon is not involved

**Identity Exchange**
The cryptographic identity standard for CareAgents on the network. How a patient's CareAgent proves it is who it claims to be. How a Neuron verifies an incoming connection request.

**Message Format**
The structured format for clinical communications between CareAgents. Versioned, extensible, and defined in the Axon specification.

**Consent Verification**
The protocol for verifying that a care relationship and valid consent exist before any clinical session is established.

**Credential Format**
The standard for how provider credentials are represented, verified, and presented in the Axon registry.

### The Axon API

The `@careagent/axon` package exports a namespace and module-level classes used by provider-core, patient-core, and neuron. This is not a public integration surface -- it is the canonical implementation of the protocol for authorized participants only.

```typescript
import { AxonTaxonomy, AxonRegistry, AxonBroker, AxonQuestionnaires } from '@careagent/axon'

// Taxonomy
const actions = AxonTaxonomy.getActionsForType('physician')
const isValid = AxonTaxonomy.validateAction('chart.progress_note')

// Questionnaires
const questionnaire = AxonQuestionnaires.getForType('physician')

// Registry (instance with file-backed persistence)
const registry = new AxonRegistry()

// Mock server (for integration testing)
import { createMockAxonServer } from '@careagent/axon/mock'
```

Third-party developers building on the CareAgent ecosystem should refer to [careagent/neuron](https://github.com/careagent/neuron) for the Neuron API and SDK.

---

## Installation

@careagent/axon is consumed as a dependency by @careagent/provider-core, @careagent/patient-core, and @careagent/neuron. It is not intended for direct use by third-party applications.

```bash
pnpm add @careagent/axon
```

For development setup, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Local Development

This project uses [pnpm](https://pnpm.io) as its package manager. Prerequisites: Node.js >= 22.12.0, pnpm.

```bash
pnpm install          # Install dependencies
pnpm build            # Build the package (tsdown, multi-entry)
pnpm test             # Run all tests (vitest)
pnpm test:coverage    # Run with coverage (80% threshold on all metrics)
```

All development uses synthetic data and mock CareAgent connections. No real patient data or PHI is used. For full development setup instructions, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Governance

Axon is governed as an open project. The governance model is documented in [docs/governance.md](docs/governance.md) and covers:

- Taxonomy change process (proposing new actions and provider types)
- Protocol change process (handshake, identity, message, consent, credential)
- Semantic versioning rules for taxonomy data and protocol specifications

The Axon protocol is versioned. Breaking changes require a governance process. Non-breaking extensions can be proposed through the standard contribution process.

Protocol changes require discussion and consensus before implementation. Open an issue before writing code for any protocol-level change. Full foundation governance (board structure, voting, funding) is deferred to v2.

---

## Relationship to the Ecosystem

```
National Axon Registry (@careagent/axon)
        │
        │  Discovery, credential verification, handshake brokering
        │  Authorized participants: patient-core, provider-core, neuron only
        │  (Axon exits after handshake — clinical content flows peer to peer)
        │
        ├──────────────────────────────────────┐
        ▼                                      ▼
Organization Neuron                   Patient CareAgent
(careagent/neuron)                  (@careagent/patient-core)
        │                                      │
        │   Direct peer-to-peer session        │
        │◄─────────────────────────────────────┘
        │
        ├── Provider CareAgents  (@careagent/provider-core)
        │
        └── Third-party integrations (Neuron API — not Axon)
```

---

## Repository Structure

```
careagent/axon/
├── src/
│   ├── index.ts              # Axon namespace, re-exports all modules
│   ├── taxonomy/             # Clinical action taxonomy (AxonTaxonomy)
│   │   ├── taxonomy.ts       # Static class with lazy-loaded indexes
│   │   ├── schemas.ts        # TypeBox schemas for taxonomy data
│   │   └── loader.ts         # JSON data loading with directory walk-up
│   ├── questionnaires/       # Provider questionnaire system (AxonQuestionnaires)
│   │   ├── questionnaires.ts # Static class with lazy Map index
│   │   ├── schemas.ts        # TypeBox schemas for questionnaire data
│   │   ├── loader.ts         # 4-step validation pipeline
│   │   └── cans-fields.ts    # CANS field allowlist
│   ├── registry/             # NPI-keyed provider directory (AxonRegistry)
│   │   ├── registry.ts       # Registry class: register, search, credentials
│   │   ├── schemas.ts        # TypeBox schemas for registry entries
│   │   ├── npi.ts            # NPI Luhn check digit validation
│   │   └── persistence.ts    # Atomic write-to-temp-then-rename JSON storage
│   ├── protocol/             # Ed25519 identity, message schemas, nonce store
│   │   ├── identity.ts       # Key generation, signing, verification (node:crypto)
│   │   ├── schemas.ts        # TypeBox schemas for protocol messages
│   │   ├── nonce.ts          # Replay protection with timestamp window
│   │   └── errors.ts         # AxonProtocolError hierarchy
│   ├── broker/               # Connection broker pipeline (AxonBroker)
│   │   ├── broker.ts         # Stateless connect() pipeline
│   │   └── audit.ts          # Hash-chained JSONL append-only audit log
│   ├── mock/                 # HTTP mock server for integration testing
│   │   ├── server.ts         # createMockAxonServer() HTTP server
│   │   └── fixtures.ts       # Pre-seeded registry data
│   └── types/                # TypeBox schemas and derived types
│       └── index.ts          # Re-exports schemas + Static<typeof> types
├── data/
│   ├── taxonomy/             # Versioned taxonomy JSON
│   │   └── v1.0.0.json       # 49 provider types, 61 clinical actions
│   └── questionnaires/       # Provider onboarding questionnaires
│       ├── physician.json    # Full 12-question questionnaire
│       └── ...               # 48 additional provider type stubs
├── spec/                     # Axon protocol specification (authoritative)
│   ├── handshake.md          # Handshake sequence specification
│   ├── identity.md           # Identity exchange specification
│   ├── message.md            # Message format specification
│   ├── consent.md            # Consent verification specification
│   └── credential.md         # Credential format specification
├── docs/                     # Developer and contributor documentation
│   ├── architecture.md       # Component layers, dependency graph, design decisions
│   ├── protocol.md           # Protocol overview linking to all 5 specs
│   ├── taxonomy.md           # Action hierarchy, versioning, extension process
│   ├── questionnaire-authoring.md  # Authoring guide for clinical domain experts
│   └── governance.md         # Change processes for taxonomy and protocol
├── test/                     # Test suites (vitest)
├── CONTRIBUTING.md           # Development setup and contribution guidelines
├── LICENSE                   # Apache 2.0
└── package.json
```

---

## Contributing

CareAgent is released under Apache 2.0. Contributions to Axon are especially welcome from:

- Clinicians and health IT professionals with knowledge of clinical data standards
- Security researchers with expertise in federated identity and cryptographic protocols
- Healthcare policy experts with knowledge of HIPAA, NPI, and credentialing frameworks
- Developers building on the Axon protocol

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, build instructions, and contribution guidelines. For architecture context, see [docs/architecture.md](docs/architecture.md). For the protocol specification, see [docs/protocol.md](docs/protocol.md) and the individual specs in [spec/](spec/).

---

## Related Repositories

| Repository | Purpose |
|-----------|---------|
| [careagent/provider-core](https://github.com/careagent/provider-core) | Provider-side CareAgent plugin — uses the Axon API client for Neuron registration |
| [careagent/patient-core](https://github.com/careagent/patient-core) | Patient-side CareAgent plugin — uses the Axon API client for initial provider discovery |
| [careagent/neuron](https://github.com/careagent/neuron) | Organization-level node — registers with Axon; the integration surface for third parties |
| [careagent/patient-chart](https://github.com/careagent/patient-chart) | Patient Chart vault — the record written to during care relationships established through Axon |

---

## License

Apache 2.0. See [LICENSE](LICENSE).

Axon is open foundation infrastructure. No single entity owns the network. Every line of code in this repository is open, auditable, and improvable by the community it serves.
