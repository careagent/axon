import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AxonQuestionnaires } from '../src/questionnaires/questionnaires.js'
import { AxonTaxonomy } from '../src/taxonomy/taxonomy.js'
import { VALID_CANS_FIELDS } from '../src/questionnaires/cans-fields.js'
import { QuestionnaireValidator } from '../src/questionnaires/schemas.js'
import { loadQuestionnaire } from '../src/questionnaires/loader.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('questionnaire data integrity', () => {
  describe('loading completeness', () => {
    it('every provider type has a loadable questionnaire', () => {
      const providerTypes = AxonTaxonomy.getProviderTypes()
      for (const type of providerTypes) {
        const q = AxonQuestionnaires.getForType(type.id)
        expect(
          q,
          `Questionnaire for "${type.id}" should be loadable`,
        ).toBeDefined()
      }
    })

    it('every questionnaire provider_type matches its lookup key', () => {
      const types = AxonQuestionnaires.listAvailableTypes()
      for (const typeId of types) {
        const q = AxonQuestionnaires.getForType(typeId)!
        expect(
          q.provider_type,
          `Questionnaire "${typeId}" provider_type should match lookup key`,
        ).toBe(typeId)
      }
    })

    it('every questionnaire passes schema validation', () => {
      const types = AxonQuestionnaires.listAvailableTypes()
      for (const typeId of types) {
        const q = AxonQuestionnaires.getForType(typeId)!
        expect(
          QuestionnaireValidator.Check(q),
          `Questionnaire "${typeId}" should pass schema validation`,
        ).toBe(true)
      }
    })
  })

  describe('physician vs stubs', () => {
    it('physician questionnaire has questions; all stubs have zero', () => {
      const types = AxonQuestionnaires.listAvailableTypes()
      for (const typeId of types) {
        const q = AxonQuestionnaires.getForType(typeId)!
        if (typeId === 'physician') {
          expect(
            q.questions.length,
            'Physician should have questions',
          ).toBeGreaterThan(0)
        } else {
          expect(
            q.questions.length,
            `Stub "${typeId}" should have zero questions`,
          ).toBe(0)
        }
      }
    })
  })

  describe('physician conditional branching', () => {
    it('has at least one question with show_when', () => {
      const q = AxonQuestionnaires.getForType('physician')!
      const conditionalQuestions = q.questions.filter(
        (question) => question.show_when !== undefined,
      )
      expect(conditionalQuestions.length).toBeGreaterThan(0)
    })

    it('show_when.question_id references a prior question in the array', () => {
      const q = AxonQuestionnaires.getForType('physician')!
      const seenIds = new Set<string>()
      for (const question of q.questions) {
        if (question.show_when !== undefined) {
          expect(
            seenIds.has(question.show_when.question_id),
            `Question "${question.id}" show_when references "${question.show_when.question_id}" which should appear earlier`,
          ).toBe(true)
        }
        seenIds.add(question.id)
      }
    })
  })

  describe('physician action assignments', () => {
    it('has at least one question with action_assignments', () => {
      const q = AxonQuestionnaires.getForType('physician')!
      const questionsWithAssignments = q.questions.filter(
        (question) => question.action_assignments !== undefined,
      )
      expect(questionsWithAssignments.length).toBeGreaterThan(0)
    })

    it('total granted action count is greater than zero', () => {
      const q = AxonQuestionnaires.getForType('physician')!
      let totalGrants = 0
      for (const question of q.questions) {
        if (question.action_assignments !== undefined) {
          for (const assignment of question.action_assignments) {
            totalGrants += assignment.grants.length
          }
        }
      }
      expect(totalGrants).toBeGreaterThan(0)
    })
  })

  describe('taxonomy cross-validation (QUES-05)', () => {
    it('all taxonomy action IDs in physician questionnaire are valid', () => {
      const q = AxonQuestionnaires.getForType('physician')!
      for (const question of q.questions) {
        if (question.action_assignments !== undefined) {
          for (const assignment of question.action_assignments) {
            for (const actionId of assignment.grants) {
              expect(
                AxonTaxonomy.validateAction(actionId),
                `Action ID "${actionId}" in question "${question.id}" should exist in taxonomy`,
              ).toBe(true)
            }
          }
        }
      }
    })
  })

  describe('CANS field validation (QUES-06)', () => {
    it('all CANS field paths in all questionnaires are valid', () => {
      const types = AxonQuestionnaires.listAvailableTypes()
      for (const typeId of types) {
        const q = AxonQuestionnaires.getForType(typeId)!
        for (const question of q.questions) {
          expect(
            VALID_CANS_FIELDS.has(question.cans_field),
            `Question "${question.id}" in "${typeId}" has invalid CANS field "${question.cans_field}"`,
          ).toBe(true)
        }
      }
    })
  })

  describe('show_when ordering across all questionnaires', () => {
    it('all show_when conditions reference prior questions', () => {
      const types = AxonQuestionnaires.listAvailableTypes()
      for (const typeId of types) {
        const q = AxonQuestionnaires.getForType(typeId)!
        const seenIds = new Set<string>()
        for (const question of q.questions) {
          if (question.show_when !== undefined) {
            expect(
              seenIds.has(question.show_when.question_id),
              `"${typeId}" question "${question.id}" show_when references "${question.show_when.question_id}" which should appear earlier`,
            ).toBe(true)
          }
          seenIds.add(question.id)
        }
      }
    })
  })

  describe('taxonomy version consistency', () => {
    it('all questionnaires have matching taxonomy_version', () => {
      const taxonomyVersion = AxonTaxonomy.getVersion()
      const types = AxonQuestionnaires.listAvailableTypes()
      for (const typeId of types) {
        const q = AxonQuestionnaires.getForType(typeId)!
        expect(
          q.taxonomy_version,
          `Questionnaire "${typeId}" taxonomy_version should match taxonomy`,
        ).toBe(taxonomyVersion)
      }
    })
  })

  describe('answer value types', () => {
    it('physician action assignments use string answer values', () => {
      const q = AxonQuestionnaires.getForType('physician')!
      for (const question of q.questions) {
        if (question.action_assignments !== undefined) {
          for (const assignment of question.action_assignments) {
            expect(
              typeof assignment.answer_value,
              `Question "${question.id}" assignment answer_value should be string`,
            ).toBe('string')
          }
        }
      }
    })
  })

  describe('question ID uniqueness', () => {
    it('no duplicate question IDs within physician questionnaire', () => {
      const q = AxonQuestionnaires.getForType('physician')!
      const ids = q.questions.map((question) => question.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('schema validation rejects invalid data', () => {
    it('validator rejects data with missing required fields', () => {
      const invalidData = { provider_type: 'test' }
      expect(QuestionnaireValidator.Check(invalidData)).toBe(false)
    })

    it('validator reports errors for invalid questionnaire data', () => {
      const invalidData = { provider_type: 123, questions: 'not-an-array' }
      const errors = [...QuestionnaireValidator.Errors(invalidData)]
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('loader error paths', () => {
    it('loadQuestionnaire throws for nonexistent provider type', () => {
      expect(() => loadQuestionnaire('nonexistent_provider_xyz')).toThrow(
        /Could not locate questionnaire data file/,
      )
    })

    it('loadQuestionnaire throws for invalid schema data', () => {
      // Create a temporary invalid questionnaire file
      const dataDir = resolve(__dirname, '..', 'data', 'questionnaires')
      const tempFile = resolve(dataDir, '_test_invalid_schema.json')
      writeFileSync(tempFile, JSON.stringify({ provider_type: 123 }))
      try {
        expect(() => loadQuestionnaire('_test_invalid_schema')).toThrow(
          /schema validation failed/,
        )
      } finally {
        unlinkSync(tempFile)
      }
    })

    it('loadQuestionnaire throws for invalid taxonomy action ID', () => {
      const dataDir = resolve(__dirname, '..', 'data', 'questionnaires')
      const tempFile = resolve(dataDir, '_test_bad_action.json')
      const badData = {
        provider_type: '_test_bad_action',
        version: '1.0.0',
        taxonomy_version: '1.0.0',
        display_name: 'Test',
        description: 'Test',
        questions: [
          {
            id: 'q1',
            text: 'Test?',
            answer_type: 'boolean',
            required: true,
            cans_field: 'scope.permitted_actions',
            action_assignments: [
              { answer_value: 'true', grants: ['nonexistent.fake_action'] },
            ],
          },
        ],
      }
      writeFileSync(tempFile, JSON.stringify(badData))
      try {
        expect(() => loadQuestionnaire('_test_bad_action')).toThrow(
          /invalid taxonomy action ID/,
        )
      } finally {
        unlinkSync(tempFile)
      }
    })

    it('loadQuestionnaire throws for invalid CANS field', () => {
      const dataDir = resolve(__dirname, '..', 'data', 'questionnaires')
      const tempFile = resolve(dataDir, '_test_bad_cans.json')
      const badData = {
        provider_type: '_test_bad_cans',
        version: '1.0.0',
        taxonomy_version: '1.0.0',
        display_name: 'Test',
        description: 'Test',
        questions: [
          {
            id: 'q1',
            text: 'Test?',
            answer_type: 'boolean',
            required: true,
            cans_field: 'invalid.field.path',
          },
        ],
      }
      writeFileSync(tempFile, JSON.stringify(badData))
      try {
        expect(() => loadQuestionnaire('_test_bad_cans')).toThrow(
          /invalid CANS field path/,
        )
      } finally {
        unlinkSync(tempFile)
      }
    })

    it('loadQuestionnaire throws for show_when forward reference', () => {
      const dataDir = resolve(__dirname, '..', 'data', 'questionnaires')
      const tempFile = resolve(dataDir, '_test_bad_showwhen.json')
      const badData = {
        provider_type: '_test_bad_showwhen',
        version: '1.0.0',
        taxonomy_version: '1.0.0',
        display_name: 'Test',
        description: 'Test',
        questions: [
          {
            id: 'q1',
            text: 'Test?',
            answer_type: 'boolean',
            required: true,
            cans_field: 'scope.permitted_actions',
            show_when: { question_id: 'q_nonexistent', equals: 'true' },
          },
        ],
      }
      writeFileSync(tempFile, JSON.stringify(badData))
      try {
        expect(() => loadQuestionnaire('_test_bad_showwhen')).toThrow(
          /forward reference/,
        )
      } finally {
        unlinkSync(tempFile)
      }
    })
  })
})
