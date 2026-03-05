import { Type, type Static } from '@sinclair/typebox'
import {
  AnswerTypeSchema,
  ClassificationSchema,
  QuestionOptionSchema,
  TextValidationSchema,
} from '../questionnaires/schemas.js'

// --- FormRequest ---
export const FormRequestSchema = Type.Object({
  questionnaire_id: Type.String(),
  answers: Type.Record(Type.String(), Type.Unknown()),
  context: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  page: Type.Optional(Type.Number()),
})

export type FormRequest = Static<typeof FormRequestSchema>

// --- FormQuestion (question payload in a FormResponse) ---
export const FormQuestionSchema = Type.Object({
  id: Type.String(),
  text: Type.String(),
  answer_type: AnswerTypeSchema,
  required: Type.Boolean(),
  options: Type.Optional(Type.Array(QuestionOptionSchema)),
  llm_guidance: Type.Optional(Type.String()),
  classification: Type.Optional(ClassificationSchema),
  mode: Type.Optional(Type.String()),
  validation: Type.Optional(TextValidationSchema),
  npi_prefill: Type.Optional(Type.String()),
  prefilled_value: Type.Optional(Type.Unknown()),
})

export type FormQuestion = Static<typeof FormQuestionSchema>

// --- Progress ---
export const FormProgressSchema = Type.Object({
  current: Type.Number(),
  total: Type.Number(),
  percentage: Type.Number(),
})

export type FormProgress = Static<typeof FormProgressSchema>

// --- FormResponse ---
export const FormResponseSchema = Type.Object({
  status: Type.Union([
    Type.Literal('question'),
    Type.Literal('completed'),
    Type.Literal('hard_stop'),
  ]),
  question: Type.Optional(FormQuestionSchema),
  progress: Type.Optional(FormProgressSchema),
  artifacts: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  hard_stop_message: Type.Optional(Type.String()),
})

export type FormResponse = Static<typeof FormResponseSchema>

// --- ValidationResult ---
export const ValidationResultSchema = Type.Object({
  valid: Type.Boolean(),
  error: Type.Optional(Type.String()),
})

export type ValidationResult = Static<typeof ValidationResultSchema>
