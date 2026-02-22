import { loadQuestionnaire } from './loader.js'
import { AxonTaxonomy } from '../taxonomy/taxonomy.js'
import type { Questionnaire } from '../types/index.js'

/**
 * Static API for accessing Axon questionnaires by provider type.
 *
 * Uses lazy initialization -- questionnaire JSON files are loaded, validated,
 * and indexed on first access. All lookups after initialization are O(1)
 * via Map index.
 *
 * @example
 * ```ts
 * import { AxonQuestionnaires } from '@careagent/axon'
 *
 * const q = AxonQuestionnaires.getForType('physician')
 * if (q) {
 *   console.log(q.display_name)  // 'Physician Scope Questionnaire'
 *   console.log(q.questions.length)
 * }
 *
 * AxonQuestionnaires.listAvailableTypes()  // ['physician', 'nurse_practitioner', ...]
 * ```
 */
export class AxonQuestionnaires {
  /** Provider type ID -> Questionnaire (lazy loaded) */
  private static _index: Map<string, Questionnaire> | undefined

  /**
   * Lazy-loading getter for the questionnaire index.
   * Loads all questionnaires for all known provider types on first access.
   */
  private static get index(): Map<string, Questionnaire> {
    if (AxonQuestionnaires._index === undefined) {
      const index = new Map<string, Questionnaire>()
      const providerTypes = AxonTaxonomy.getProviderTypes()

      for (const type of providerTypes) {
        const questionnaire = loadQuestionnaire(type.id)
        index.set(type.id, questionnaire)
      }

      AxonQuestionnaires._index = index
    }
    return AxonQuestionnaires._index
  }

  /**
   * Get the questionnaire for a given provider type.
   *
   * @param providerTypeId - The provider type ID (e.g., 'physician')
   * @returns The Questionnaire object, or undefined if no questionnaire exists for this type
   */
  static getForType(providerTypeId: string): Questionnaire | undefined {
    return AxonQuestionnaires.index.get(providerTypeId)
  }

  /**
   * List all provider type IDs that have questionnaires.
   *
   * @returns Array of provider type IDs with available questionnaires
   */
  static listAvailableTypes(): string[] {
    return [...AxonQuestionnaires.index.keys()]
  }
}
