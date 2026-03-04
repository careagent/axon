# @careagent/axon

> Source: [github.com/careagent/axon](https://github.com/careagent/axon)

**@careagent/axon** is the network directory and registry for the CareAgent ecosystem. It functions as a Neuron registry, discovery service, credentialing protocol authority, and interaction protocol specification enabling cross-organization communication between sovereign CareAgent installations.

## Core Components

The package provides six primary capabilities:

1. **Clinical Action Taxonomy** — A versioned, data-driven taxonomy of clinical actions organized by provider type that governs permitted network actions.
2. **Provider Questionnaire System** — Declarative JSON questionnaires determining a provider's digital scope of practice during onboarding, authored by clinical domain experts without coding.
3. **Provider Registry** — An NPI-keyed directory of registered providers and organizations with credential records and Neuron endpoint tracking.
4. **Discovery Service** — Points CareAgents to the correct Neuron addresses for their needs. A provider seeking credentialing is directed to the relevant medical board, specialty society, and federal Neurons. A patient seeking care is directed to the appropriate organization's Neuron.
5. **Protocol Specification** — Standardized handshake, identity, message, consent, and credential protocols ensuring network interoperability.
6. **Mock HTTP Server** — A development server for integration testing used by related packages.

## Architecture Overview

**What Axon Does:**
- Maintains a registry of all Neurons and the capabilities each exposes — clinical organizations, medical boards, specialty societies, federal agencies
- Directs CareAgents to the correct Neuron addresses for credentialing, care, and administrative needs
- Verifies provider credentials by orchestrating verification across multiple authoritative Neurons
- Owns the interaction protocol specification and questionnaire schemas
- Defines network protocol standards

**What Axon Does Not Do:**
- Broker P2P connections (connection brokering is handled by individual Neurons)
- Handle protected health information (PHI)
- Store patient data or identities
- Remain in the path after discovery is complete
- Serve as a third-party integration surface

## Governance Philosophy

Axon must remain open foundation infrastructure: community-governed, fully auditable, permanently available, and free at the organizational level—following the precedent of established healthcare standards like HL7 and FHIR.

## Installation & Development

```bash
pnpm add @careagent/axon
pnpm install
pnpm build
pnpm test
pnpm test:coverage
```

Requires Node.js >= 22.12.0 and pnpm.

## Ecosystem Integration

The package serves as a dependency for @careagent/provider-core, @careagent/patient-core, and @careagent/neuron. Axon is queried by CareAgents for Neuron discovery; CareAgents then interact with Neurons directly. Axon is the map — Neurons are the destinations. All external integration occurs through Neuron.

**License:** Apache 2.0
