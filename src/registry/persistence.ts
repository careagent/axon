import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { RegistryEntryValidator } from './schemas.js'
import type { RegistryEntry } from '../types/index.js'

/**
 * Atomically write registry data to a JSON file.
 *
 * Uses write-to-temp-then-rename pattern:
 * 1. Write JSON to a temp file in the same directory
 * 2. Rename temp file to target path (atomic on POSIX)
 *
 * The temp file is in the same directory to ensure it's on the same
 * filesystem, which is required for atomic rename.
 */
export function persistRegistry(
  filePath: string,
  entries: Map<string, RegistryEntry>,
): void {
  const dir = dirname(filePath)

  // Ensure directory exists
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // Serialize to JSON
  const data = JSON.stringify(
    { version: '1.0.0', entries: Object.fromEntries(entries) },
    null,
    2,
  )

  // Write to temp file in the same directory (same filesystem)
  const tempPath = join(dir, `.registry-${randomUUID()}.tmp`)
  writeFileSync(tempPath, data, 'utf-8')

  // Atomic rename
  renameSync(tempPath, filePath)
}

/**
 * Load registry data from a JSON file.
 *
 * Returns an empty Map if the file does not exist.
 * Validates each entry against the RegistryEntry schema.
 *
 * @throws Error if the file exists but contains invalid data
 */
export function loadRegistry(
  filePath: string,
): Map<string, RegistryEntry> {
  if (!existsSync(filePath)) {
    return new Map()
  }

  const raw = readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw) as { version: string; entries: Record<string, unknown> }
  const entries = new Map<string, RegistryEntry>()

  for (const [npi, entry] of Object.entries(data.entries)) {
    if (!RegistryEntryValidator.Check(entry)) {
      const errors = [...RegistryEntryValidator.Errors(entry)]
      const details = errors.map(e => `  ${e.path}: ${e.message}`).join('\n')
      throw new Error(`Registry entry "${npi}" failed validation:\n${details}`)
    }
    entries.set(npi, entry)
  }

  return entries
}
