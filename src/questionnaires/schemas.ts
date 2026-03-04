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

// --- Repeat-for directive (iterate a question group over a data array) ---
export const RepeatForSchema = Type.Object({
  /** Dot-path into the session context to iterate over (e.g., 'npi_lookup.licenses'). */
  source: Type.String(),
  /** Variable name exposed to child questions' text/llm_guidance via {{var}} interpolation. */
  iterator_var: Type.String(),
  /** If true, the first item is treated as primary with stricter validation. */
  primary_first: Type.Optional(Type.Boolean()),
})

// --- Hard-stop rule (blocks onboarding on condition) ---
export const HardStopSchema = Type.Object({
  /** Condition that triggers the hard stop. */
  operator: Type.Union([
    Type.Literal('equals'),
    Type.Literal('not_equals'),
    Type.Literal('mismatch'),
  ]),
  /** Value to compare against (for equals/not_equals). */
  value: Type.Optional(Type.String()),
  /** Dot-path into session context for mismatch comparison. */
  compare_to: Type.Optional(Type.String()),
  /** Message to show the provider when the hard stop triggers. */
  message: Type.String(),
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
  /** Repeat this question for each item in a data array. */
  repeat_for: Type.Optional(RepeatForSchema),
  /** Hard-stop rule — blocks onboarding if the answer matches the condition. */
  hard_stop: Type.Optional(HardStopSchema),
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
