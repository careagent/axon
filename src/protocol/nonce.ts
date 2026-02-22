/**
 * NonceStore provides replay protection for protocol messages.
 * Tracks nonces within a configurable time window and rejects:
 * - Timestamps outside the window (too old or too far in the future)
 * - Previously seen nonces (replay attack)
 *
 * Expired nonces are cleaned up on each validation call.
 */
export class NonceStore {
  private readonly nonces = new Map<string, number>()
  private readonly windowMs: number

  /**
   * @param windowMs - Time window in milliseconds (default 5 minutes).
   *   Messages with timestamps outside this window are rejected.
   *   Nonces older than this window are cleaned up.
   */
  constructor(windowMs = 5 * 60 * 1000) {
    this.windowMs = windowMs
  }

  /**
   * Validate a nonce and timestamp pair.
   *
   * @param nonce - The nonce string from the protocol message
   * @param timestamp - ISO 8601 timestamp string from the protocol message
   * @returns Validation result with optional reason code on failure
   */
  validate(
    nonce: string,
    timestamp: string,
  ): { valid: boolean; reason?: 'timestamp_expired' | 'nonce_replayed' } {
    const now = Date.now()
    const ts = new Date(timestamp).getTime()

    // Check timestamp is within acceptable window
    if (Math.abs(now - ts) > this.windowMs) {
      return { valid: false, reason: 'timestamp_expired' }
    }

    // Check for nonce replay
    if (this.nonces.has(nonce)) {
      return { valid: false, reason: 'nonce_replayed' }
    }

    // Store nonce and clean up expired entries
    this.nonces.set(nonce, ts)
    this.cleanup(now)

    return { valid: true }
  }

  /** Remove nonces that have fallen outside the time window. */
  private cleanup(now: number): void {
    for (const [nonce, ts] of this.nonces) {
      if (now - ts > this.windowMs) {
        this.nonces.delete(nonce)
      }
    }
  }
}
