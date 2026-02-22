# Axon Credential Format Specification

## Overview

Provider credentials (licenses, certifications, and privileges) are stored in the Axon registry and checked by the broker during connection handshake. The credential system provides a structured way to record provider qualifications and gate connections based on credential status.

Credentials are part of a provider's `RegistryEntry` and are managed through the `AxonRegistry`. The broker checks the entry-level `credential_status` (not individual credential records) during the `connect()` pipeline.

## CredentialRecord Schema

The `CredentialRecord` is defined as a TypeBox schema in `src/registry/schemas.ts`. This is the canonical format for individual credential records.

### Fields

| Field                 | Type     | Required | Values                                                     | Description                                     |
| --------------------- | -------- | -------- | ---------------------------------------------------------- | ----------------------------------------------- |
| `type`                | `string` | Yes      | `'license'` \| `'certification'` \| `'privilege'`         | Category of credential                          |
| `issuer`              | `string` | Yes      | Free-form                                                  | Issuing authority (e.g., state board, org name)  |
| `identifier`          | `string` | Yes      | Free-form                                                  | Credential number or identifier                 |
| `status`              | `string` | Yes      | `'active'` \| `'pending'` \| `'expired'` \| `'suspended'` \| `'revoked'` | Current credential status    |
| `issued_at`           | `string` | No       | ISO 8601                                                   | When the credential was issued                  |
| `expires_at`          | `string` | No       | ISO 8601                                                   | When the credential expires                     |
| `verification_source` | `string` | Yes      | `'self_attested'` \| `'nppes_matched'` \| `'state_board_verified'` | How the credential was verified      |

### TypeScript type

```typescript
interface CredentialRecord {
  type: 'license' | 'certification' | 'privilege'
  issuer: string
  identifier: string
  status: 'active' | 'pending' | 'expired' | 'suspended' | 'revoked'
  issued_at?: string       // ISO 8601
  expires_at?: string      // ISO 8601
  verification_source: 'self_attested' | 'nppes_matched' | 'state_board_verified'
}
```

### TypeBox schema

```typescript
import { Type } from '@sinclair/typebox'

const CredentialStatusSchema = Type.Union([
  Type.Literal('active'),
  Type.Literal('pending'),
  Type.Literal('expired'),
  Type.Literal('suspended'),
  Type.Literal('revoked'),
])

const VerificationSourceSchema = Type.Union([
  Type.Literal('self_attested'),
  Type.Literal('nppes_matched'),
  Type.Literal('state_board_verified'),
])

const CredentialTypeSchema = Type.Union([
  Type.Literal('license'),
  Type.Literal('certification'),
  Type.Literal('privilege'),
])

const CredentialRecordSchema = Type.Object({
  type: CredentialTypeSchema,
  issuer: Type.String(),
  identifier: Type.String(),
  status: CredentialStatusSchema,
  issued_at: Type.Optional(Type.String()),
  expires_at: Type.Optional(Type.String()),
  verification_source: VerificationSourceSchema,
})
```

### Example

```typescript
const medicalLicense: CredentialRecord = {
  type: 'license',
  issuer: 'State Medical Board of California',
  identifier: 'A-123456',
  status: 'active',
  issued_at: '2023-01-15T00:00:00.000Z',
  expires_at: '2025-01-15T00:00:00.000Z',
  verification_source: 'self_attested',
}
```

## Credential Status Lifecycle

Credentials move through a defined set of statuses:

```
                    +---------+
                    | pending |  (initial state at registration)
                    +----+----+
                         |
                    verification
                         |
                    +----v----+
              +---->| active  |<----+
              |     +----+----+     |
              |          |          |
          reinstate   expire     reinstate
              |          |          |
         +----+----+ +--v------+  +----+-----+
         |suspended| | expired |  | (active) |
         +---------+ +---------+  +----------+
              |
           revoke
              |
         +----v----+
         | revoked |  (terminal)
         +---------+
```

