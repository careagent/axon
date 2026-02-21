import { createRequire } from 'node:module'
import { TaxonomyVersionValidator } from './schemas.js'
import type { TaxonomyVersion } from '../types/index.js'

const require = createRequire(import.meta.url)

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
  const data: unknown = require('../../data/taxonomy/v1.0.0.json')

  if (TaxonomyVersionValidator.Check(data)) {
    return data
  }

  const errors = [...TaxonomyVersionValidator.Errors(data)]
  const details = errors
    .map((error) => `  ${error.path}: ${error.message}`)
    .join('\n')

  throw new Error(`Taxonomy validation failed:\n${details}`)
}
