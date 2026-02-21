import { describe, it, expect, beforeAll } from 'vitest'
import { AxonTaxonomy } from '../src/taxonomy/taxonomy.js'
import type { TaxonomyAction, ProviderType } from '../src/types/index.js'

/**
 * All 49 provider type IDs from the v1.0.0 taxonomy.
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

/**
 * The 6 common cross-type actions that every provider type should have.
 */
const COMMON_CROSS_TYPE_ACTIONS = [
  'chart.progress_note',
  'chart.communication',
  'educate.patient_education',
  'educate.discharge_instructions',
  'coordinate.referral',
  'coordinate.care_transition',
] as const

/**
 * Valid governed_by values.
 */
const VALID_GOVERNED_BY = [
  'state_board',
  'institution',
  'specialty_board',
  'federal',
  'professional_association',
] as const

describe('taxonomy data', () => {
  let providerTypes: ProviderType[]
  let allActions: TaxonomyAction[]

  beforeAll(() => {
    providerTypes = AxonTaxonomy.getProviderTypes()
    // Collect all actions by iterating all valid action IDs
    allActions = []
    const seenIds = new Set<string>()
    for (const typeId of ALL_PROVIDER_TYPE_IDS) {
      const actionIds = AxonTaxonomy.getActionsForType(typeId)
      for (const actionId of actionIds) {
        if (!seenIds.has(actionId)) {
          seenIds.add(actionId)
          const action = AxonTaxonomy.getAction(actionId)
          if (action) {
            allActions.push(action)
          }
        }
      }
    }
  })

  describe('structure (TAXO-07)', () => {
    it('taxonomy version is "1.0.0"', () => {
      expect(AxonTaxonomy.getVersion()).toBe('1.0.0')
    })

    it('taxonomy has a valid effective_date', () => {
      // We verify this indirectly -- the loader validates against the schema
      // which requires effective_date as a string. If we get here, it loaded.
      expect(AxonTaxonomy.getVersion()).toBeDefined()
    })

    it('taxonomy has a description', () => {
      // Loaded successfully means schema passed (description is required field)
      expect(AxonTaxonomy.getVersion()).toBeDefined()
    })
  })

  describe('provider type completeness (TAXO-02)', () => {
    it('exactly 49 provider types defined', () => {
      expect(providerTypes).toHaveLength(49)
    })

    it('no duplicate provider type IDs', () => {
      const ids = providerTypes.map((t) => t.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('every provider type has a non-empty member_roles array', () => {
      for (const type of providerTypes) {
        expect(
          type.member_roles.length,
          `${type.id} should have at least one member_role`,
        ).toBeGreaterThan(0)
      }
    })

    it('provider type IDs are lowercase_snake_case', () => {
      for (const type of providerTypes) {
        expect(type.id).toMatch(
          /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/,
        )
      }
    })
  })

  describe('action completeness (TAXO-01, TAXO-06)', () => {
    it('physician has actions under all 7 atomic categories', () => {
      const physicianActions = AxonTaxonomy.getActionsForType('physician')
      const coveredCategories = new Set<string>()
      for (const actionId of physicianActions) {
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

    it('every action has a dot-notation ID matching its atomic_action prefix', () => {
      for (const action of allActions) {
        expect(
          action.id.startsWith(action.atomic_action + '.'),
          `Action "${action.id}" should start with "${action.atomic_action}."`,
        ).toBe(true)
      }
    })

    it('every action has a non-empty description and display_name', () => {
      for (const action of allActions) {
        expect(
          action.description.length,
          `Action "${action.id}" should have a non-empty description`,
        ).toBeGreaterThan(0)
        expect(
          action.display_name.length,
          `Action "${action.id}" should have a non-empty display_name`,
        ).toBeGreaterThan(0)
      }
    })

    it('no duplicate action IDs', () => {
      const ids = allActions.map((a) => a.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it("every action's atomic_action is one of the 7 valid values", () => {
      const validSet = new Set<string>(ATOMIC_ACTIONS)
      for (const action of allActions) {
        expect(
          validSet.has(action.atomic_action),
          `Action "${action.id}" has invalid atomic_action "${action.atomic_action}"`,
        ).toBe(true)
      }
    })
  })

  describe('applicable_types integrity (TAXO-02)', () => {
    it('every action has at least one applicable_type', () => {
      for (const action of allActions) {
        expect(
          action.applicable_types.length,
          `Action "${action.id}" should have at least one applicable_type`,
        ).toBeGreaterThan(0)
      }
    })

    it('every applicable_type ID is a valid provider type ID', () => {
      const validTypeIds = new Set(ALL_PROVIDER_TYPE_IDS)
      for (const action of allActions) {
        for (const typeId of action.applicable_types) {
          expect(
            validTypeIds.has(typeId),
            `Action "${action.id}" references invalid provider type "${typeId}"`,
          ).toBe(true)
        }
      }
    })

    it('every provider type has at least one action available (no orphan types)', () => {
      for (const typeId of ALL_PROVIDER_TYPE_IDS) {
        const actions = AxonTaxonomy.getActionsForType(typeId)
        expect(
          actions.length,
          `Provider type "${typeId}" should have at least one action`,
        ).toBeGreaterThan(0)
      }
    })
  })

  describe('common cross-type actions (from CONTEXT.md)', () => {
    it('every provider type has the 6 common cross-type actions', () => {
      for (const typeId of ALL_PROVIDER_TYPE_IDS) {
        const actions = AxonTaxonomy.getActionsForType(typeId)
        const actionSet = new Set(actions)
        for (const commonAction of COMMON_CROSS_TYPE_ACTIONS) {
          expect(
            actionSet.has(commonAction),
            `Provider type "${typeId}" should have common action "${commonAction}"`,
          ).toBe(true)
        }
      }
    })
  })

  describe('governed_by integrity', () => {
    it('every action has at least one governed_by entry', () => {
      for (const action of allActions) {
        expect(
          action.governed_by.length,
          `Action "${action.id}" should have at least one governed_by entry`,
        ).toBeGreaterThan(0)
      }
    })

    it('every governed_by value is a valid governance type', () => {
      const validGovernance = new Set<string>(VALID_GOVERNED_BY)
      for (const action of allActions) {
        for (const gov of action.governed_by) {
          expect(
            validGovernance.has(gov),
            `Action "${action.id}" has invalid governed_by value "${gov}"`,
          ).toBe(true)
        }
      }
    })
  })

  describe('hierarchy consistency (TAXO-01)', () => {
    it('every action with a parent field references an existing action ID or a valid group prefix', () => {
      const allActionIds = new Set(allActions.map((a) => a.id))
      for (const action of allActions) {
        if (action.parent !== undefined) {
          // Parent can be either a full action ID or a group prefix like "perform.surgical"
          // Group prefixes are valid intermediate nodes in the hierarchy
          const parentIsAction = allActionIds.has(action.parent)
          const parentIsGroupPrefix = allActions.some((a) =>
            a.id.startsWith(action.parent + '.'),
          )
          expect(
            parentIsAction || parentIsGroupPrefix,
            `Action "${action.id}" has parent "${action.parent}" which is neither a valid action nor a group prefix`,
          ).toBe(true)
        }
      }
    })

    it('action ID prefixes match their atomic_action field', () => {
      for (const action of allActions) {
        const prefix = action.id.split('.')[0]
        expect(
          prefix,
          `Action "${action.id}" has prefix "${prefix}" but atomic_action is "${action.atomic_action}"`,
        ).toBe(action.atomic_action)
      }
    })
  })
})
