import { AxonQuestionnaires } from '../questionnaires/questionnaires.js'
import { generateCANS } from './cans-generator.js'
import type { Question, Questionnaire, QuestionCondition } from '../types/index.js'
import type { FormRequest, FormResponse, FormQuestion, ValidationResult } from './schemas.js'

/**
 * Stateless form engine for processing questionnaire flows.
 *
 * Given a questionnaire ID and accumulated answers, returns the next
 * unanswered question, a completion status with artifacts, or a hard stop.
 *
 * No sessions, no stored state — every call is self-contained.
 */
export class FormEngine {
  /**
   * Get the next unanswered, visible question for the given questionnaire + answers.
   */
  static next(request: FormRequest): FormResponse {
    const questionnaire = FormEngine._loadQuestionnaire(request.questionnaire_id)
    if (!questionnaire) {
      return {
        status: 'hard_stop',
        hard_stop_message: `Unknown questionnaire: ${request.questionnaire_id}`,
      }
    }

    const context = request.context ?? {}
    const answers = request.answers

    // Expand questions (handles repeat_for)
    const expandedQuestions = FormEngine._expandQuestions(questionnaire.questions, context)

    // Filter to visible questions based on show_when conditions
    const visibleQuestions = expandedQuestions.filter((q) =>
      FormEngine._isVisible(q, answers),
    )

    const totalVisible = visibleQuestions.length

    // Find the first unanswered visible question
    for (let i = 0; i < visibleQuestions.length; i++) {
      const question = visibleQuestions[i]!
      const answerId = question.id
      const answer = answers[answerId]

      // If already answered, check for hard_stop on the given answer
      if (answer !== undefined) {
        const hardStopResult = FormEngine._checkHardStop(question, answer, context)
        if (hardStopResult) {
          return hardStopResult
        }
        continue
      }

      // This question is unanswered — return it
      const formQuestion = FormEngine._toFormQuestion(question, context)
      return {
        status: 'question',
        question: formQuestion,
        progress: {
          current: i + 1,
          total: totalVisible,
          percentage: Math.round((i / totalVisible) * 100),
        },
      }
    }

    // All visible questions answered — check all hard_stops first
    for (const question of visibleQuestions) {
      const answer = answers[question.id]
      if (answer !== undefined) {
        const hardStopResult = FormEngine._checkHardStop(question, answer, context)
        if (hardStopResult) {
          return hardStopResult
        }
      }
    }

    // Build artifacts from cans_field mappings
    const artifacts = FormEngine._buildArtifacts(visibleQuestions, answers)

    // Generate CANS.md if this is a provider-type questionnaire (not meta-questionnaires)
    const isMeta = request.questionnaire_id.startsWith('_')
    let cans: Record<string, unknown> | undefined
    if (!isMeta) {
      const cansResult = generateCANS({
        artifacts,
        context,
        answers,
      })
      cans = {
        content: cansResult.content,
        hash: cansResult.hash,
        document: cansResult.document,
      }
    }

    return {
      status: 'completed',
      artifacts,
      ...(cans ? { cans } : {}),
      progress: {
        current: totalVisible,
        total: totalVisible,
        percentage: 100,
      },
    }
  }

  /**
   * Validate a single answer against the question's constraints.
   */
  static validate(
    questionnaireId: string,
    questionId: string,
    answer: unknown,
  ): ValidationResult {
    const questionnaire = FormEngine._loadQuestionnaire(questionnaireId)
    if (!questionnaire) {
      return { valid: false, error: `Unknown questionnaire: ${questionnaireId}` }
    }

    const question = questionnaire.questions.find((q) => q.id === questionId)
    if (!question) {
      return { valid: false, error: `Unknown question: ${questionId}` }
    }

    return FormEngine._validateAnswer(question, answer)
  }

  // --- Private helpers ---

  /** Load a questionnaire by ID from AxonQuestionnaires. */
  private static _loadQuestionnaire(id: string): Questionnaire | undefined {
    // Try as provider type first, then as meta-questionnaire
    return AxonQuestionnaires.getForType(id) ?? AxonQuestionnaires.getMetaQuestionnaire(id)
  }

  /** Evaluate whether a question is visible given current answers. */
  private static _isVisible(question: Question, answers: Record<string, unknown>): boolean {
    if (!question.show_when) return true
    return FormEngine._evaluateCondition(question.show_when, answers)
  }

