import { loadTaxonomy } from './loader.js'
import type {
  TaxonomyVersion,
  TaxonomyAction,
  ProviderType,
} from '../types/index.js'

/**
 * Static API for querying the Axon clinical action taxonomy.
 *
 * Uses lazy initialization -- the taxonomy JSON is loaded and indexed on first
 * access. All lookups after initialization are O(1) via Map/Set indexes.
 *
 * @example
 * ```ts
 * import { AxonTaxonomy } from '@careagent/axon'
 *
 * AxonTaxonomy.getVersion()                       // '1.0.0'
 * AxonTaxonomy.validateAction('chart.progress_note') // true
 * AxonTaxonomy.getActionsForType('physician')      // ['chart.progress_note', ...]
 * ```
 */
export class AxonTaxonomy {
  /** Raw validated taxonomy data (lazy loaded) */
  private static _data: TaxonomyVersion | undefined

  /** Action ID -> TaxonomyAction object */
  private static _actionIndex: Map<string, TaxonomyAction> | undefined

  /** Provider type ID -> array of action IDs */
  private static _typeIndex: Map<string, string[]> | undefined

  /** Set of all action IDs for O(1) validation */
  private static _actionSet: Set<string> | undefined

  /**
   * Lazy-loading getter for taxonomy data.
   * Triggers load and index build on first access.
   */
  private static get data(): TaxonomyVersion {
    if (AxonTaxonomy._data === undefined) {
      AxonTaxonomy._data = loadTaxonomy()
      AxonTaxonomy._buildIndexes()
    }
    return AxonTaxonomy._data
  }

  /**
   * Build inverted indexes after data is loaded.
   * Called once during lazy initialization.
   */
  private static _buildIndexes(): void {
    // _buildIndexes is only called from the data getter after _data is assigned,
    // so _data is guaranteed to be defined here. The non-null assertion is safe.
    const data = AxonTaxonomy._data!

    // Action ID -> TaxonomyAction
    AxonTaxonomy._actionIndex = new Map(
      data.actions.map((a) => [a.id, a]),
    )

    // All action IDs as a Set for O(1) validation
    AxonTaxonomy._actionSet = new Set(
      data.actions.map((a) => a.id),
    )

    // Inverted index: provider type ID -> action IDs
    const typeIndex = new Map<string, string[]>()
    for (const action of data.actions) {
      for (const typeId of action.applicable_types) {
        const existing = typeIndex.get(typeId)
        if (existing !== undefined) {
          existing.push(action.id)
        } else {
          typeIndex.set(typeId, [action.id])
        }
      }
    }
    AxonTaxonomy._typeIndex = typeIndex
  }

  /**
   * Get the taxonomy version string.
   * @returns The taxonomy version (e.g., '1.0.0')
   */
  static getVersion(): string {
    return AxonTaxonomy.data.version
  }

  /**
   * Validate whether an action ID exists in the taxonomy.
   * O(1) lookup via Set.
   *
   * @param actionId - The dot-notation action ID to validate
   * @returns true if the action ID exists in the taxonomy
   */
  static validateAction(actionId: string): boolean {
    // Access data to ensure lazy init has happened
    AxonTaxonomy.data
    return AxonTaxonomy._actionSet?.has(actionId) ?? false
  }

  /**
   * Get all action IDs available to a given provider type.
   * O(1) lookup via Map.
   *
   * @param providerTypeId - The provider type ID (e.g., 'physician')
   * @returns Array of action IDs, or empty array if type not found
   */
  static getActionsForType(providerTypeId: string): string[] {
    // Access data to ensure lazy init has happened
    AxonTaxonomy.data
    return AxonTaxonomy._typeIndex?.get(providerTypeId) ?? []
  }

  /**
   * Get the full TaxonomyAction object for a given action ID.
   *
   * @param actionId - The dot-notation action ID
   * @returns The TaxonomyAction object, or undefined if not found
   */
  static getAction(actionId: string): TaxonomyAction | undefined {
    // Access data to ensure lazy init has happened
    AxonTaxonomy.data
    return AxonTaxonomy._actionIndex?.get(actionId)
  }

  /**
   * Get all provider types in the taxonomy.
   *
   * @returns Array of all ProviderType objects
   */
  static getProviderTypes(): ProviderType[] {
    return AxonTaxonomy.data.provider_types
  }

  /**
   * Get provider types filtered by category.
   *
   * @param category - The category to filter by (e.g., 'medical', 'dental')
   * @returns Array of ProviderType objects in that category, or empty array if none found
   */
  static getProviderTypesByCategory(category: string): ProviderType[] {
    return AxonTaxonomy.data.provider_types.filter(
      (t) => t.category === category,
    )
  }

  /**
   * Get a single provider type by ID.
   *
   * @param id - The provider type ID (e.g., 'physician')
   * @returns The ProviderType object, or undefined if not found
   */
  static getType(id: string): ProviderType | undefined {
    return AxonTaxonomy.data.provider_types.find((t) => t.id === id)
  }
}
