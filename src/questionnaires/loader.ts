import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { QuestionnaireValidator } from './schemas.js'
import { VALID_CANS_FIELDS } from './cans-fields.js'
import { AxonTaxonomy } from '../taxonomy/taxonomy.js'
import type { Questionnaire } from '../types/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Resolve the questionnaire JSON file path for a given provider type.
 *
 * Works from both source tree (src/questionnaires/loader.ts -> ../../data/)
 * and bundled output (dist/index.js -> ../data/).
 * Walks up from the current module directory to find the data/ folder.
 *
 * @param providerTypeId - The provider type ID (e.g., 'physician')
 * @returns The resolved file path
 * @throws Error if the questionnaire file cannot be located
 */
function resolveQuestionnairePath(providerTypeId: string): string {
  let current = __dirname
  for (let i = 0; i < 4; i++) {
    const candidate = resolve(
      current,
      'data',
      'questionnaires',
      `${providerTypeId}.json`,
    )
    try {
      readFileSync(candidate, 'utf-8')
      return candidate
    } catch {
      current = dirname(current)
    }
  }
  throw new Error(
    `Could not locate questionnaire data file for provider type '${providerTypeId}' (data/questionnaires/${providerTypeId}.json)`,
  )
}

/**
 * Load and validate a questionnaire JSON data file for a given provider type.
 *
 * Performs a 4-step validation pipeline:
 * 1. Schema validation (TypeBox compiled validator)
 * 2. Taxonomy cross-validation (QUES-05: action IDs must exist in taxonomy)
 * 3. CANS field validation (QUES-06: cans_field paths must be in allowlist)
 * 4. Show_when forward-reference validation (conditions can only reference prior questions)
 *
 * @param providerTypeId - The provider type ID (e.g., 'physician')
 * @returns The validated questionnaire data
 * @throws Error if the questionnaire JSON fails any validation step
 */
export function loadQuestionnaire(providerTypeId: string): Questionnaire {
  const jsonPath = resolveQuestionnairePath(providerTypeId)
  const data: unknown = JSON.parse(readFileSync(jsonPath, 'utf-8'))

  // Step 1: Schema validation
  if (!QuestionnaireValidator.Check(data)) {
    const errors = [...QuestionnaireValidator.Errors(data)]
    const details = errors
      .map((error) => `  ${error.path}: ${error.message}`)
      .join('\n')

    throw new Error(
      `Questionnaire schema validation failed for '${providerTypeId}':\n${details}`,
    )
  }

  // Step 2: Taxonomy cross-validation (QUES-05)
  for (const question of data.questions) {
    if (question.action_assignments !== undefined) {
      for (const assignment of question.action_assignments) {
        for (const actionId of assignment.grants) {
          if (!AxonTaxonomy.validateAction(actionId)) {
            throw new Error(
              `Questionnaire '${providerTypeId}', question '${question.id}': invalid taxonomy action ID '${actionId}'`,
            )
          }
        }
      }
    }
  }

  // Step 3: CANS field validation (QUES-06)
  for (const question of data.questions) {
    if (!VALID_CANS_FIELDS.has(question.cans_field)) {
      throw new Error(
        `Questionnaire '${providerTypeId}', question '${question.id}': invalid CANS field path '${question.cans_field}'`,
      )
    }
  }

  // Step 4: Show_when forward-reference validation
  const seenIds = new Set<string>()
  for (const question of data.questions) {
    if (question.show_when !== undefined) {
      if (!seenIds.has(question.show_when.question_id)) {
        throw new Error(
          `Questionnaire '${providerTypeId}', question '${question.id}': show_when references '${question.show_when.question_id}' which has not appeared yet (forward reference)`,
        )
      }
    }
    seenIds.add(question.id)
  }

  return data
}
