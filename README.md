# axon# @careagent/axon

**The open foundation network layer for the CareAgent ecosystem.**

@careagent/axon is the trust registry, discovery service, connection broker, and protocol specification that makes cross-installation communication between sovereign CareAgent installations possible. It is the pathway between Neurons — it transmits, it does not think. The intelligence lives in the CareAgents. Axon governs the channel between them.

---

---

## What This Package Does

@careagent/axon is a pnpm package that provides two things:

**1. The Axon Registry** — open foundation infrastructure that maintains the national directory of NPI-registered providers and organizations, verifies credentials, maintains Neuron endpoint information, and brokers the initial connection handshake between patient and provider CareAgents. Axon never handles PHI. Patients are never registered on Axon. Clinical content flows directly between installations, peer to peer, after the handshake — Axon steps out of the way.

**2. The Axon API Client** — a TypeScript client library used internally by @careagent/provider-core, @careagent/patient-core, and @careagent/neuron to interact with the Axon registry. Direct third-party access to Axon is not permitted. All third-party integration happens through Neuron — see [careagent/neuron](https://github.com/careagent/neuron).

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

### The Axon API Client

The `@careagent/axon` package exports an internal API client used by provider-core, patient-core, and neuron. This is not a public integration surface — it is the canonical implementation of the protocol for authorized participants only.

```typescript
import { AxonClient, AxonRegistry } from '@careagent/axon'

// Query the registry (patient-core — initial provider discovery only)
const registry = new AxonRegistry()
const provider = await registry.findByNPI('1234567890')
const results = await registry.search({ specialty: 'neurosurgery', location: 'Charleston, SC' })

// Register a Neuron endpoint (neuron — at initialization)
await registry.register({ npi: '1234567890', endpoint: 'https://neuron.example.com' })

// Broker a connection (patient-core — new relationship only)
const client = new AxonClient({ cans: patientCans })
const session = await client.connect({ neuronEndpoint: provider.neuronEndpoint })
```

Third-party developers building on the CareAgent ecosystem should refer to [careagent/neuron](https://github.com/careagent/neuron) for the Neuron API and SDK.

---

## Installation

### Running the Axon Registry (Foundation Infrastructure)

> **Note:** The Axon registry is open foundation infrastructure intended to be governed and operated by the CareAgent open foundation. Individual organizations do not run their own Axon registry — they register with the foundation's registry through their Neuron.

For development and testing, a local Axon registry can be run:

```bash
# Install pnpm if you don't have it
npm install -g pnpm

# Clone and install
git clone https://github.com/careagent/axon
cd axon
pnpm install
```

### Using the Axon API Client

The API client is consumed as a dependency by @careagent/provider-core, @careagent/patient-core, and @careagent/neuron. It is not intended for direct use by third-party applications.

```bash
pnpm add @careagent/axon
```

---

## Local Development

This project uses [pnpm](https://pnpm.io) as its package manager.

```bash
pnpm install          # Install dependencies
pnpm test             # Run test suites
pnpm build            # Build the package and registry
pnpm dev:registry     # Run a local Axon registry for development
pnpm dev:mock         # Run with mock provider and patient CareAgent connections
```

> **Dev platform note:** All development uses synthetic data and mock CareAgent connections. No real patient data or PHI is used at this stage.

---

## CLI Commands

```bash
axon start            # Start the Axon registry service
axon status           # Show registry status, registered providers, active connections
axon register         # Register a new Neuron endpoint with the registry
axon verify <npi>     # Verify credentials for a given NPI
axon dev:registry     # Start a local registry instance for development
```

---

## Governance

Axon is governed as an open foundation. The governance model is documented in `docs/governance.md` and covers:

- Foundation structure and decision-making
- Protocol versioning and change management
- Registry participation requirements
- Credential verification standards
- Dispute resolution

The Axon protocol is versioned. Breaking changes require a governance process. Non-breaking extensions can be proposed through the standard contribution process.

Protocol changes require discussion and consensus before implementation. Open an issue before writing code for any protocol-level change.

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
│   ├── registry/             # National provider and organization registry
│   │   ├── index.ts          # Registry entry point
│   │   ├── npi.ts            # NPI validation and lookup
│   │   ├── credentials.ts    # Credential verification
│   │   └── endpoints.ts      # Neuron endpoint directory
│   ├── broker/               # Connection brokering
│   │   ├── index.ts          # Broker entry point
│   │   ├── handshake.ts      # Handshake sequence implementation
│   │   └── session.ts        # Session establishment and teardown
│   ├── protocol/             # Axon protocol implementation
│   │   ├── identity.ts       # Identity exchange standard
│   │   ├── message.ts        # Message format
│   │   ├── consent.ts        # Consent verification protocol
│   │   └── credential.ts     # Credential format standard
│   └── client/               # Axon API client — for authorized internal use only
│       ├── index.ts          # Client entry point
│       ├── registry.ts       # AxonRegistry — provider registration and lookup
│       └── broker.ts         # AxonClient — connection initiation
├── spec/                     # Axon protocol specification (human-readable)
│   ├── handshake.md          # Handshake sequence specification
│   ├── identity.md           # Identity exchange specification
│   ├── message.md            # Message format specification
│   └── consent.md            # Consent verification specification
├── test/                     # Test suites
├── docs/
│   ├── architecture.md       # Axon architecture guide
│   ├── governance.md         # Open foundation governance model
│   └── protocol.md           # Protocol overview
└── package.json              # pnpm package
```

---

## Contributing

CareAgent is released under Apache 2.0. Contributions to Axon are especially welcome from:

- Clinicians and health IT professionals with knowledge of clinical data standards
- Security researchers with expertise in federated identity and cryptographic protocols
- Healthcare policy experts with knowledge of HIPAA, NPI, and credentialing frameworks
- Developers building on the Axon protocol

Before contributing, read the architecture guide in `docs/architecture.md`, the protocol specification in `spec/`, and the contribution guidelines in `CONTRIBUTING.md`.

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
