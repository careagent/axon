import { describe, it, expect } from 'vitest'
import { AxonQuestionnaires } from '../src/questionnaires/questionnaires.js'
import { loadMetaQuestionnaire } from '../src/questionnaires/loader.js'

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

  describe('physician questionnaire consent removal', () => {
    it('physician questionnaire no longer has consent questions', () => {
      const q = AxonQuestionnaires.getForType('physician')!
      const consentQuestions = q.questions.filter(
        (question) => question.id.startsWith('consent_'),
      )
      expect(consentQuestions).toHaveLength(0)
    })

    it('physician questionnaire no longer has consent section', () => {
      const q = AxonQuestionnaires.getForType('physician')!
      const consentSections = (q.sections ?? []).filter(
        (s) => s.id === 'consent',
      )
      expect(consentSections).toHaveLength(0)
    })
  })

  describe('getMetaQuestionnaire()', () => {
    it('returns universal consent questionnaire', () => {
      const q = AxonQuestionnaires.getMetaQuestionnaire('_universal_consent')
      expect(q).toBeDefined()
      expect(q!.provider_type).toBe('_universal_consent')
      expect(q!.output_artifact).toBe('consent')
      expect(q!.questions).toHaveLength(3)
    })

    it('universal consent has all 3 consent questions', () => {
      const q = AxonQuestionnaires.getMetaQuestionnaire('_universal_consent')!
      const ids = q.questions.map((question) => question.id)
      expect(ids).toContain('consent_hipaa')
      expect(ids).toContain('consent_synthetic')
      expect(ids).toContain('consent_audit')
    })

    it('returns provider type selection questionnaire', () => {
      const q = AxonQuestionnaires.getMetaQuestionnaire('_provider_type_selection')
      expect(q).toBeDefined()
      expect(q!.provider_type).toBe('_provider_type_selection')
      expect(q!.output_artifact).toBe('routing')
      expect(q!.questions).toHaveLength(1)
    })

    it('provider type selection options are enriched from taxonomy', () => {
      const q = AxonQuestionnaires.getMetaQuestionnaire('_provider_type_selection')!
      const typeQuestion = q.questions.find((question) => question.id === 'provider_type')!
      expect(typeQuestion.options).toBeDefined()
      expect(typeQuestion.options!.length).toBeGreaterThan(0)
      // Should contain physician among others
      const physicianOption = typeQuestion.options!.find((o) => o.value === 'physician')
      expect(physicianOption).toBeDefined()
    })

    it('returns undefined for unknown meta-questionnaire', () => {
      const q = AxonQuestionnaires.getMetaQuestionnaire('_nonexistent')
      expect(q).toBeUndefined()
    })

    it('caches meta-questionnaire after first load', () => {
      const q1 = AxonQuestionnaires.getMetaQuestionnaire('_universal_consent')
      const q2 = AxonQuestionnaires.getMetaQuestionnaire('_universal_consent')
      expect(q1).toBe(q2)
    })
  })

  describe('getOnboardingFlow()', () => {
    it('returns provider onboarding flow', () => {
      const flow = AxonQuestionnaires.getOnboardingFlow('provider')
      expect(flow).toBeDefined()
      expect(flow!.target_type).toBe('provider')
      expect(flow!.steps).toHaveLength(3)
    })

    it('flow step 1 is universal consent', () => {
      const flow = AxonQuestionnaires.getOnboardingFlow('provider')!
      expect(flow.steps[0]!.questionnaire_id).toBe('_universal_consent')
      expect(flow.steps[0]!.label).toBe('Consent')
    })

    it('flow step 2 is provider type selection with routing', () => {
      const flow = AxonQuestionnaires.getOnboardingFlow('provider')!
      expect(flow.steps[1]!.questionnaire_id).toBe('_provider_type_selection')
      expect(flow.steps[1]!.routes_to_next).toBe(true)
      expect(flow.steps[1]!.routing_question_id).toBe('provider_type')
    })

    it('flow step 3 uses {{provider_type}} placeholder', () => {
      const flow = AxonQuestionnaires.getOnboardingFlow('provider')!
      expect(flow.steps[2]!.questionnaire_id).toBe('{{provider_type}}')
    })

    it('returns undefined for unknown target type', () => {
      const flow = AxonQuestionnaires.getOnboardingFlow('unknown')
      expect(flow).toBeUndefined()
    })
  })
})

describe('loadMetaQuestionnaire', () => {
  it('loads _universal_consent without taxonomy validation', () => {
    const q = loadMetaQuestionnaire('_universal_consent')
    expect(q.provider_type).toBe('_universal_consent')
    expect(q.questions).toHaveLength(3)
  })

  it('loads _provider_type_selection with enriched options', () => {
    const q = loadMetaQuestionnaire('_provider_type_selection')
    const typeQuestion = q.questions[0]!
    expect(typeQuestion.id).toBe('provider_type')
    expect(typeQuestion.options!.length).toBeGreaterThan(0)
  })

  it('throws for nonexistent meta-questionnaire', () => {
    expect(() => loadMetaQuestionnaire('_nonexistent')).toThrow()
  })
})
