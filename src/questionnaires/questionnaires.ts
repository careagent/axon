import { loadQuestionnaire, loadMetaQuestionnaire } from './loader.js'
import { AxonTaxonomy } from '../taxonomy/taxonomy.js'
import { getOnboardingFlow as getOnboardingFlowLocal } from './onboarding-flow.js'
import {
  getSupabaseConfig,
  fetchAllQuestionnaires as fetchAllFromDb,
  fetchMetaQuestionnaire as fetchMetaFromDb,
  fetchOnboardingFlow as fetchFlowFromDb,
} from '../db/index.js'
import type { Questionnaire, QuestionOption } from '../types/index.js'
import type { OnboardingFlow } from './onboarding-flow.js'
import type { SupabaseConfig } from '../db/index.js'

/**
 * Static API for accessing Axon questionnaires by provider type.
 *
 * Supports two initialization paths:
 * - `init()` (async): Supabase-first with JSON fallback. Call once at startup.
 * - Lazy sync init: Falls back to JSON file loading on first property access
 *   (preserves backward compatibility for tests and local dev).
 *
 * @example
 * ```ts
 * import { AxonQuestionnaires } from '@careagent/axon'
 *
 * await AxonQuestionnaires.init() // at startup (optional)
 *
 * const q = AxonQuestionnaires.getForType('physician')
 * if (q) {
 *   console.log(q.display_name)
 *   console.log(q.questions.length)
 * }
 * ```
 */
export class AxonQuestionnaires {
  /** Provider type ID -> Questionnaire (lazy loaded) */
  private static _index: Map<string, Questionnaire> | undefined

  /** Supabase config cached at init time */
  private static _supabaseConfig: SupabaseConfig | null = null

  /** Whether async init has been called */
  private static _initialized = false

  /**
   * Async initialization — Supabase-first, JSON fallback.
   * Call once at server startup. Safe to call multiple times (no-ops after first).
   */
  static async init(): Promise<void> {
    if (AxonQuestionnaires._initialized) return
    AxonQuestionnaires._initialized = true

    const config = getSupabaseConfig()
    AxonQuestionnaires._supabaseConfig = config

    if (config) {
      try {
        const rows = await fetchAllFromDb(config)
        if (rows.length > 0) {
          const index = new Map<string, Questionnaire>()
          for (const row of rows) {
            index.set(row.provider_type, row.data)
          }
          AxonQuestionnaires._index = index
          return
        }
      } catch {
        // Fall through to JSON fallback
      }
    }

    // JSON fallback — same as lazy init
    AxonQuestionnaires._initFromJson()
  }

  /** Load all questionnaires from JSON files (sync). */
  private static _initFromJson(): void {
    const index = new Map<string, Questionnaire>()
    const providerTypes = AxonTaxonomy.getProviderTypes()

    for (const type of providerTypes) {
      const questionnaire = loadQuestionnaire(type.id)
      index.set(type.id, questionnaire)
    }

    AxonQuestionnaires._index = index
  }

  /**
   * Lazy-loading getter for the questionnaire index.
   * Loads all questionnaires for all known provider types on first access.
   */
  private static get index(): Map<string, Questionnaire> {
    if (AxonQuestionnaires._index === undefined) {
      AxonQuestionnaires._initFromJson()
    }
    return AxonQuestionnaires._index!
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
   * Checks Supabase first (if configured), then falls back to hardcoded flows.
   *
   * @param targetType - The target type (e.g., 'provider')
   * @returns The OnboardingFlow, or undefined if no flow exists for this type
   */
  static getOnboardingFlow(targetType: string): OnboardingFlow | undefined {
    return getOnboardingFlowLocal(targetType)
  }

  /**
   * Async version of getOnboardingFlow — checks Supabase first.
   * Used by the server when Supabase is available.
   */
  static async getOnboardingFlowAsync(targetType: string): Promise<OnboardingFlow | undefined> {
    if (AxonQuestionnaires._supabaseConfig) {
      try {
        const flow = await fetchFlowFromDb(AxonQuestionnaires._supabaseConfig, targetType)
        if (flow) return flow
      } catch {
        // Fall through to local
      }
    }
    return getOnboardingFlowLocal(targetType)
  }
}
