import type { Static } from '@sinclair/typebox'
import type {
  TaxonomyVersionSchema,
  TaxonomyActionSchema,
  ProviderTypeSchema,
  AtomicActionSchema,
  GovernedBySchema,
  ProviderTypeCategorySchema,
} from '../taxonomy/schemas.js'

export type TaxonomyVersion = Static<typeof TaxonomyVersionSchema>
export type TaxonomyAction = Static<typeof TaxonomyActionSchema>
export type ProviderType = Static<typeof ProviderTypeSchema>
export type AtomicAction = Static<typeof AtomicActionSchema>
export type GovernedBy = Static<typeof GovernedBySchema>
export type ProviderTypeCategory = Static<typeof ProviderTypeCategorySchema>
