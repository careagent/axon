import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TaxonomyVersionValidator } from './schemas.js'
import type { TaxonomyVersion } from '../types/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Resolve the taxonomy JSON file path.
 *
 * Works from both source tree (src/taxonomy/loader.ts -> ../../data/)
 * and bundled output (dist/index.js -> ../data/).
 * Walks up from the current module directory to find the data/ folder.
 */
function resolveTaxonomyPath(): string {
  // From source: __dirname = <root>/src/taxonomy, need ../../data
  // From bundle: __dirname = <root>/dist, need ../data
  // In both cases, the package root contains data/taxonomy/v1.0.0.json
  let current = __dirname
  for (let i = 0; i < 4; i++) {
    const candidate = resolve(current, 'data', 'taxonomy', 'v1.0.0.json')
    try {
      readFileSync(candidate, 'utf-8')
      return candidate
    } catch {
      current = dirname(current)
    }
  }
  throw new Error('Could not locate taxonomy data file (data/taxonomy/v1.0.0.json)')
}

/**
 * Load and validate the taxonomy JSON data file.
 *
 * Uses TypeCompiler-compiled validation to ensure the JSON conforms
 * to the TaxonomyVersion schema at load time.
 *
 * @returns The validated taxonomy data
 * @throws Error if the taxonomy JSON fails schema validation
 */
export function loadTaxonomy(): TaxonomyVersion {
  const jsonPath = resolveTaxonomyPath()
  const data: unknown = JSON.parse(readFileSync(jsonPath, 'utf-8'))

  if (TaxonomyVersionValidator.Check(data)) {
    return data
  }

  const errors = [...TaxonomyVersionValidator.Errors(data)]
  const details = errors
    .map((error) => `  ${error.path}: ${error.message}`)
    .join('\n')

  throw new Error(`Taxonomy validation failed:\n${details}`)
}
