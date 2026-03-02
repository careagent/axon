/**
 * Tests for questionnaire schema evolution — backward compatibility,
 * new answer types, optional cans_field, new condition operators,
 * classification metadata, sections, and questionnaire-level fields.
 */

import { describe, it, expect } from 'vitest'
import { QuestionnaireValidator } from '../src/questionnaires/schemas.js'
import { loadQuestionnaire } from '../src/questionnaires/loader.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinimalQuestionnaire(overrides: Record<string, unknown> = {}) {
  return {
    provider_type: 'test_type',
    version: '1.0.0',
    taxonomy_version: '1.0.0',
    display_name: 'Test Questionnaire',
    description: 'A test questionnaire',
    questions: [
      {
        id: 'q1',
        text: 'Test question?',
        answer_type: 'boolean',
        required: true,
        cans_field: 'provider.types',
      },
    ],
    ...overrides,
  }
}

function makeQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q1',
    text: 'Test question?',
    answer_type: 'boolean',
    required: true,
    cans_field: 'provider.types',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Backward Compatibility
// ---------------------------------------------------------------------------

describe('Backward compatibility', () => {
  it('physician.json still validates against evolved schema', () => {
    // This is the most important test — existing data must not break
    const questionnaire = loadQuestionnaire('physician')
    expect(questionnaire.provider_type).toBe('physician')
    expect(questionnaire.questions.length).toBeGreaterThan(20)
  })

  it('minimal legacy questionnaire validates unchanged', () => {
    const data = makeMinimalQuestionnaire()
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('legacy show_when with equals still validates', () => {
    const data = makeMinimalQuestionnaire({
      questions: [
        makeQuestion({ id: 'q1' }),
        makeQuestion({
          id: 'q2',
          show_when: { question_id: 'q1', equals: 'true' },
        }),
      ],
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('existing questionnaire data files all validate', () => {
    // Smoke test: load a sampling of existing questionnaires
    for (const type of ['physician', 'nursing', 'pharmacy', 'dental']) {
      expect(() => loadQuestionnaire(type)).not.toThrow()
    }
  })
})

// ---------------------------------------------------------------------------
// New Answer Types
// ---------------------------------------------------------------------------

describe('New answer types', () => {
  it('multi_select answer type validates', () => {
    const data = makeMinimalQuestionnaire({
      questions: [makeQuestion({ answer_type: 'multi_select' })],
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('number answer type validates', () => {
    const data = makeMinimalQuestionnaire({
      questions: [makeQuestion({ answer_type: 'number' })],
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('date answer type validates', () => {
    const data = makeMinimalQuestionnaire({
      questions: [makeQuestion({ answer_type: 'date' })],
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('invalid answer type fails validation', () => {
    const data = makeMinimalQuestionnaire({
      questions: [makeQuestion({ answer_type: 'invalid_type' })],
    })
    expect(QuestionnaireValidator.Check(data)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Optional cans_field
// ---------------------------------------------------------------------------

describe('Optional cans_field', () => {
  it('question without cans_field validates', () => {
    const q = makeQuestion()
    delete (q as Record<string, unknown>).cans_field
    const data = makeMinimalQuestionnaire({ questions: [q] })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('question with cans_field still validates', () => {
    const data = makeMinimalQuestionnaire({
      questions: [makeQuestion({ cans_field: 'provider.types' })],
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// New Condition Operators
// ---------------------------------------------------------------------------

describe('New condition operators', () => {
  it('operator+value condition format validates', () => {
    const data = makeMinimalQuestionnaire({
      questions: [
        makeQuestion({ id: 'q1' }),
        makeQuestion({
          id: 'q2',
          show_when: { question_id: 'q1', operator: 'equals', value: 'true' },
        }),
      ],
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('not_equals operator validates', () => {
    const data = makeMinimalQuestionnaire({
      questions: [
        makeQuestion({ id: 'q1' }),
        makeQuestion({
          id: 'q2',
          show_when: { question_id: 'q1', operator: 'not_equals', value: 'none' },
        }),
      ],
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('contains operator validates', () => {
    const data = makeMinimalQuestionnaire({
      questions: [
        makeQuestion({ id: 'q1', answer_type: 'text' }),
        makeQuestion({
          id: 'q2',
          show_when: { question_id: 'q1', operator: 'contains', value: 'surgery' },
        }),
      ],
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('greater_than and less_than operators validate', () => {
    for (const operator of ['greater_than', 'less_than'] as const) {
      const data = makeMinimalQuestionnaire({
        questions: [
          makeQuestion({ id: 'q1', answer_type: 'number' }),
          makeQuestion({
            id: 'q2',
            show_when: { question_id: 'q1', operator, value: '5' },
          }),
        ],
      })
      expect(QuestionnaireValidator.Check(data)).toBe(true)
    }
  })

  it('invalid operator fails validation', () => {
    const data = makeMinimalQuestionnaire({
      questions: [
        makeQuestion({ id: 'q1' }),
        makeQuestion({
          id: 'q2',
          show_when: { question_id: 'q1', operator: 'invalid', value: 'x' },
        }),
      ],
    })
    expect(QuestionnaireValidator.Check(data)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Question-level New Fields
// ---------------------------------------------------------------------------

describe('Question-level new fields', () => {
  it('llm_guidance validates', () => {
    const data = makeMinimalQuestionnaire({
      questions: [makeQuestion({ llm_guidance: 'Present this warmly' })],
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('classification validates', () => {
    const data = makeMinimalQuestionnaire({
      questions: [
        makeQuestion({
          classification: { domain: 'clinical', sensitivity: 'sensitive' },
        }),
      ],
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('invalid classification domain fails', () => {
    const data = makeMinimalQuestionnaire({
      questions: [
        makeQuestion({
          classification: { domain: 'invalid', sensitivity: 'sensitive' },
        }),
      ],
    })
    expect(QuestionnaireValidator.Check(data)).toBe(false)
  })

  it('mode field validates', () => {
    for (const mode of ['structured', 'guided']) {
      const data = makeMinimalQuestionnaire({
        questions: [makeQuestion({ mode })],
      })
      expect(QuestionnaireValidator.Check(data)).toBe(true)
    }
  })

  it('invalid mode fails validation', () => {
    const data = makeMinimalQuestionnaire({
      questions: [makeQuestion({ mode: 'freeform' })],
    })
    expect(QuestionnaireValidator.Check(data)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Questionnaire-level New Fields
// ---------------------------------------------------------------------------

describe('Questionnaire-level new fields', () => {
  it('id field validates', () => {
    const data = makeMinimalQuestionnaire({ id: 'physician-credentialing-v1' })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('authority field validates', () => {
    const data = makeMinimalQuestionnaire({ authority: 'axon' })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('target_type field validates', () => {
    const data = makeMinimalQuestionnaire({ target_type: 'provider' })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('questionnaire-level classification validates', () => {
    const data = makeMinimalQuestionnaire({
      classification: { domain: 'administrative', sensitivity: 'non_sensitive' },
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('output_schema and output_artifact validate', () => {
    const data = makeMinimalQuestionnaire({
      output_schema: '{"type":"object"}',
      output_artifact: 'cans',
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('sections validate', () => {
    const data = makeMinimalQuestionnaire({
      sections: [
        { id: 'sec1', title: 'Identity', question_ids: ['q1'] },
        { id: 'sec2', title: 'Credentials', description: 'Degrees and licenses', question_ids: [] },
      ],
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('llm_system_prompt validates', () => {
    const data = makeMinimalQuestionnaire({
      llm_system_prompt: 'You are conducting a credentialing interview.',
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('completion_criteria validates', () => {
    const data = makeMinimalQuestionnaire({
      completion_criteria: 'All required questions answered with valid responses.',
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })

  it('all new fields together validate', () => {
    const data = makeMinimalQuestionnaire({
      id: 'full-test',
      authority: 'axon',
      target_type: 'provider',
      classification: { domain: 'clinical', sensitivity: 'sensitive' },
      output_schema: '{}',
      output_artifact: 'cans',
      sections: [{ id: 's1', title: 'S1', question_ids: ['q1'] }],
      llm_system_prompt: 'Be professional.',
      completion_criteria: 'All done.',
    })
    expect(QuestionnaireValidator.Check(data)).toBe(true)
  })
})