  /** Evaluate a show_when condition against accumulated answers. */
  private static _evaluateCondition(
    condition: QuestionCondition,
    answers: Record<string, unknown>,
  ): boolean {
    const answerValue = answers[condition.question_id]
    if (answerValue === undefined) return false

    const answerStr = String(answerValue)

    // Legacy format: just `equals` field
    if (condition.equals !== undefined && condition.operator === undefined) {
      return answerStr === condition.equals
    }

    // Extended format: `operator` + `value`
    const operator = condition.operator ?? 'equals'
    const compareValue = condition.value ?? condition.equals ?? ''

    switch (operator) {
      case 'equals':
        return answerStr === compareValue
      case 'not_equals':
        return answerStr !== compareValue
      case 'contains':
        return answerStr.includes(compareValue)
      case 'greater_than':
        return Number(answerStr) > Number(compareValue)
      case 'less_than':
        return Number(answerStr) < Number(compareValue)
      default:
        return false
    }
  }

  /** Check if a hard_stop triggers for the given answer. */
  private static _checkHardStop(
    question: Question,
    answer: unknown,
    context: Record<string, unknown>,
  ): FormResponse | null {
    if (!question.hard_stop) return null

    const hardStop = question.hard_stop
    const answerStr = String(answer)

    switch (hardStop.operator) {
      case 'equals':
        if (answerStr === (hardStop.value ?? '')) {
          return { status: 'hard_stop', hard_stop_message: hardStop.message }
        }
        break
      case 'not_equals':
        if (answerStr !== (hardStop.value ?? '')) {
          return { status: 'hard_stop', hard_stop_message: hardStop.message }
        }
        break
      case 'mismatch': {
        if (hardStop.compare_to) {
          const compareValue = FormEngine._resolveContextPath(hardStop.compare_to, context)
          if (compareValue !== undefined && answerStr !== String(compareValue)) {
            return { status: 'hard_stop', hard_stop_message: hardStop.message }
          }
        }
        break
      }
    }

    return null
  }

  /** Convert an internal Question to a FormQuestion for the response. */
  private static _toFormQuestion(
    question: Question,
    context: Record<string, unknown>,
  ): FormQuestion {
    // Resolve {{path.to.value}} templates in question text using context
    const resolvedText = question.text.replace(
      /\{\{(\w+(?:\.\w+)*)\}\}/g,
      (_match: string, path: string) => {
        const value = FormEngine._resolveContextPath(path, context)
        return value !== undefined ? String(value) : _match
      },
    )

    const formQuestion: FormQuestion = {
      id: question.id,
      text: resolvedText,
      answer_type: question.answer_type,
      required: question.required,
    }

    if (question.options) {
      formQuestion.options = question.options
    }
    if (question.llm_guidance) {
      formQuestion.llm_guidance = question.llm_guidance
    }
    if (question.classification) {
      formQuestion.classification = question.classification
    }
    if (question.mode) {
      formQuestion.mode = question.mode
    }
    if (question.validation) {
      formQuestion.validation = question.validation
    }
    if (question.npi_lookup) {
      formQuestion.npi_lookup = question.npi_lookup
    }
    if (question.npi_prefill) {
      formQuestion.npi_prefill = question.npi_prefill
      const prefilled = FormEngine._resolveContextPath(question.npi_prefill, context)
      if (prefilled !== undefined) {
        formQuestion.prefilled_value = prefilled
      }
    }

    return formQuestion
  }

