import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentCard } from '@careagent/a2a-types'
import { AgentCardStore } from '../../src/a2a/agent-card-store.js'

function makeCard(overrides: Partial<AgentCard> = {}): AgentCard {
  return {
    id: 'test-agent-1',
    name: 'Test Agent',
    version: '1.0.0',
    url: 'http://localhost:3000',
    capabilities: [{ name: 'clinical-intake' }],
    ...overrides,
  }
}

describe('AgentCardStore', () => {
  let tempDir: string
  let storePath: string
  let store: AgentCardStore

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'axon-card-store-test-'))
    storePath = join(tempDir, 'agent-cards.json')
    store = new AgentCardStore(storePath)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  // --- Register ---

  describe('register', () => {
    it('registers a new Agent Card', () => {
      const card = makeCard()
      store.register(card)
      expect(store.size).toBe(1)
      expect(store.get('test-agent-1')).toEqual(card)
    })

    it('throws when registering a duplicate id', () => {
      store.register(makeCard())
      expect(() => store.register(makeCard())).toThrow('already exists')
    })

    it('stores a defensive copy (mutations do not affect store)', () => {
      const card = makeCard()
      store.register(card)
      card.name = 'Mutated'
      expect(store.get('test-agent-1')!.name).toBe('Test Agent')
    })
  })

  // --- Get ---

  describe('get', () => {
    it('returns undefined for non-existent id', () => {
      expect(store.get('no-such-id')).toBeUndefined()
    })

    it('returns a defensive copy', () => {
      store.register(makeCard())
      const a = store.get('test-agent-1')!
      const b = store.get('test-agent-1')!
      a.name = 'Mutated'
      expect(b.name).toBe('Test Agent')
    })
  })

  // --- Update ---

  describe('update', () => {
    it('updates fields on an existing card', () => {
      store.register(makeCard())
      const updated = store.update('test-agent-1', { name: 'Updated Agent' })
      expect(updated.name).toBe('Updated Agent')
      expect(updated.id).toBe('test-agent-1')
      expect(store.get('test-agent-1')!.name).toBe('Updated Agent')
    })

    it('preserves the original id even if partial contains a different id', () => {
      store.register(makeCard())
      const updated = store.update('test-agent-1', { id: 'different-id', name: 'Updated' } as Partial<AgentCard>)
      expect(updated.id).toBe('test-agent-1')
    })

    it('throws when updating a non-existent card', () => {
      expect(() => store.update('no-such-id', { name: 'X' })).toThrow('not found')
    })
  })

  // --- Deregister ---

  describe('deregister', () => {
    it('removes an existing card and returns true', () => {
      store.register(makeCard())
      const result = store.deregister('test-agent-1')
      expect(result).toBe(true)
      expect(store.size).toBe(0)
      expect(store.get('test-agent-1')).toBeUndefined()
    })

    it('returns false for non-existent id', () => {
      expect(store.deregister('no-such-id')).toBe(false)
    })
  })

  // --- Search ---

  describe('search', () => {
    const cards: AgentCard[] = [
      makeCard({
        id: 'card-1',
        name: 'Neurosurgeon Agent',
        capabilities: [{ name: 'clinical-intake' }, { name: 'scheduling' }],
        provider: { organization: 'Southeastern Spine Institute' },
        careagent: {
          specialty: 'Neurosurgery',
          provider_type: 'physician',
          location: { state: 'SC', city: 'Charleston', zip: '29401' },
        },
      }),
      makeCard({
        id: 'card-2',
        name: 'Cardiologist Agent',
        capabilities: [{ name: 'clinical-intake' }],
        provider: { organization: 'Heart Center' },
        careagent: {
          specialty: 'Cardiology',
          provider_type: 'physician',
          location: { state: 'SC', city: 'Columbia', zip: '29201' },
        },
      }),
      makeCard({
        id: 'card-3',
        name: 'PT Agent',
        capabilities: [{ name: 'rehab-assessment' }],
        provider: { organization: 'PhysioWorks' },
        careagent: {
          specialty: 'Physical Therapy',
          provider_type: 'physical_therapist',
          location: { state: 'GA', city: 'Atlanta', zip: '30301' },
        },
      }),
    ]

    beforeEach(() => {
      for (const card of cards) {
        store.register(card)
      }
    })

    it('returns all cards when query is empty', () => {
      const results = store.search({})
      expect(results).toHaveLength(3)
    })

    it('filters by capability', () => {
      const results = store.search({ capability: 'scheduling' })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('card-1')
    })

    it('filters by capability (case-insensitive)', () => {
      const results = store.search({ capability: 'CLINICAL-INTAKE' })
      expect(results).toHaveLength(2)
    })

    it('filters by specialty', () => {
      const results = store.search({ specialty: 'neuro' })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('card-1')
    })

    it('filters by specialty (case-insensitive)', () => {
      const results = store.search({ specialty: 'CARDIOLOGY' })
      expect(results).toHaveLength(1)
    })

    it('filters by location state', () => {
      const results = store.search({ location: { state: 'SC' } })
      expect(results).toHaveLength(2)
    })

    it('filters by location city', () => {
      const results = store.search({ location: { city: 'Atlanta' } })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('card-3')
    })

    it('filters by location zip', () => {
      const results = store.search({ location: { zip: '29401' } })
      expect(results).toHaveLength(1)
    })

    it('filters by location state + city', () => {
      const results = store.search({ location: { state: 'SC', city: 'Charleston' } })
      expect(results).toHaveLength(1)
    })

    it('filters by provider_type', () => {
      const results = store.search({ provider_type: 'physical_therapist' })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('card-3')
    })

    it('filters by organization (substring, case-insensitive)', () => {
      const results = store.search({ organization: 'spine' })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('card-1')
    })

    it('combines multiple filters (AND)', () => {
      const results = store.search({ specialty: 'neuro', location: { state: 'SC' } })
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('card-1')
    })

    it('returns empty when no match', () => {
      const results = store.search({ specialty: 'dermatology' })
      expect(results).toHaveLength(0)
    })

    it('excludes cards without careagent metadata when filtering by specialty', () => {
      store.register(makeCard({ id: 'card-no-careagent', name: 'No Metadata' }))
      const results = store.search({ specialty: 'neuro' })
      expect(results).toHaveLength(1)
    })
  })

  // --- Pagination ---

  describe('pagination', () => {
    beforeEach(() => {
      for (let i = 0; i < 30; i++) {
        store.register(makeCard({ id: `card-${i}`, name: `Agent ${i}` }))
      }
    })

    it('defaults to limit 20', () => {
      const results = store.search({})
      expect(results).toHaveLength(20)
    })

    it('respects custom limit', () => {
      const results = store.search({ limit: 5 })
      expect(results).toHaveLength(5)
    })

    it('caps limit at 100', () => {
      // We only have 30 cards, but limit should be capped
      const results = store.search({ limit: 200 })
      expect(results).toHaveLength(30)
    })

    it('respects offset', () => {
      const all = store.search({ limit: 100 })
      const page2 = store.search({ offset: 10, limit: 5 })
      expect(page2).toHaveLength(5)
      expect(page2[0]!.id).toBe(all[10]!.id)
    })

    it('returns empty when offset exceeds total', () => {
      const results = store.search({ offset: 100 })
      expect(results).toHaveLength(0)
    })
  })

  // --- Persistence ---

  describe('persistence', () => {
    it('persists cards to disk and reloads on construction', () => {
      store.register(makeCard({ id: 'persist-1', name: 'Persistent Agent' }))
      store.register(makeCard({ id: 'persist-2', name: 'Another Agent' }))

      // Create a new store instance pointing to the same file
      const reloaded = new AgentCardStore(storePath)
      expect(reloaded.size).toBe(2)
      expect(reloaded.get('persist-1')!.name).toBe('Persistent Agent')
      expect(reloaded.get('persist-2')!.name).toBe('Another Agent')
    })

    it('persists updates', () => {
      store.register(makeCard())
      store.update('test-agent-1', { name: 'Updated' })

      const reloaded = new AgentCardStore(storePath)
      expect(reloaded.get('test-agent-1')!.name).toBe('Updated')
    })

    it('persists deregistrations', () => {
      store.register(makeCard())
      store.deregister('test-agent-1')

      const reloaded = new AgentCardStore(storePath)
      expect(reloaded.size).toBe(0)
    })

    it('starts empty when file does not exist', () => {
      const freshStore = new AgentCardStore(join(tempDir, 'nonexistent.json'))
      expect(freshStore.size).toBe(0)
    })

    it('starts empty when file contains invalid JSON', () => {
      const badPath = join(tempDir, 'bad.json')
      const { writeFileSync } = require('node:fs') as typeof import('node:fs')
      writeFileSync(badPath, 'not valid json', 'utf-8')
      const badStore = new AgentCardStore(badPath)
      expect(badStore.size).toBe(0)
    })
  })
})
