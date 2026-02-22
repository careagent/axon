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
