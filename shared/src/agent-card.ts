/**
 * A2A Agent Card schema — aligned with the A2A specification.
 * This is the canonical schema for Agent Card registration, discovery, and publishing.
 * All repos must use these schemas — do not define local Agent Card types.
 */

import { Type, type Static } from '@sinclair/typebox'

// --- Agent Card sub-schemas ---

export const AgentCapabilitySchema = Type.Object({
  name: Type.String({ description: 'Capability identifier' }),
  description: Type.Optional(Type.String()),
  inputs: Type.Optional(Type.Array(Type.String())),
  outputs: Type.Optional(Type.Array(Type.String())),
})

export type AgentCapability = Static<typeof AgentCapabilitySchema>

export const AgentAuthSchema = Type.Object({
  scheme: Type.Union([
    Type.Literal('bearer'),
    Type.Literal('oauth2'),
    Type.Literal('mtls'),
    Type.Literal('none'),
  ]),
  credentials: Type.Optional(Type.String({ description: 'Token or credential reference' })),
})

export type AgentAuth = Static<typeof AgentAuthSchema>

export const AgentProviderSchema = Type.Object({
  organization: Type.String(),
  url: Type.Optional(Type.String({ format: 'uri' })),
})

export type AgentProvider = Static<typeof AgentProviderSchema>

// --- CareAgent-specific extensions ---

export const AgentLocationSchema = Type.Object({
  address: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  state: Type.Optional(Type.String()),
  zip: Type.Optional(Type.String()),
  country: Type.Optional(Type.String({ default: 'US' })),
  coordinates: Type.Optional(Type.Object({
    lat: Type.Number(),
    lng: Type.Number(),
  })),
})

export type AgentLocation = Static<typeof AgentLocationSchema>

export const CareAgentMetadataSchema = Type.Object({
  npi: Type.Optional(Type.String({ description: 'National Provider Identifier' })),
  practice_npi: Type.Optional(Type.String({ description: 'Practice/Organization NPI' })),
  provider_type: Type.Optional(Type.String({ description: 'Provider type from Axon taxonomy' })),
  specialty: Type.Optional(Type.String()),
  organization: Type.Optional(Type.String({ description: 'Practice or organization name' })),
  location: Type.Optional(AgentLocationSchema),
  clinical_actions: Type.Optional(Type.Array(Type.Union([
    Type.Literal('chart'),
    Type.Literal('order'),
    Type.Literal('charge'),
    Type.Literal('perform'),
    Type.Literal('interpret'),
    Type.Literal('educate'),
    Type.Literal('coordinate'),
  ]))),
  consent_required: Type.Optional(Type.Boolean({ default: true })),
  classification: Type.Optional(Type.Union([
    Type.Literal('clinical'),
    Type.Literal('administrative'),
  ])),
})

export type CareAgentMetadata = Static<typeof CareAgentMetadataSchema>

// --- Agent Card ---

export const AgentCardSchema = Type.Object({
  id: Type.String({ description: 'Unique agent identifier' }),
  name: Type.String(),
  description: Type.Optional(Type.String()),
  version: Type.String(),
  url: Type.String({ format: 'uri', description: 'A2A endpoint URL' }),
  capabilities: Type.Array(AgentCapabilitySchema),
  authentication: Type.Optional(AgentAuthSchema),
  provider: Type.Optional(AgentProviderSchema),
  careagent: Type.Optional(CareAgentMetadataSchema),
}, { description: 'A2A Agent Card with CareAgent extensions' })

export type AgentCard = Static<typeof AgentCardSchema>
