import type { Static } from '@sinclair/typebox'
import type {
  TaxonomyVersionSchema,
  TaxonomyActionSchema,
  ProviderTypeSchema,
  AtomicActionSchema,
  GovernedBySchema,
  ProviderTypeCategorySchema,
} from '../taxonomy/schemas.js'
import type {
  QuestionnaireSchema,
  QuestionSchema,
  QuestionOptionSchema,
  QuestionConditionSchema,
  ActionAssignmentSchema,
  AnswerTypeSchema,
} from '../questionnaires/schemas.js'
import type {
  RegistryEntrySchema,
  NeuronEndpointSchema,
  CredentialRecordSchema,
  OrganizationAffiliationSchema,
  CredentialStatusSchema,
  VerificationSourceSchema,
  EntityTypeSchema,
  RegistrySearchQuerySchema,
} from '../registry/schemas.js'

export type TaxonomyVersion = Static<typeof TaxonomyVersionSchema>
export type TaxonomyAction = Static<typeof TaxonomyActionSchema>
export type ProviderType = Static<typeof ProviderTypeSchema>
export type AtomicAction = Static<typeof AtomicActionSchema>
export type GovernedBy = Static<typeof GovernedBySchema>
export type ProviderTypeCategory = Static<typeof ProviderTypeCategorySchema>

export type Questionnaire = Static<typeof QuestionnaireSchema>
export type Question = Static<typeof QuestionSchema>
export type QuestionOption = Static<typeof QuestionOptionSchema>
export type QuestionCondition = Static<typeof QuestionConditionSchema>
export type ActionAssignment = Static<typeof ActionAssignmentSchema>
export type AnswerType = Static<typeof AnswerTypeSchema>

export type RegistryEntry = Static<typeof RegistryEntrySchema>
export type NeuronEndpoint = Static<typeof NeuronEndpointSchema>
export type CredentialRecord = Static<typeof CredentialRecordSchema>
export type OrganizationAffiliation = Static<typeof OrganizationAffiliationSchema>
export type CredentialStatus = Static<typeof CredentialStatusSchema>
export type VerificationSource = Static<typeof VerificationSourceSchema>
export type EntityType = Static<typeof EntityTypeSchema>
export type RegistrySearchQuery = Static<typeof RegistrySearchQuerySchema>
