export * from './taxonomy/index.js'
export * from './questionnaires/index.js'
export * from './registry/index.js'
export * from './protocol/index.js'
export * from './broker/index.js'
export * from './types/index.js'

import { AxonRegistry } from './registry/index.js'
import { AxonBroker } from './broker/index.js'
import { AxonTaxonomy } from './taxonomy/index.js'
import { AxonQuestionnaires } from './questionnaires/index.js'

/** Version of the @careagent/axon package */
export const AXON_VERSION = '0.1.0'

/**
 * Convenience namespace object grouping all Axon core classes.
 *
 * @example
 * ```ts
 * import { Axon } from '@careagent/axon'
 *
 * Axon.Taxonomy.getActionsForType('physician')
 * Axon.Questionnaires.getForType('physician')
 * const registry = new Axon.Registry('/tmp/registry.json')
 * ```
 */
export const Axon = {
  Registry: AxonRegistry,
  Broker: AxonBroker,
  Taxonomy: AxonTaxonomy,
  Questionnaires: AxonQuestionnaires,
  version: AXON_VERSION,
} as const