  /** Resolve a dot-path into a nested context object. */
  private static _resolveContextPath(
    path: string,
    context: Record<string, unknown>,
  ): unknown {
    const parts = path.split('.')
    let current: unknown = context
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined
      }
      current = (current as Record<string, unknown>)[part]
    }
    return current
  }

  /** Expand repeat_for questions into per-item instances. */
  private static _expandQuestions(
    questions: Question[],
    context: Record<string, unknown>,
  ): Question[] {
    const expanded: Question[] = []

    for (const question of questions) {
      if (!question.repeat_for) {
        expanded.push(question)
        continue
      }

      const sourceArray = FormEngine._resolveContextPath(
        question.repeat_for.source,
        context,
      )
      if (!Array.isArray(sourceArray) || sourceArray.length === 0) {
        // No source data — include the question as-is (single instance)
        expanded.push(question)
        continue
      }

      const items = question.repeat_for.primary_first
        ? [...sourceArray].sort((a, b) => {
            const aP = (a as Record<string, unknown>).primary ? 1 : 0
            const bP = (b as Record<string, unknown>).primary ? 1 : 0
            return bP - aP
          })
        : sourceArray

      for (let i = 0; i < items.length; i++) {
        const item = items[i] as Record<string, unknown>
        const iteratorVar = question.repeat_for.iterator_var

        // Create a clone with interpolated text and unique ID
        const cloned: Question = {
          ...question,
          id: `${question.id}_${i}`,
          text: FormEngine._interpolateText(question.text, iteratorVar, item),
        }

        // Interpolate llm_guidance if present
        if (cloned.llm_guidance) {
          cloned.llm_guidance = FormEngine._interpolateText(
            cloned.llm_guidance,
            iteratorVar,
            item,
          )
        }

        expanded.push(cloned)
      }
    }

    return expanded
  }

  /** Replace {{var.field}} patterns in text with values from the iterator item. */
  private static _interpolateText(
    text: string,
    iteratorVar: string,
    item: Record<string, unknown>,
  ): string {
    return text.replace(
      new RegExp(`\\{\\{${iteratorVar}\\.(\\w+)\\}\\}`, 'g'),
      (_match, field: string) => {
        const value = item[field]
        return value !== undefined ? String(value) : `{{${iteratorVar}.${field}}}`
      },
    )
  }

  /** Build artifacts from cans_field mappings. */
  private static _buildArtifacts(
    questions: Question[],
    answers: Record<string, unknown>,
  ): Record<string, unknown> {
    const artifacts: Record<string, unknown> = {}

    for (const question of questions) {
      const answer = answers[question.id]
      if (answer === undefined || !question.cans_field) continue

      // Set nested path in artifacts
      FormEngine._setNestedPath(artifacts, question.cans_field, answer)
    }

    return artifacts
  }

  /** Set a dot-path value in a nested object, creating intermediaries as needed. */
  private static _setNestedPath(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split('.')
    let current: Record<string, unknown> = obj

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!
      if (current[part] === undefined || typeof current[part] !== 'object') {
        current[part] = {}
      }
      current = current[part] as Record<string, unknown>
    }

    const lastPart = parts[parts.length - 1]!
    current[lastPart] = value
  }

  /** Validate a single answer against its question constraints. */
  private static _validateAnswer(question: Question, answer: unknown): ValidationResult {
    // Check required
    if (question.required && (answer === undefined || answer === null || answer === '')) {
      return { valid: false, error: 'This field is required' }
    }

    // If answer is empty and not required, it's valid
    if (answer === undefined || answer === null || answer === '') {
      return { valid: true }
    }

    // Type-specific validation
    switch (question.answer_type) {
      case 'boolean': {
        if (typeof answer !== 'boolean' && answer !== 'true' && answer !== 'false') {
          return { valid: false, error: 'Answer must be a boolean (true/false)' }
        }
        break
      }
      case 'number': {
        const num = Number(answer)
        if (Number.isNaN(num)) {
          return { valid: false, error: 'Answer must be a number' }
        }
        break
      }
      case 'date': {
        const dateStr = String(answer)
        const parsed = Date.parse(dateStr)
        if (Number.isNaN(parsed)) {
          return { valid: false, error: 'Answer must be a valid date' }
        }
        break
      }
      case 'single_select': {
        if (question.options && question.options.length > 0) {
          const validValues = question.options.map((o) => o.value)
          if (!validValues.includes(String(answer))) {
            return {
              valid: false,
              error: `Answer must be one of: ${validValues.join(', ')}`,
            }
          }
        }
        break
      }
      case 'multi_select': {
        if (question.options && question.options.length > 0) {
          const validValues = question.options.map((o) => o.value)
          const selections = Array.isArray(answer) ? answer : [answer]
          for (const selection of selections) {
            if (!validValues.includes(String(selection))) {
              return {
                valid: false,
                error: `Invalid selection: ${String(selection)}. Must be one of: ${validValues.join(', ')}`,
              }
            }
          }
        }
        break
      }
      case 'text': {
        const textStr = String(answer)
        if (question.validation) {
          if (
            question.validation.min_length !== undefined &&
            textStr.length < question.validation.min_length
          ) {
            return {
              valid: false,
              error: `Answer must be at least ${question.validation.min_length} characters`,
            }
          }
          if (
            question.validation.max_length !== undefined &&
            textStr.length > question.validation.max_length
          ) {
            return {
              valid: false,
              error: `Answer must be at most ${question.validation.max_length} characters`,
            }
          }
          if (question.validation.pattern) {
            const regex = new RegExp(question.validation.pattern)
            if (!regex.test(textStr)) {
              return {
                valid: false,
                error: `Answer does not match required pattern: ${question.validation.pattern}`,
              }
            }
          }
        }
        break
      }
    }

    return { valid: true }
  }
}
