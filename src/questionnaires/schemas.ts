import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

// --- Answer Type ---
export const AnswerTypeSchema = Type.Union([
  Type.Literal('boolean'),
  Type.Literal('single_select'),
  Type.Literal('multi_select'),
  Type.Literal('text'),
  Type.Literal('number'),
  Type.Literal('date'),
])

// --- Classification (domain × sensitivity) ---
export const ClassificationSchema = Type.Object({
  domain: Type.Union([Type.Literal('clinical'), Type.Literal('administrative')]),
  sensitivity: Type.Union([Type.Literal('sensitive'), Type.Literal('non_sensitive')]),
})

// --- Question Option (for single_select / multi_select questions) ---
export const QuestionOptionSchema = Type.Object({
  value: Type.String(),
  label: Type.String(),
  description: Type.Optional(Type.String()),
})

// --- Question Condition (show/hide based on one prior answer) ---
export const QuestionConditionSchema = Type.Object({
  question_id: Type.String(),
  equals: Type.Optional(Type.String()),
  operator: Type.Optional(Type.Union([
    Type.Literal('equals'),
    Type.Literal('not_equals'),
    Type.Literal('contains'),
    Type.Literal('greater_than'),
    Type.Literal('less_than'),
  ])),
  value: Type.Optional(Type.String()),
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

// --- Section (logical grouping of questions) ---
export const SectionSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  description: Type.Optional(Type.String()),
  question_ids: Type.Array(Type.String()),
})

// --- Question ---
export const QuestionSchema = Type.Object({
  id: Type.String(),
  text: Type.String(),
  answer_type: AnswerTypeSchema,
  required: Type.Boolean(),
  options: Type.Optional(Type.Array(QuestionOptionSchema)),
  show_when: Type.Optional(QuestionConditionSchema),
  cans_field: Type.Optional(Type.String()),
  action_assignments: Type.Optional(Type.Array(ActionAssignmentSchema)),
  validation: Type.Optional(TextValidationSchema),
  npi_lookup: Type.Optional(Type.Boolean()),
  /** Key into NPI lookup result to pre-fill this question's value. */
  npi_prefill: Type.Optional(Type.String()),
  /** LLM guidance for presenting this question conversationally. */
  llm_guidance: Type.Optional(Type.String()),
  /** Classification metadata for this question. */
  classification: Type.Optional(ClassificationSchema),
  /** Interaction mode: structured (rigid) or guided (LLM has latitude). */
  mode: Type.Optional(Type.Union([Type.Literal('structured'), Type.Literal('guided')])),
})

// --- Questionnaire (root schema) ---
export const QuestionnaireSchema = Type.Object({
  /** Unique questionnaire identifier (optional for backward compat). */
  id: Type.Optional(Type.String()),
  provider_type: Type.String(),
  version: Type.String(),
  taxonomy_version: Type.String(),
  display_name: Type.String(),
  description: Type.String(),
  questions: Type.Array(QuestionSchema),
  /** Issuing authority (e.g., 'axon', 'provider-core'). */
  authority: Type.Optional(Type.String()),
  /** Target entity type (e.g., 'provider', 'patient'). */
  target_type: Type.Optional(Type.String()),
  /** Classification metadata for the entire questionnaire. */
  classification: Type.Optional(ClassificationSchema),
  /** JSON Schema for the structured output artifact. */
  output_schema: Type.Optional(Type.String()),
  /** Output artifact type (e.g., 'cans', 'consent', 'intake'). */
  output_artifact: Type.Optional(Type.String()),
  /** Logical sections grouping questions. */
  sections: Type.Optional(Type.Array(SectionSchema)),
  /** System prompt for the LLM conducting this questionnaire. */
  llm_system_prompt: Type.Optional(Type.String()),
  /** Criteria for considering the questionnaire complete. */
  completion_criteria: Type.Optional(Type.String()),
})

// Compiled validator for runtime JSON validation
export const QuestionnaireValidator = TypeCompiler.Compile(QuestionnaireSchema)
