import { describe, it, expect } from 'vitest'
import { AxonQuestionnaires } from '../src/questionnaires/questionnaires.js'

describe('AxonQuestionnaires', () => {
  describe('getForType()', () => {
    it('returns a questionnaire for "physician"', () => {
      const q = AxonQuestionnaires.getForType('physician')
      expect(q).toBeDefined()
      expect(q!.provider_type).toBe('physician')
      expect(q!.questions.length).toBeGreaterThan(0)
    })

    it('returns a stub for "nursing"', () => {
      const q = AxonQuestionnaires.getForType('nursing')
      expect(q).toBeDefined()
      expect(q!.provider_type).toBe('nursing')
      expect(q!.questions).toHaveLength(0)
    })

    it('returns undefined for unknown type', () => {
      const q = AxonQuestionnaires.getForType('nonexistent_type')
      expect(q).toBeUndefined()
    })

    it('returns consistent results (cached)', () => {
      const q1 = AxonQuestionnaires.getForType('physician')
      const q2 = AxonQuestionnaires.getForType('physician')
      expect(q1).toBe(q2)
    })
  })

  describe('listAvailableTypes()', () => {
    it('returns all 49 provider types', () => {
      const types = AxonQuestionnaires.listAvailableTypes()
      expect(types).toHaveLength(49)
    })

    it('includes "physician"', () => {
      const types = AxonQuestionnaires.listAvailableTypes()
      expect(types).toContain('physician')
    })

    it('includes "nursing"', () => {
      const types = AxonQuestionnaires.listAvailableTypes()
      expect(types).toContain('nursing')
    })
  })

  describe('physician questionnaire features', () => {
    it('has conditional questions (show_when)', () => {
      const q = AxonQuestionnaires.getForType('physician')!
      const conditionalQuestions = q.questions.filter(
        (question) => question.show_when !== undefined,
      )
      expect(conditionalQuestions.length).toBeGreaterThan(0)
    })

    it('has action assignments', () => {
      const q = AxonQuestionnaires.getForType('physician')!
      const questionsWithAssignments = q.questions.filter(
        (question) => question.action_assignments !== undefined,
      )
      expect(questionsWithAssignments.length).toBeGreaterThan(0)
    })
  })

  describe('all questionnaires have valid metadata', () => {
    it('every type has non-empty provider_type, version, display_name, description', () => {
      const types = AxonQuestionnaires.listAvailableTypes()
      for (const typeId of types) {
        const q = AxonQuestionnaires.getForType(typeId)!
        expect(q.provider_type.length).toBeGreaterThan(0)
        expect(q.version.length).toBeGreaterThan(0)
        expect(q.display_name.length).toBeGreaterThan(0)
        expect(q.description.length).toBeGreaterThan(0)
      }
    })
  })
})