### Status definitions

| Status      | Description                                        | Connection allowed |
| ----------- | -------------------------------------------------- | ------------------ |
| `pending`   | Initial state. Credential submitted but not verified. | No              |
| `active`    | Credential verified and in good standing.           | Yes                |
| `expired`   | Credential has passed its expiration date.          | No                 |
| `suspended` | Credential temporarily suspended by issuer.         | No                 |
| `revoked`   | Credential permanently revoked. Terminal state.     | No                 |

Only providers with `credential_status: 'active'` on their registry entry can have connections brokered through Axon. All other statuses result in a `CREDENTIALS_INVALID` denial.

## Verification Levels

The `verification_source` field indicates how a credential was verified. The data model supports progressive verification -- credentials can start as self-attested and be upgraded as external verification systems are integrated.

| Source                 | Version | Description                                                |
| ---------------------- | ------- | ---------------------------------------------------------- |
| `self_attested`        | v1      | Provider claims the credential. No external verification.  |
| `nppes_matched`        | v2      | Matched against the NPPES (National Plan and Provider Enumeration System) database. |
| `state_board_verified` | v2      | Confirmed with the state licensing board directly.         |

**v1 behavior:** All credentials at registration use `self_attested`. The verification source is a required field (not optional) to make verification status visible and prominent. This is a deliberate design choice -- even though v1 only supports self-attestation, requiring the field ensures that consumers of credential data always see the verification level.

**Future versions:** As external verification integrations are built (NPPES API, state board APIs), existing credentials can be upgraded from `self_attested` to a higher verification level. The data model is ready for this -- no schema migration needed.

## Broker Credential Check

During the `connect()` pipeline (Step 7 in the [handshake specification](./handshake.md)), the broker checks the provider's credential status:

```typescript
// From AxonBroker.connect() pipeline
const entry = registry.findByNPI(request.provider_npi)

// Check entry-level credential_status (NOT individual credential records)
if (entry.credential_status !== 'active') {
  return deny(connectionId, 'CREDENTIALS_INVALID', request.provider_npi)
}
```

**Key design point:** The broker checks `entry.credential_status` -- the top-level status on the `RegistryEntry` -- not individual `CredentialRecord` statuses. This is a coarse-grained gate:

- If `credential_status` is `'active'`, the connection proceeds.
- If it is anything else (`pending`, `expired`, `suspended`, `revoked`), the connection is denied with `CREDENTIALS_INVALID`.

The top-level `credential_status` is a summary of the provider's overall credential state. Individual credential records (in the `credentials` array) provide detailed information but are not checked by the broker in v1. Future versions may implement fine-grained credential checks (e.g., requiring a specific license type for certain connection types).

The denial message returned to the caller is categorical: "Provider credentials are not in active status." No details about which specific credential is invalid, when it expired, or why it was suspended are returned. This information is logged to the audit trail only, preventing information leakage about provider status.

## NPI Validation

Credentials are keyed by NPI (National Provider Identifier). NPI validation uses the Luhn check digit algorithm:

- NPIs are exactly 10 digits.
- The last digit is a check digit calculated using the Luhn algorithm with an implicit 80840 prefix (represented by adding constant 24 to the sum).
- Validation is performed at registration time and during connection requests.

```typescript
function validateNPI(npi: string): boolean {
  // Must be exactly 10 digits
  if (!/^\d{10}$/.test(npi)) return false

  // Luhn check with 80840 prefix (constant 24)
  let sum = 24
  const digits = npi.split('').map(Number)
  const checkDigit = digits[9]!

  for (let i = 8; i >= 0; i--) {
    let digit = digits[i]!
    if ((8 - i) % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }

  const expectedCheckDigit = (10 - (sum % 10)) % 10
  return checkDigit === expectedCheckDigit
}
```

See `src/registry/npi.ts` for the implementation.
