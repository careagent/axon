import { describe, it, expect } from 'vitest'
import { AxonTaxonomy } from '../src/taxonomy/taxonomy.js'

/**
 * All 49 provider type IDs from the v1.0.0 taxonomy.
 * Used to verify completeness across multiple test suites.
 */
const ALL_PROVIDER_TYPE_IDS = [
  'physician',
  'advanced_practice_provider',
  'nursing',
  'nursing_support',
  'pharmacy',
  'dental',
  'behavioral_mental_health',
  'physical_rehabilitation',
  'occupational_therapy',
  'speech_language',
  'respiratory',
  'audiology',
  'vision_optometry',
  'radiology_imaging',
  'laboratory',
  'surgical',
  'emergency_prehospital',
  'nutrition_dietetics',
  'podiatry',
  'chiropractic',
  'midwifery',
  'genetic_counseling',
  'orthotics_prosthetics',
  'recreational_therapy',
  'creative_arts_therapy',
  'acupuncture_traditional_medicine',
  'massage_bodywork',
  'athletic_training',
  'sleep_medicine',
  'cardiac_vascular_diagnostics',
  'neurodiagnostics',
  'dialysis_nephrology',
  'wound_care',
  'sterile_processing',
  'health_information_coding',
  'community_public_health',
  'home_health_hospice',
  'patient_navigation',
  'lactation',
  'vision_rehabilitation',
  'deaf_hard_of_hearing',
  'anesthesia_technology',
  'clinical_research',
  'organ_tissue',
  'rehabilitation_engineering',
  'kinesiotherapy',
  'child_life',
  'medical_physics',
  'ophthalmic',
] as const

/**
 * The 7 atomic action categories defined in the taxonomy.
 */
const ATOMIC_ACTIONS = [
  'chart',
  'order',
  'charge',
  'perform',
  'interpret',
  'educate',
  'coordinate',
] as const

