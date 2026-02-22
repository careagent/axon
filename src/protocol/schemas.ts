import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

// --- Base64url String Pattern ---
// Enforces base64url alphabet: A-Z, a-z, 0-9, hyphen, underscore (no +, /, or = padding)
export const Base64UrlString = Type.String({ pattern: '^[A-Za-z0-9_-]+$' })

// --- Connect Request ---
// Sent by patient CareAgent to initiate a connection via Axon broker
export const ConnectRequestSchema = Type.Object({
  version: Type.Literal('1.0.0'),
  type: Type.Literal('connect_request'),
  timestamp: Type.String(), // ISO 8601
  nonce: Base64UrlString, // >=16 bytes, base64url encoded
  patient_agent_id: Type.String(),
  provider_npi: Type.String(),
  patient_public_key: Base64UrlString, // Ed25519 raw 32 bytes, base64url encoded
})

// --- Connect Grant ---
// Returned by broker when connection is approved
export const ConnectGrantSchema = Type.Object({
  type: Type.Literal('connect_grant'),
  connection_id: Type.String(), // UUID
  provider_npi: Type.String(),
  neuron_endpoint: Type.String(), // URL
  protocol_version: Type.String(),
})

// --- Denial Code ---
// Categorical denial reasons returned to caller (specific detail goes to audit trail only)
export const DenialCodeSchema = Type.Union([
  Type.Literal('SIGNATURE_INVALID'),
  Type.Literal('NONCE_REPLAYED'),
  Type.Literal('TIMESTAMP_EXPIRED'),
  Type.Literal('PROVIDER_NOT_FOUND'),
  Type.Literal('CREDENTIALS_INVALID'),
  Type.Literal('ENDPOINT_UNAVAILABLE'),
])

// --- Connect Denial ---
// Returned by broker when connection is denied
export const ConnectDenialSchema = Type.Object({
  type: Type.Literal('connect_denial'),
  connection_id: Type.String(), // UUID
  code: DenialCodeSchema,
  message: Type.String(), // Categorical human-readable, no sensitive details
})

// --- Signed Message ---
// Wrapper for signed protocol messages: payload is base64url-encoded JSON,
// signature is Ed25519 signature over those exact payload bytes
export const SignedMessageSchema = Type.Object({
  payload: Base64UrlString,
  signature: Base64UrlString,
})

// --- Compiled Validators ---
export const ConnectRequestValidator = TypeCompiler.Compile(ConnectRequestSchema)
export const SignedMessageValidator = TypeCompiler.Compile(SignedMessageSchema)

// --- Derived Types ---
export type ConnectRequest = Static<typeof ConnectRequestSchema>
export type ConnectGrant = Static<typeof ConnectGrantSchema>
export type ConnectDenial = Static<typeof ConnectDenialSchema>
export type DenialCode = Static<typeof DenialCodeSchema>
export type SignedMessage = Static<typeof SignedMessageSchema>
