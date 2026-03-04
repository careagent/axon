#!/usr/bin/env npx tsx
/**
 * Seed Supabase tables from local JSON data files.
 *
 * Reads all questionnaires, taxonomy, and onboarding flows from the data/
 * directory and upserts them into the corresponding Supabase tables.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/seed-supabase.ts
 *
 * Idempotent — safe to run multiple times (upserts on unique keys).
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSupabaseConfig, supabaseUpsert } from '../src/db/client.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

function main(): void {
  const config = getSupabaseConfig()
  if (!config) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set')
    process.exit(1)
  }

  console.log(`Seeding Supabase at ${config.url}...\n`)

  const tasks: Promise<void>[] = []

  // ─── 1. Questionnaires ──────────────────────────────────────────────────

  const questionnairesDir = resolve(ROOT, 'data', 'questionnaires')
  const files = readdirSync(questionnairesDir).filter((f) => f.endsWith('.json'))

  for (const file of files) {
    const providerType = basename(file, '.json')
    const data = JSON.parse(readFileSync(resolve(questionnairesDir, file), 'utf-8'))
    const isMeta = providerType.startsWith('_')

    tasks.push(
      supabaseUpsert(config, 'questionnaires', {
        provider_type: providerType,
        version: data.version ?? '1.0.0',
        display_name: data.display_name ?? providerType,
        is_meta: isMeta,
        data,
        updated_at: new Date().toISOString(),
      }, 'provider_type').then(() => {
        console.log(`  ✓ questionnaire: ${providerType}`)
      }),
    )
  }

  // ─── 2. Taxonomy ───────────────────────────────────────────────────────

  const taxonomyPath = resolve(ROOT, 'data', 'taxonomy', 'v1.0.0.json')
  const taxonomyData = JSON.parse(readFileSync(taxonomyPath, 'utf-8'))

  tasks.push(
    supabaseUpsert(config, 'taxonomy_versions', {
      version: taxonomyData.version ?? '1.0.0',
      effective_date: taxonomyData.effective_date ?? '2026-01-01',
      data: taxonomyData,
    }, 'version').then(() => {
      console.log(`  ✓ taxonomy: v${taxonomyData.version ?? '1.0.0'}`)
    }),
  )

  // ─── 3. Onboarding Flows ──────────────────────────────────────────────

  tasks.push(
    supabaseUpsert(config, 'onboarding_flows', {
      target_type: 'provider',
      steps: [
        {
          questionnaire_id: '_universal_consent',
          label: 'Consent',
        },
        {
          questionnaire_id: '_provider_type_selection',
          label: 'Provider Type',
          routes_to_next: true,
          routing_question_id: 'provider_type',
        },
        {
          questionnaire_id: '{{provider_type}}',
          label: 'Onboarding Questionnaire',
        },
      ],
      updated_at: new Date().toISOString(),
    }, 'target_type').then(() => {
      console.log(`  ✓ onboarding flow: provider`)
    }),
  )

  // ─── Run all ───────────────────────────────────────────────────────────

  Promise.all(tasks)
    .then(() => {
      console.log(`\nDone. Seeded ${tasks.length} records.`)
    })
    .catch((err) => {
      console.error('\nSeed failed:', err)
      process.exit(1)
    })
}

main()
