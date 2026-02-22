import {
  generateKeyPairSync,
  sign,
  verify,
  createPrivateKey,
  createPublicKey,
  randomBytes,
} from 'node:crypto'

/**
 * Ed25519 key pair with base64url-encoded raw 32-byte keys.
 * Compatible with Neuron JWK format: { kty: 'OKP', crv: 'Ed25519', x: publicKey }
 */
export interface AxonKeyPair {
  /** base64url-encoded raw 32-byte Ed25519 public key (JWK 'x' component) */
  publicKey: string
  /** base64url-encoded raw 32-byte Ed25519 private key (JWK 'd' component) */
  privateKey: string
}

/**
 * Generate an Ed25519 key pair.
 * Returns base64url-encoded raw 32-byte keys extracted from JWK format.
 * Public key is 43 base64url characters, private key is 43 base64url characters.
 */
export function generateKeyPair(): AxonKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const pubJwk = publicKey.export({ format: 'jwk' }) as { x: string }
  const privJwk = privateKey.export({ format: 'jwk' }) as { x: string; d: string }
  return {
    publicKey: pubJwk.x,
    privateKey: privJwk.d,
  }
}

/**
 * Sign a payload string with an Ed25519 private key.
 *
 * IMPORTANT: Ed25519 requires both 'd' (private) and 'x' (public) JWK components
 * for private key import. The publicKeyB64 parameter is required for JWK reconstruction.
 *
 * @param payload - The string to sign (exact bytes are signed)
 * @param privateKeyB64 - base64url-encoded raw 32-byte private key (JWK 'd' component)
 * @param publicKeyB64 - base64url-encoded raw 32-byte public key (JWK 'x' component)
 * @returns base64url-encoded Ed25519 signature (86 characters, 64 bytes raw)
 */
export function signPayload(
  payload: string,
  privateKeyB64: string,
  publicKeyB64: string,
): string {
  const keyObject = createPrivateKey({
    key: { kty: 'OKP', crv: 'Ed25519', d: privateKeyB64, x: publicKeyB64 },
    format: 'jwk',
  })
  // Ed25519 uses null algorithm (internally uses SHA-512); do NOT use createSign
  return sign(null, Buffer.from(payload), keyObject).toString('base64url')
}

/**
 * Verify an Ed25519 signature over a payload string.
 *
 * @param payload - The original signed string
 * @param signature - base64url-encoded Ed25519 signature
 * @param publicKeyB64 - base64url-encoded raw 32-byte public key (JWK 'x' component)
 * @returns true if signature is valid, false otherwise
 */
export function verifySignature(
  payload: string,
  signature: string,
  publicKeyB64: string,
): boolean {
  const keyObject = createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: publicKeyB64 },
    format: 'jwk',
  })
  // Ed25519 uses null algorithm; do NOT use createVerify
  return verify(null, Buffer.from(payload), keyObject, Buffer.from(signature, 'base64url'))
}

/**
 * Generate a cryptographically secure nonce as a base64url string.
 *
 * @param bytes - Number of random bytes (default 16, producing 22 base64url characters)
 * @returns base64url-encoded random nonce
 */
export function generateNonce(bytes?: number): string {
  return randomBytes(bytes ?? 16).toString('base64url')
}
