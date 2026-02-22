import { randomUUID } from 'node:crypto'
import { createHash } from 'node:crypto'
import { readFileSync, appendFileSync, existsSync } from 'node:fs'

/**
 * A single entry in the hash-chained audit trail.
 * Contains only connection metadata (agent IDs, NPIs, denial codes).
 * NEVER contains clinical content -- Axon does not touch PHI.
 */
export interface AuditEntry {
  /** Unique identifier for this audit entry */
  id: string
  /** ISO 8601 timestamp of the event */
  timestamp: string
  /** Type of brokering event */
  event_type: 'connect_attempt' | 'connect_granted' | 'connect_denied'
  /** UUID correlating events for the same connection attempt */
  connection_id: string
  /** Non-clinical metadata: agent IDs, NPIs, denial codes */
  details: Record<string, unknown>
  /** SHA-256 hex of the previous entry (64 zeros for genesis) */
  prev_hash: string
  /** SHA-256 hex of this entry's canonical JSON (computed without this field) */
  hash: string
}

/**
 * Hash-chained JSONL audit trail for connection brokering events.
 *
 * Each entry is appended as a single JSON line. The hash chain provides
 * tamper-evidence: each entry includes the SHA-256 hash of the previous
 * entry, and its own hash is computed over all fields except `hash` itself.
 *
 * On construction, if the file exists, the last entry's hash is recovered
 * to continue the chain seamlessly across process restarts.
 */
export class AuditTrail {
  private readonly filePath: string
  private lastHash: string

  constructor(filePath: string) {
    this.filePath = filePath

    // Recover lastHash from existing file for chain continuity
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n').filter((line) => line.trim() !== '')
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1]!
        const lastEntry = JSON.parse(lastLine) as AuditEntry
        this.lastHash = lastEntry.hash
      } else {
        this.lastHash = '0'.repeat(64)
      }
    } else {
      this.lastHash = '0'.repeat(64)
    }
  }

  /**
   * Log a brokering event to the audit trail.
   *
   * Builds a hash-chained entry, appends to the JSONL file, and returns
   * the complete entry including its computed hash.
   */
  log(event: {
    type: AuditEntry['event_type']
    connectionId: string
    details?: Record<string, unknown>
  }): AuditEntry {
    // Build entry without hash for hashing
    const entryWithoutHash = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      event_type: event.type,
      connection_id: event.connectionId,
      details: event.details ?? {},
      prev_hash: this.lastHash,
    }

    // Compute hash over canonical JSON of entry (without hash field)
    const hash = createHash('sha256')
      .update(JSON.stringify(entryWithoutHash))
      .digest('hex')

    // Build full entry with hash
    const fullEntry: AuditEntry = {
      ...entryWithoutHash,
      hash,
    }

    // Append to JSONL file
    appendFileSync(this.filePath, JSON.stringify(fullEntry) + '\n')

    // Update chain state
    this.lastHash = hash

    return fullEntry
  }

  /**
   * Verify the integrity of a hash-chained audit trail file.
   *
   * Reads every JSONL line, recomputes each entry's hash, and verifies
   * the prev_hash chain is unbroken. Detects tampering at any position.
   *
   * @returns Verification result with entry count and optional break position
   */
  static verifyChain(
    filePath: string,
  ): { valid: boolean; entries: number; brokenAt?: number } {
    if (!existsSync(filePath)) {
      return { valid: true, entries: 0 }
    }

    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n').filter((line) => line.trim() !== '')

    if (lines.length === 0) {
      return { valid: true, entries: 0 }
    }

    let expectedPrevHash = '0'.repeat(64)

    for (let i = 0; i < lines.length; i++) {
      const entry = JSON.parse(lines[i]!) as AuditEntry

      // Check prev_hash chain
      if (entry.prev_hash !== expectedPrevHash) {
        return { valid: false, entries: lines.length, brokenAt: i }
      }

      // Recompute hash from entry without hash field
      const { hash: _storedHash, ...entryWithoutHash } = entry
      const computedHash = createHash('sha256')
        .update(JSON.stringify(entryWithoutHash))
        .digest('hex')

      if (computedHash !== entry.hash) {
        return { valid: false, entries: lines.length, brokenAt: i }
      }

      expectedPrevHash = entry.hash
    }

    return { valid: true, entries: lines.length }
  }
}
