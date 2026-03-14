import { describe, it, expect } from 'vitest'
import { FormEngine } from '../../src/forms/engine.js'
import { AxonQuestionnaires } from '../../src/questionnaires/questionnaires.js'
import type { FormRequest } from '../../src/forms/schemas.js'

// ---------------------------------------------------------------------------
// Helper: build a minimal FormRequest
// ---------------------------------------------------------------------------
function makeRequest(
  questionnaire_id: string,
  answers: Record<string, unknown> = {},
  context?: Record<string, unknown>,
): FormRequest {
  return { questionnaire_id, answers, context }
}

// ---------------------------------------------------------------------------
// Tests using REAL questionnaires loaded via AxonQuestionnaires
// ---------------------------------------------------------------------------
describe('FormEngine (real questionnaires)', () => {
  describe('_provider_type_selection questionnaire', () => {
    const QID = '_provider_type_selection'

    it('returns the first question when answers are empty', () => {
      const res = FormEngine.next(makeRequest(QID))
      expect(res.status).toBe('question')
      expect(res.question).toBeDefined()
      expect(res.question!.id).toBe('provider_type')
      expect(res.question!.answer_type).toBe('single_select')
      expect(res.question!.required).toBe(true)
    })

    it('returns completed when the only question is answered', () => {
      const res = FormEngine.next(makeRequest(QID, { provider_type: 'physician' }))
      expect(res.status).toBe('completed')
      expect(res.artifacts).toBeDefined()
    })

    it('provides progress information', () => {
      const res = FormEngine.next(makeRequest(QID))
      expect(res.progress).toBeDefined()
      expect(res.progress!.current).toBe(1)
      expect(res.progress!.total).toBe(1)
      expect(res.progress!.percentage).toBe(0)
    })

    it('shows 100% progress on completion', () => {
      const res = FormEngine.next(makeRequest(QID, { provider_type: 'physician' }))
      expect(res.progress).toBeDefined()
      expect(res.progress!.percentage).toBe(100)
    })
  })

  describe('physician questionnaire', () => {
    const QID = 'physician'

    it('starts with the individual_npi question', () => {
      const res = FormEngine.next(makeRequest(QID))
      expect(res.status).toBe('question')
      expect(res.question!.id).toBe('individual_npi')
    })

    it('advances to provider_name after individual_npi is answered', () => {
      const res = FormEngine.next(
        makeRequest(QID, { individual_npi: '1234567890' }),
      )
      expect(res.status).toBe('question')
      expect(res.question!.id).toBe('provider_name')
    })

    it('prefills provider_name from context', () => {
      const res = FormEngine.next(
        makeRequest(
          QID,
          { individual_npi: '1234567890' },
          { npi_lookup: { name: 'Dr. Smith' } },
        ),
      )
      expect(res.question!.id).toBe('provider_name')
      expect(res.question!.npi_prefill).toBe('npi_lookup.name')
      expect(res.question!.prefilled_value).toBe('Dr. Smith')
    })

    it('skips certifications_list when has_certifications is false', () => {
      // Answer enough to get past identity section + has_certifications = false
      const answers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
        license_primary_state_confirm: true,
        license_active_primary: true,
        license_number_primary: 'ABC123',
        has_certifications: false,
      }

      const res = FormEngine.next(makeRequest(QID, answers))
      // Should skip certifications_list and go to has_subspecialty
      expect(res.status).toBe('question')
      expect(res.question!.id).toBe('has_subspecialty')
    })

    it('shows certifications_list when has_certifications is true', () => {
      const answers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
        license_primary_state_confirm: true,
        license_active_primary: true,
        license_number_primary: 'ABC123',
        has_certifications: true,
      }

      const res = FormEngine.next(makeRequest(QID, answers))
      expect(res.status).toBe('question')
      expect(res.question!.id).toBe('certifications_list')
    })

    it('triggers hard_stop when license_primary_state_confirm is false', () => {
      const answers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
        license_primary_state_confirm: false,
      }

      const res = FormEngine.next(makeRequest(QID, answers))
      expect(res.status).toBe('hard_stop')
      expect(res.hard_stop_message).toContain('primary practice state')
    })

    it('triggers hard_stop on license_active false', () => {
      const answers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
        license_primary_state_confirm: true,
        license_active_primary: false,
      }

      const res = FormEngine.next(makeRequest(QID, answers))
      expect(res.status).toBe('hard_stop')
      expect(res.hard_stop_message).toContain('license is not active')
    })

    it('builds artifacts from cans_field mappings on completion', () => {
      const allAnswers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
        license_primary_state_confirm: true,
        license_active_primary: true,
        license_number_primary: 'ABC123',
        has_certifications: false,
        has_subspecialty: false,
        practice_setting: 'private',
        clinical_charting: true,
        prescribing: false,
        diagnostic_ordering: true,
        results_interpretation: true,
        patient_education: true,
        care_coordination: true,
        billing: true,
        autonomy_chart: 'autonomous',
        autonomy_order: 'supervised',
        autonomy_charge: 'supervised',
        autonomy_interpret: 'supervised',
        autonomy_educate: 'autonomous',
        autonomy_coordinate: 'autonomous',
        cans_acknowledgment: true,
      }

      const res = FormEngine.next(makeRequest(QID, allAnswers))
      expect(res.status).toBe('completed')
      expect(res.artifacts).toBeDefined()

      // Check nested cans_field mappings
      const provider = res.artifacts!['provider'] as Record<string, unknown>
      expect(provider['npi']).toBe('1234567890')
      expect(provider['name']).toBe('Dr. Smith')

      const autonomy = res.artifacts!['autonomy'] as Record<string, unknown>
      expect(autonomy['chart']).toBe('autonomous')
      expect(autonomy['order']).toBe('supervised')

      const scope = res.artifacts!['scope'] as Record<string, unknown>
      expect(scope['practice_setting']).toBe('private')
    })

    it('skips prescribing-dependent questions when prescribing is false', () => {
      const answers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
        license_primary_state_confirm: true,
        license_active_primary: true,
        license_number_primary: 'ABC123',
        has_certifications: false,
        has_subspecialty: false,
        practice_setting: 'private',
        clinical_charting: true,
        prescribing: false,
      }

      const res = FormEngine.next(makeRequest(QID, answers))
      expect(res.status).toBe('question')
      // Should skip dea_number and controlled_substances, go to diagnostic_ordering
      expect(res.question!.id).toBe('diagnostic_ordering')
    })

    it('shows dea_number when prescribing is true', () => {
      const answers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
        license_primary_state_confirm: true,
        license_active_primary: true,
        license_number_primary: 'ABC123',
        has_certifications: false,
        has_subspecialty: false,
        practice_setting: 'private',
        clinical_charting: true,
        prescribing: true,
      }

      const res = FormEngine.next(makeRequest(QID, answers))
      expect(res.status).toBe('question')
      expect(res.question!.id).toBe('dea_number')
    })
  })
})