describe('AxonTaxonomy', () => {
  describe('getVersion()', () => {
    it('returns "1.0.0"', () => {
      expect(AxonTaxonomy.getVersion()).toBe('1.0.0')
    })

    it('returns a valid semver string', () => {
      const version = AxonTaxonomy.getVersion()
      expect(version).toMatch(/^\d+\.\d+\.\d+$/)
    })
  })

  describe('validateAction()', () => {
    it('returns true for known action ID "chart.progress_note"', () => {
      expect(AxonTaxonomy.validateAction('chart.progress_note')).toBe(true)
    })

    it('returns true for known action ID "order.medication"', () => {
      expect(AxonTaxonomy.validateAction('order.medication')).toBe(true)
    })

    it('returns false for unknown action ID "chart.made_up_action"', () => {
      expect(AxonTaxonomy.validateAction('chart.made_up_action')).toBe(false)
    })

    it('returns false for unknown action ID "nonexistent"', () => {
      expect(AxonTaxonomy.validateAction('nonexistent')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(AxonTaxonomy.validateAction('')).toBe(false)
    })

    it('returns false for partial ID that is not a leaf action', () => {
      // "chart" alone is an atomic action category, not a leaf action
      expect(AxonTaxonomy.validateAction('chart')).toBe(false)
    })
  })

  describe('getActionsForType()', () => {
    it('returns string[] for "physician"', () => {
      const actions = AxonTaxonomy.getActionsForType('physician')
      expect(Array.isArray(actions)).toBe(true)
      for (const action of actions) {
        expect(typeof action).toBe('string')
      }
    })

    it('returns non-empty array for "physician"', () => {
      const actions = AxonTaxonomy.getActionsForType('physician')
      expect(actions.length).toBeGreaterThan(0)
    })

    it('returns action IDs that all pass validateAction()', () => {
      const actions = AxonTaxonomy.getActionsForType('physician')
      for (const actionId of actions) {
        expect(AxonTaxonomy.validateAction(actionId)).toBe(true)
      }
    })

    it('returns empty array for unknown provider type ID', () => {
      expect(AxonTaxonomy.getActionsForType('unknown_type')).toEqual([])
    })

    it('returns non-empty array for every one of the 49 provider types', () => {
      for (const typeId of ALL_PROVIDER_TYPE_IDS) {
        const actions = AxonTaxonomy.getActionsForType(typeId)
        expect(
          actions.length,
          `Expected ${typeId} to have at least one action`,
        ).toBeGreaterThan(0)
      }
    })
  })

  describe('getAction()', () => {
    it('returns a TaxonomyAction object for known action ID', () => {
      const action = AxonTaxonomy.getAction('chart.progress_note')
      expect(action).toBeDefined()
    })

    it('returns undefined for unknown action ID', () => {
      const action = AxonTaxonomy.getAction('nonexistent.action')
      expect(action).toBeUndefined()
    })

    it('returned object has all required fields', () => {
      const action = AxonTaxonomy.getAction('chart.progress_note')
      expect(action).toBeDefined()
      expect(action!.id).toBe('chart.progress_note')
      expect(action!.atomic_action).toBe('chart')
      expect(action!.display_name).toBeDefined()
      expect(action!.description).toBeDefined()
      expect(action!.applicable_types).toBeDefined()
      expect(Array.isArray(action!.applicable_types)).toBe(true)
      expect(action!.governed_by).toBeDefined()
      expect(Array.isArray(action!.governed_by)).toBe(true)
      expect(action!.added_in).toBeDefined()
    })
  })

  describe('getProviderTypes()', () => {
    it('returns exactly 49 provider types', () => {
      const types = AxonTaxonomy.getProviderTypes()
      expect(types).toHaveLength(49)
    })

    it('each provider type has id, display_name, category, member_roles', () => {
      const types = AxonTaxonomy.getProviderTypes()
      for (const type of types) {
        expect(type.id).toBeDefined()
        expect(typeof type.id).toBe('string')
        expect(type.display_name).toBeDefined()
        expect(typeof type.display_name).toBe('string')
        expect(type.category).toBeDefined()
        expect(typeof type.category).toBe('string')
        expect(type.member_roles).toBeDefined()
        expect(Array.isArray(type.member_roles)).toBe(true)
      }
    })
  })

  describe('getProviderTypesByCategory()', () => {
    it('returns only types matching the given category', () => {
      const medicalTypes = AxonTaxonomy.getProviderTypesByCategory('medical')
      for (const type of medicalTypes) {
        expect(type.category).toBe('medical')
      }
    })

    it('returns empty array for unknown category', () => {
      expect(AxonTaxonomy.getProviderTypesByCategory('nonexistent')).toEqual(
        [],
      )
    })

    it('"medical" returns physician, advanced_practice_provider, nursing, nursing_support, pharmacy', () => {
      const medicalTypes = AxonTaxonomy.getProviderTypesByCategory('medical')
      const ids = medicalTypes.map((t) => t.id)
      expect(ids).toContain('physician')
      expect(ids).toContain('advanced_practice_provider')
      expect(ids).toContain('nursing')
      expect(ids).toContain('nursing_support')
      expect(ids).toContain('pharmacy')
    })
  })

  describe('getType()', () => {
    it('returns ProviderType for "physician"', () => {
      const type = AxonTaxonomy.getType('physician')
      expect(type).toBeDefined()
      expect(type!.id).toBe('physician')
      expect(type!.display_name).toBe('Physician')
      expect(type!.category).toBe('medical')
      expect(type!.member_roles).toContain('MD')
      expect(type!.member_roles).toContain('DO')
    })

    it('returns undefined for unknown type ID', () => {
      expect(AxonTaxonomy.getType('unknown_type')).toBeUndefined()
    })
  })

  describe('Physician action coverage', () => {
    it('physician has actions under all 7 atomic categories', () => {
      const actions = AxonTaxonomy.getActionsForType('physician')
      const coveredCategories = new Set<string>()
      for (const actionId of actions) {
        const action = AxonTaxonomy.getAction(actionId)
        if (action) {
          coveredCategories.add(action.atomic_action)
        }
      }
      for (const category of ATOMIC_ACTIONS) {
        expect(
          coveredCategories.has(category),
          `Physician should have actions in "${category}" category`,
        ).toBe(true)
      }
    })
  })
})
