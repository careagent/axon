import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

// --- Atomic Action ---
export const AtomicActionSchema = Type.Union([
  Type.Literal('chart'),
  Type.Literal('order'),
  Type.Literal('charge'),
  Type.Literal('perform'),
  Type.Literal('interpret'),
  Type.Literal('educate'),
  Type.Literal('coordinate'),
])

// --- Governed By ---
export const GovernedBySchema = Type.Union([
  Type.Literal('state_board'),
  Type.Literal('institution'),
  Type.Literal('specialty_board'),
  Type.Literal('federal'),
  Type.Literal('professional_association'),
])

// --- Provider Type Category ---
export const ProviderTypeCategorySchema = Type.Union([
  Type.Literal('medical'),
  Type.Literal('dental'),
  Type.Literal('behavioral_health'),
  Type.Literal('allied_health'),
  Type.Literal('diagnostics'),
  Type.Literal('emergency'),
  Type.Literal('surgical'),
  Type.Literal('administrative'),
])

// --- Taxonomy Action ---
export const TaxonomyActionSchema = Type.Object({
  id: Type.String(),
  atomic_action: AtomicActionSchema,
  display_name: Type.String(),
  description: Type.String(),
  applicable_types: Type.Array(Type.String()),
  governed_by: Type.Array(GovernedBySchema),
  parent: Type.Optional(Type.String()),
  added_in: Type.String(),
  deprecated_in: Type.Optional(Type.String()),
})

// --- Provider Type ---
export const ProviderTypeSchema = Type.Object({
  id: Type.String(),
  display_name: Type.String(),
  category: ProviderTypeCategorySchema,
  member_roles: Type.Array(Type.String()),
})

// --- Taxonomy Version (root schema) ---
export const TaxonomyVersionSchema = Type.Object({
  version: Type.String(),
  effective_date: Type.String(),
  description: Type.String(),
  provider_types: Type.Array(ProviderTypeSchema),
  actions: Type.Array(TaxonomyActionSchema),
})

// Compiled validator for runtime JSON validation
export const TaxonomyVersionValidator = TypeCompiler.Compile(TaxonomyVersionSchema)
