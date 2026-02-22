import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'

import { AxonTaxonomy } from '../src/taxonomy/taxonomy.js'
import { AxonQuestionnaires } from '../src/questionnaires/questionnaires.js'
import { VALID_CANS_FIELDS } from '../src/questionnaires/cans-fields.js'

describe('Compatibility Matrix', () => {
  describe('Questionnaire-Taxonomy Cross-Validation', () => {
    it('every action_assignment references action IDs that exist in taxonomy', () => {
      const providerTypes = AxonTaxonomy.getProviderTypes()

      for (const type of providerTypes) {
        const questionnaire = AxonQuestionnaires.getForType(type.id)
        if (!questionnaire || questionnaire.questions.length === 0) continue

        for (const question of questionnaire.questions) {
          if (!question.action_assignments) continue

          for (const assignment of question.action_assignments) {
            for (const actionId of assignment.grants) {
              expect(
                AxonTaxonomy.validateAction(actionId),
                `Provider type "${type.id}", question "${question.id}": action_assignment grants non-existent action "${actionId}"`,
              ).toBe(true)
            }
          }
        }
      }
    })
  })

  describe('CANS Field Validation', () => {
    it('every questionnaire cans_field is in the VALID_CANS_FIELDS allowlist', () => {
      const providerTypes = AxonTaxonomy.getProviderTypes()

      for (const type of providerTypes) {
        const questionnaire = AxonQuestionnaires.getForType(type.id)
        if (!questionnaire || questionnaire.questions.length === 0) continue

        for (const question of questionnaire.questions) {
          if (question.cans_field !== undefined) {
            expect(
              VALID_CANS_FIELDS.has(question.cans_field),
              `Provider type "${type.id}": cans_field "${question.cans_field}" is not in VALID_CANS_FIELDS allowlist`,
            ).toBe(true)
          }
        }
      }
    })
  })

  describe('Entry Point API Surface Validation', () => {
    beforeAll(() => {
      if (!fs.existsSync('dist/index.js')) {
        throw new Error(
          'dist/ not found — run "pnpm build" before running tests',
        )
      }
    })

    it('main entry (.) exports the documented API surface', async () => {
      const main = await import('../dist/index.js')
      const exports = Object.keys(main)

      // Core classes and namespace
      expect(exports).toContain('Axon')
      expect(exports).toContain('AXON_VERSION')
      expect(exports).toContain('AxonRegistry')
      expect(exports).toContain('AxonBroker')
      expect(exports).toContain('AxonTaxonomy')
      expect(exports).toContain('AxonQuestionnaires')

      // Protocol utilities
      expect(exports).toContain('validateNPI')
      expect(exports).toContain('generateKeyPair')
      expect(exports).toContain('signPayload')
      expect(exports).toContain('verifySignature')
      expect(exports).toContain('generateNonce')
    })

    it('taxonomy entry (./taxonomy) exports taxonomy API but not AxonRegistry', async () => {
      const taxonomy = await import('../dist/taxonomy/index.js')
      const exports = Object.keys(taxonomy)

      expect(exports).toContain('AxonTaxonomy')
      expect(exports).toContain('loadTaxonomy')
      expect(exports).toContain('TaxonomyVersionSchema')

      // Must NOT export non-taxonomy classes
      expect(exports).not.toContain('AxonRegistry')
    })

    it('questionnaires entry (./questionnaires) exports questionnaire API but not AxonRegistry', async () => {
      const questionnaires = await import(
        '../dist/questionnaires/index.js'
      )
      const exports = Object.keys(questionnaires)

      expect(exports).toContain('AxonQuestionnaires')
      expect(exports).toContain('loadQuestionnaire')
      expect(exports).toContain('QuestionnaireSchema')

      // Must NOT export non-questionnaire classes
      expect(exports).not.toContain('AxonRegistry')
    })

    it('types entry (./types) exports schema types', async () => {
      const types = await import('../dist/types/index.js')
      const exports = Object.keys(types)

      // Schema presence validates type availability
      expect(exports).toContain('TaxonomyVersionSchema')
      expect(exports).toContain('QuestionnaireSchema')
      expect(exports).toContain('RegistryEntrySchema')
      expect(exports).toContain('ConnectRequestSchema')
    })

    it('mock entry (./mock) exports createMockAxonServer and DEFAULT_FIXTURES', async () => {
      const mock = await import('../dist/mock/index.js')
      const exports = Object.keys(mock)

      expect(exports).toContain('createMockAxonServer')
      expect(exports).toContain('DEFAULT_FIXTURES')
    })
  })
})
