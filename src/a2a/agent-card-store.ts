/**
 * Agent Card CRUD Store for the Axon A2A registry.
 *
 * Stores Agent Cards in memory with JSON file persistence.
 * Provides CRUD operations and discovery search with CareAgent-specific filters.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import type { AgentCard } from '@careagent/a2a-types'

/** Query filters for Agent Card discovery search. */
export interface AgentCardSearchQuery {
  /** Match against capabilities[].name */
  capability?: string
  /** Match against careagent.specialty (case-insensitive) */
  specialty?: string
  /** Match against careagent.location fields */
  location?: { state?: string; city?: string; zip?: string }
  /** Match against careagent.provider_type */
  provider_type?: string
  /** Match against provider.organization (case-insensitive substring) */
  organization?: string
  /** Maximum results to return (default 20, max 100) */
  limit?: number
  /** Offset for pagination (default 0) */
  offset?: number
}

/**
 * Persistent Agent Card store backed by a JSON file.
 *
 * Cards are keyed by their `id` field. All mutations are immediately
 * persisted to disk.
 */
export class AgentCardStore {
  private cards: Map<string, AgentCard>
  private readonly filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
    this.cards = this.load()
  }

  /**
   * Register a new Agent Card.
   *
   * @throws Error if a card with the same id already exists
   */
  register(card: AgentCard): void {
    if (this.cards.has(card.id)) {
      throw new Error(`Agent Card with id "${card.id}" already exists`)
    }
    this.cards.set(card.id, structuredClone(card))
    this.save()
  }

  /** Get an Agent Card by id. */
  get(id: string): AgentCard | undefined {
    const card = this.cards.get(id)
    return card !== undefined ? structuredClone(card) : undefined
  }

  /**
   * Update an existing Agent Card with partial fields.
   *
   * @throws Error if no card with the given id exists
   * @returns The updated Agent Card
   */
  update(id: string, partial: Partial<AgentCard>): AgentCard {
    const existing = this.cards.get(id)
    if (existing === undefined) {
      throw new Error(`Agent Card with id "${id}" not found`)
    }
    const updated: AgentCard = { ...existing, ...partial, id }
    this.cards.set(id, updated)
    this.save()
    return structuredClone(updated)
  }

  /**
   * Remove an Agent Card by id.
   *
   * @returns true if the card was found and removed, false otherwise
   */
  deregister(id: string): boolean {
    const deleted = this.cards.delete(id)
    if (deleted) {
      this.save()
    }
    return deleted
  }

  /**
   * Search for Agent Cards matching the given query filters.
   *
   * All filters are AND-combined. An empty query returns all cards.
   */
  search(query: AgentCardSearchQuery): AgentCard[] {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100)
    const offset = Math.max(query.offset ?? 0, 0)

    let results = [...this.cards.values()]

    if (query.capability !== undefined) {
      const cap = query.capability.toLowerCase()
      results = results.filter((card) =>
        card.capabilities.some((c) => c.name.toLowerCase() === cap),
      )
    }

    if (query.specialty !== undefined) {
      const spec = query.specialty.toLowerCase()
      results = results.filter(
        (card) =>
          card.careagent?.specialty !== undefined &&
          card.careagent.specialty.toLowerCase().includes(spec),
      )
    }

    if (query.location !== undefined) {
      const loc = query.location
      results = results.filter((card) => {
        const cardLoc = card.careagent?.location
        if (cardLoc === undefined) return false
        if (loc.state !== undefined && cardLoc.state?.toLowerCase() !== loc.state.toLowerCase()) {
          return false
        }
        if (loc.city !== undefined && cardLoc.city?.toLowerCase() !== loc.city.toLowerCase()) {
          return false
        }
        if (loc.zip !== undefined && cardLoc.zip !== loc.zip) {
          return false
        }
        return true
      })
    }

    if (query.provider_type !== undefined) {
      const pt = query.provider_type.toLowerCase()
      results = results.filter(
        (card) =>
          card.careagent?.provider_type !== undefined &&
          card.careagent.provider_type.toLowerCase() === pt,
      )
    }

    if (query.organization !== undefined) {
      const org = query.organization.toLowerCase()
      results = results.filter(
        (card) =>
          card.provider?.organization !== undefined &&
          card.provider.organization.toLowerCase().includes(org),
      )
    }

    return results.slice(offset, offset + limit).map((c) => structuredClone(c))
  }

  /** Return the total number of stored cards. */
  get size(): number {
    return this.cards.size
  }

  /** Persist cards to disk as JSON. */
  private save(): void {
    const entries = [...this.cards.entries()]
    const json = JSON.stringify(entries, null, 2)
    writeFileSync(this.filePath, json, 'utf-8')
  }

  /** Load cards from disk. Returns empty map if file does not exist. */
  private load(): Map<string, AgentCard> {
    if (!existsSync(this.filePath)) {
      return new Map()
    }
    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      const entries = JSON.parse(raw) as Array<[string, AgentCard]>
      return new Map(entries)
    } catch {
      return new Map()
    }
  }
}
