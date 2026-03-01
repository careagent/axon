import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

// --- Answer Type ---
export const AnswerTypeSchema = Type.Union([
  Type.Literal('boolean'),
  Type.Literal('single_select'),
  Type.Literal('text'),
])

// --- Question Option (for single_select questions) ---
export const QuestionOptionSchema = Type.Object({
  value: Type.String(),
  label: Type.String(),
  description: Type.Optional(Type.String()),
})

// --- Question Condition (simple show/hide based on one prior answer) ---
export const QuestionConditionSchema = Type.Object({
  question_id: Type.String(),
  equals: Type.String(),
})

// --- Action Assignment (maps an answer value to taxonomy action IDs) ---
export const ActionAssignmentSchema = Type.Object({
  answer_value: Type.String(),
  grants: Type.Array(Type.String()),
})

// --- Validation constraints for text questions ---
export const TextValidationSchema = Type.Object({
  pattern: Type.Optional(Type.String()),
  min_length: Type.Optional(Type.Number()),
  max_length: Type.Optional(Type.Number()),
})

// --- Question ---
export const QuestionSchema = Type.Object({
  id: Type.String(),
  text: Type.String(),
  answer_type: AnswerTypeSchema,
  required: Type.Boolean(),
  options: Type.Optional(Type.Array(QuestionOptionSchema)),
  show_when: Type.Optional(QuestionConditionSchema),
  cans_field: Type.String(),
  action_assignments: Type.Optional(Type.Array(ActionAssignmentSchema)),
  validation: Type.Optional(TextValidationSchema),
  npi_lookup: Type.Optional(Type.Boolean()),
})

// --- Questionnaire (root schema) ---
export const QuestionnaireSchema = Type.Object({
  provider_type: Type.String(),
  version: Type.String(),
  taxonomy_version: Type.String(),
  display_name: Type.String(),
  description: Type.String(),
  questions: Type.Array(QuestionSchema),
})

// Compiled validator for runtime JSON validation
export const QuestionnaireValidator = TypeCompiler.Compile(QuestionnaireSchema)
