import { loadQuestionnaire, loadMetaQuestionnaire } from './loader.js'
import { AxonTaxonomy } from '../taxonomy/taxonomy.js'
import { getOnboardingFlow } from './onboarding-flow.js'
import type { Questionnaire } from '../types/index.js'
import type { OnboardingFlow } from './onboarding-flow.js'

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

  /**
   * Get a meta-questionnaire by ID (e.g., '_universal_consent', '_provider_type_selection').
   *
   * Meta-questionnaires are system-level questionnaires not tied to a provider type.
   * They are loaded on demand and cached.
   *
   * @param id - The meta-questionnaire ID (prefixed with '_')
   * @returns The Questionnaire object, or undefined if loading fails
   */
  static getMetaQuestionnaire(id: string): Questionnaire | undefined {
    // Check the main index first (in case it was cached there)
    const cached = AxonQuestionnaires.index.get(id)
    if (cached) return cached

    try {
      const questionnaire = loadMetaQuestionnaire(id)
      // Cache it in the index for subsequent lookups
      AxonQuestionnaires.index.set(id, questionnaire)
      return questionnaire
    } catch {
      return undefined
    }
  }

  /**
   * Get the onboarding flow for a target type.
   *
   * @param targetType - The target type (e.g., 'provider')
   * @returns The OnboardingFlow, or undefined if no flow exists for this type
   */
  static getOnboardingFlow(targetType: string): OnboardingFlow | undefined {
    return getOnboardingFlow(targetType)
  }
}
