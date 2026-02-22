import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

// --- Credential Status ---
export const CredentialStatusSchema = Type.Union([
  Type.Literal('active'),
  Type.Literal('pending'),
  Type.Literal('expired'),
  Type.Literal('suspended'),
  Type.Literal('revoked'),
])

// --- Verification Source ---
// v1: only 'self_attested' is used at registration
// Data model supports progressive verification for v2
export const VerificationSourceSchema = Type.Union([
  Type.Literal('self_attested'),
  Type.Literal('nppes_matched'),
  Type.Literal('state_board_verified'),
])

// --- Credential Type ---
export const CredentialTypeSchema = Type.Union([
  Type.Literal('license'),
  Type.Literal('certification'),
  Type.Literal('privilege'),
])

// --- Credential Record ---
export const CredentialRecordSchema = Type.Object({
  type: CredentialTypeSchema,
  issuer: Type.String(),
  identifier: Type.String(),
  status: CredentialStatusSchema,
  issued_at: Type.Optional(Type.String()),
  expires_at: Type.Optional(Type.String()),
  verification_source: VerificationSourceSchema,
})

// --- Neuron Health Status ---
export const NeuronHealthStatusSchema = Type.Union([
  Type.Literal('reachable'),
  Type.Literal('unreachable'),
  Type.Literal('unknown'),
])

// --- Neuron Endpoint ---
export const NeuronEndpointSchema = Type.Object({
  url: Type.String(),
  protocol_version: Type.String(),
  health_status: NeuronHealthStatusSchema,
  last_heartbeat: Type.Optional(Type.String()),
})

// --- Organization Affiliation ---
export const OrganizationAffiliationSchema = Type.Object({
  organization_npi: Type.String(),
  organization_name: Type.String(),
  department: Type.Optional(Type.String()),
  privileges: Type.Optional(Type.Array(Type.String())),
  neuron_endpoint: Type.Optional(Type.String()),
})

// --- Entity Type ---
export const EntityTypeSchema = Type.Union([
  Type.Literal('individual'),
  Type.Literal('organization'),
])

// --- Registry Entry ---
export const RegistryEntrySchema = Type.Object({
  npi: Type.String(),
  entity_type: EntityTypeSchema,
  name: Type.String(),
  credential_status: CredentialStatusSchema,

  // Individual provider fields (optional -- absent for organizations)
  provider_types: Type.Optional(Type.Array(Type.String())),
  degrees: Type.Optional(Type.Array(Type.String())),
  specialty: Type.Optional(Type.String()),
  subspecialty: Type.Optional(Type.String()),

  // Organization fields (optional -- absent for individuals)
  organization_name: Type.Optional(Type.String()),
  neuron_endpoint: Type.Optional(NeuronEndpointSchema),

  // Credentials (required, may be empty array initially)
  credentials: Type.Array(CredentialRecordSchema),

  // Organizational affiliations (for individual providers)
  affiliations: Type.Optional(Type.Array(OrganizationAffiliationSchema)),

  // Metadata
  registered_at: Type.String(),
  last_updated: Type.String(),
  registry_version: Type.String(),
})

// --- Search Query ---
export const RegistrySearchQuerySchema = Type.Object({
  npi: Type.Optional(Type.String()),
  name: Type.Optional(Type.String()),
  specialty: Type.Optional(Type.String()),
  provider_type: Type.Optional(Type.String()),
  organization: Type.Optional(Type.String()),
  credential_status: Type.Optional(CredentialStatusSchema),
  limit: Type.Optional(Type.Number()),
  offset: Type.Optional(Type.Number()),
})

// Compiled validators
export const RegistryEntryValidator = TypeCompiler.Compile(RegistryEntrySchema)
export const CredentialRecordValidator = TypeCompiler.Compile(CredentialRecordSchema)
export const NeuronEndpointValidator = TypeCompiler.Compile(NeuronEndpointSchema)
export const RegistrySearchQueryValidator = TypeCompiler.Compile(RegistrySearchQuerySchema)