// ---------------------------------------------------------------------------
// Tests using INLINE mock questionnaires (via AxonQuestionnaires internals)
// ---------------------------------------------------------------------------
describe('FormEngine (unit tests)', () => {
  describe('unknown questionnaire', () => {
    it('returns hard_stop for unknown questionnaire_id', () => {
      const res = FormEngine.next(makeRequest('nonexistent_questionnaire_xyz'))
      expect(res.status).toBe('hard_stop')
      expect(res.hard_stop_message).toContain('Unknown questionnaire')
    })
  })

  describe('validate()', () => {
    it('returns error for unknown questionnaire', () => {
      const res = FormEngine.validate('nonexistent_xyz', 'q1', 'hello')
      expect(res.valid).toBe(false)
      expect(res.error).toContain('Unknown questionnaire')
    })

    it('returns error for unknown question', () => {
      const res = FormEngine.validate('_provider_type_selection', 'nonexistent_q', 'hello')
      expect(res.valid).toBe(false)
      expect(res.error).toContain('Unknown question')
    })

    it('validates required field — empty string fails', () => {
      // provider_type is required in _provider_type_selection
      const res = FormEngine.validate('_provider_type_selection', 'provider_type', '')
      expect(res.valid).toBe(false)
      expect(res.error).toContain('required')
    })

    it('validates required field — null fails', () => {
      const res = FormEngine.validate('_provider_type_selection', 'provider_type', null)
      expect(res.valid).toBe(false)
      expect(res.error).toContain('required')
    })

    it('validates required field — undefined fails', () => {
      const res = FormEngine.validate('_provider_type_selection', 'provider_type', undefined)
      expect(res.valid).toBe(false)
      expect(res.error).toContain('required')
    })

    it('validates text pattern for individual_npi (physician questionnaire)', () => {
      // Must be exactly 10 digits
      const invalid = FormEngine.validate('physician', 'individual_npi', '12345')
      expect(invalid.valid).toBe(false)
      expect(invalid.error).toContain('pattern')

      const valid = FormEngine.validate('physician', 'individual_npi', '1234567890')
      expect(valid.valid).toBe(true)
    })

    it('validates text min_length for provider_name', () => {
      const invalid = FormEngine.validate('physician', 'provider_name', 'A')
      expect(invalid.valid).toBe(false)
      expect(invalid.error).toContain('at least 2')

      const valid = FormEngine.validate('physician', 'provider_name', 'Dr. Smith')
      expect(valid.valid).toBe(true)
    })

    it('validates single_select against options', () => {
      // practice_setting has options: academic, private, hospital, government
      const invalid = FormEngine.validate('physician', 'practice_setting', 'telehealth')
      expect(invalid.valid).toBe(false)
      expect(invalid.error).toContain('must be one of')

      const valid = FormEngine.validate('physician', 'practice_setting', 'private')
      expect(valid.valid).toBe(true)
    })

    it('validates boolean answer type', () => {
      const validBool = FormEngine.validate('physician', 'has_certifications', true)
      expect(validBool.valid).toBe(true)

      const validStr = FormEngine.validate('physician', 'has_certifications', 'true')
      expect(validStr.valid).toBe(true)

      const invalid = FormEngine.validate('physician', 'has_certifications', 'yes')
      expect(invalid.valid).toBe(false)
      expect(invalid.error).toContain('boolean')
    })

    it('accepts non-required empty answers', () => {
      // dea_number is not required
      const res = FormEngine.validate('physician', 'dea_number', '')
      expect(res.valid).toBe(true)
    })
  })

  describe('show_when with different operators', () => {
    it('show_when equals shows the question', () => {
      // certifications_list shows when has_certifications equals "true"
      const answers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
        license_primary_state_confirm: true,
        license_active_primary: true,
        license_number_primary: 'ABC123',
        has_certifications: true,
      }
      const res = FormEngine.next(makeRequest('physician', answers))
      expect(res.question!.id).toBe('certifications_list')
    })

    it('show_when equals hides the question when condition not met', () => {
      const answers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
        license_primary_state_confirm: true,
        license_active_primary: true,
        license_number_primary: 'ABC123',
        has_certifications: false,
      }
      const res = FormEngine.next(makeRequest('physician', answers))
      // Should skip certifications_list entirely
      expect(res.question!.id).toBe('has_subspecialty')
    })
  })

  describe('hard_stop with equals operator', () => {
    it('triggers on exact value match', () => {
      const answers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
        license_primary_state_confirm: 'false',
      }
      const res = FormEngine.next(makeRequest('physician', answers))
      expect(res.status).toBe('hard_stop')
    })

    it('does not trigger when value does not match', () => {
      const answers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
        license_primary_state_confirm: true,
      }
      const res = FormEngine.next(makeRequest('physician', answers))
      expect(res.status).toBe('question')
    })
  })

  describe('hard_stop with mismatch operator', () => {
    it('triggers when answer mismatches context value', () => {
      const answers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
        license_primary_state_confirm: true,
        license_active_primary: false,
      }
      const res = FormEngine.next(makeRequest('physician', answers))
      expect(res.status).toBe('hard_stop')
    })

    it('passes when answer matches expected value', () => {
      const answers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
        license_primary_state_confirm: true,
        license_active_primary: true,
      }
      const res = FormEngine.next(makeRequest('physician', answers))
      expect(res.status).toBe('question')
      expect(res.question!.id).toBe('license_number_primary')
    })
  })

  describe('context interpolation in question text', () => {
    it('interpolates npi_lookup.license_state in question text', () => {
      const context = {
        npi_lookup: {
          license_state: 'SC',
        },
      }
      const answers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
      }
      const res = FormEngine.next(makeRequest('physician', answers, context))
      expect(res.status).toBe('question')
      expect(res.question!.id).toBe('license_primary_state_confirm')
      expect(res.question!.text).toContain('SC')
    })

    it('interpolates context variables in question text', () => {
      const context = {
        npi_lookup: {
          license_state: 'TX',
          licenses: [{ state: 'TX', number: 'TX-999' }],
        },
      }
      const answers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
      }
      const res = FormEngine.next(makeRequest('physician', answers, context))
      expect(res.question!.text).toContain('TX')
    })
  })

  describe('progress tracking', () => {
    it('increments progress as questions are answered', () => {
      const res1 = FormEngine.next(makeRequest('physician'))
      expect(res1.progress!.current).toBe(1)

      const res2 = FormEngine.next(
        makeRequest('physician', { individual_npi: '1234567890' }),
      )
      expect(res2.progress!.current).toBe(2)
      expect(res2.progress!.total).toBeGreaterThan(2)
    })

    it('percentage increases toward 100', () => {
      const res1 = FormEngine.next(makeRequest('physician'))
      const res2 = FormEngine.next(
        makeRequest('physician', { individual_npi: '1234567890' }),
      )
      expect(res2.progress!.percentage).toBeGreaterThan(res1.progress!.percentage)
    })
  })

  describe('npi_prefill from context', () => {
    it('sets prefilled_value when context has the key (nested path)', () => {
      const res = FormEngine.next(
        makeRequest(
          'physician',
          { individual_npi: '1234567890' },
          { npi_lookup: { name: 'Jane Doe' } },
        ),
      )
      expect(res.question!.id).toBe('provider_name')
      expect(res.question!.prefilled_value).toBe('Jane Doe')
    })

    it('does not set prefilled_value when context lacks the key', () => {
      const res = FormEngine.next(
        makeRequest('physician', { individual_npi: '1234567890' }, {}),
      )
      expect(res.question!.id).toBe('provider_name')
      expect(res.question!.prefilled_value).toBeUndefined()
    })

    it('resolves nested context paths for npi_prefill', () => {
      const res = FormEngine.next(
        makeRequest(
          'physician',
          {
            individual_npi: '1234567890',
            provider_name: 'Dr. Smith',
            organization_npi: '1234567891',
          },
          { npi_org_lookup: { organization_name: 'Smith Clinic' } },
        ),
      )
      expect(res.question!.id).toBe('organization_name')
      expect(res.question!.prefilled_value).toBe('Smith Clinic')
    })
  })

  describe('empty answers', () => {
    it('returns the first question when answers object is empty', () => {
      const res = FormEngine.next(makeRequest('physician', {}))
      expect(res.status).toBe('question')
      expect(res.question!.id).toBe('individual_npi')
    })
  })

  describe('classification and mode pass-through', () => {
    it('includes classification in the question response', () => {
      const res = FormEngine.next(makeRequest('physician'))
      expect(res.question!.classification).toBeDefined()
      expect(res.question!.classification!.domain).toBe('clinical')
      expect(res.question!.classification!.sensitivity).toBe('sensitive')
    })

    it('includes mode in the question response', () => {
      const res = FormEngine.next(makeRequest('physician'))
      expect(res.question!.mode).toBe('structured')
    })
  })

  describe('llm_guidance pass-through', () => {
    it('includes llm_guidance when present on the question', () => {
      const res = FormEngine.next(makeRequest('physician'))
      expect(res.question!.llm_guidance).toBeDefined()
      expect(res.question!.llm_guidance!.length).toBeGreaterThan(0)
    })
  })

  describe('validation constraints pass-through', () => {
    it('includes validation rules in the question response', () => {
      const res = FormEngine.next(makeRequest('physician'))
      // individual_npi has validation.pattern
      expect(res.question!.validation).toBeDefined()
      expect(res.question!.validation!.pattern).toBe('^\\d{10}$')
    })
  })

  describe('options pass-through', () => {
    it('includes options for single_select questions', () => {
      // Navigate to practice_setting
      const answers: Record<string, unknown> = {
        individual_npi: '1234567890',
        provider_name: 'Dr. Smith',
        organization_npi: '1234567891',
        organization_name: true,
        license_primary_state_confirm: true,
        license_active_primary: true,
        license_number_primary: 'ABC123',
        has_certifications: false,
        has_subspecialty: false,
      }
      const res = FormEngine.next(makeRequest('physician', answers))
      expect(res.question!.id).toBe('practice_setting')
      expect(res.question!.options).toBeDefined()
      expect(res.question!.options!.length).toBe(4)
      expect(res.question!.options![0]!.value).toBe('academic')
    })
  })

  describe('meta-questionnaire loading', () => {
    it('loads _universal_consent as a meta-questionnaire', () => {
      const q = AxonQuestionnaires.getMetaQuestionnaire('_universal_consent')
      if (q) {
        const res = FormEngine.next(makeRequest('_universal_consent'))
        expect(res.status).toBe('question')
        expect(res.question).toBeDefined()
      }
    })
  })
})
