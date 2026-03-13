/**
 * CANS.md generator — takes questionnaire artifacts + NPI context and produces
 * a valid CANS.md document with YAML frontmatter and SHA-256 integrity hash.
 *
 * Axon is the authority for CANS generation. Provider-core consumes the result.
 */

import { createHash } from 'node:crypto'

export interface CANSGeneratorInput {
  /** Raw artifacts from form engine completion */
  artifacts: Record<string, unknown>
  /** Accumulated context (includes npi_lookup, npi_org_lookup, provider_type) */
  context: Record<string, unknown>
  /** All answers from the questionnaire */
  answers: Record<string, unknown>
}

export interface CANSGeneratorOutput {
  /** Complete CANS.md content (YAML frontmatter + markdown body) */
  content: string
  /** SHA-256 hex hash of the content */
  hash: string
  /** Parsed CANS document (for programmatic use) */
  document: Record<string, unknown>
}

export function generateCANS(input: CANSGeneratorInput): CANSGeneratorOutput {
  const { artifacts, context, answers } = input
  const npi = context.npi_lookup as Record<string, unknown> | undefined
  const orgNpi = context.npi_org_lookup as Record<string, unknown> | undefined
  const providerType = (context.provider_type as string) ?? 'unknown'

  // Build structured CANS document from artifacts + NPI data
  const provider = artifacts.provider as Record<string, unknown> ?? {}
  const scope = artifacts.scope as Record<string, unknown> ?? {}
  const autonomy = artifacts.autonomy as Record<string, unknown> ?? {}

  // Provider identity — merge questionnaire answers with NPI lookup
  const providerName = (provider.name as string)
    ?? (npi?.name as string)
    ?? 'Unknown Provider'

  const providerNpi = (provider.npi as string)
    ?? (npi?.npi as string)
    ?? (answers.individual_npi as string)

  const credential = npi?.credential as string | undefined
  const specialty = npi?.specialty as string | undefined

  // Licenses — build array from NPI lookup
  const licenses: string[] = []
  const npiLicenses = npi?.licenses as Array<Record<string, unknown>> | undefined
  if (npiLicenses) {
    for (const lic of npiLicenses) {
      licenses.push(`${lic.number}-${lic.state}`)
    }
  } else if (provider.licenses) {
    licenses.push(String(provider.licenses))
  }

  // Organizations — build from org NPI lookup
  const organizations: Array<Record<string, unknown>> = []
  if (orgNpi) {
    organizations.push({
      name: (orgNpi.organization_name as string) ?? (orgNpi.dba_name as string) ?? 'Unknown Organization',
      primary: true,
    })
  } else if (typeof provider.organizations === 'string') {
    organizations.push({ name: provider.organizations, primary: true })
  } else {
    organizations.push({ name: 'Unaffiliated', primary: true })
  }

  // Certifications
  const certifications: string[] = []
  if (provider.certifications) {
    certifications.push(String(provider.certifications))
  }

  // Subspecialties
  const subspecialties: string[] = []
  if (provider.subspecialties) {
    subspecialties.push(String(provider.subspecialties))
  }

  // Scope — permitted actions
  const permittedActions: string[] = []
  if (Array.isArray(scope.permitted_actions)) {
    permittedActions.push(...scope.permitted_actions.map(String))
  } else if (scope.permitted_actions === true) {
    // Default permitted actions based on provider type
    permittedActions.push('chart', 'order', 'charge', 'interpret', 'educate', 'coordinate')
  }

  // Autonomy — fill in perform:manual if missing (never delegable to AI)
  const autonomyDoc: Record<string, string> = {
    chart: (autonomy.chart as string) ?? 'supervised',
    order: (autonomy.order as string) ?? 'supervised',
    charge: (autonomy.charge as string) ?? 'supervised',
    perform: 'manual', // Always manual — perform is never delegable
    interpret: (autonomy.interpret as string) ?? 'supervised',
    educate: (autonomy.educate as string) ?? 'supervised',
    coordinate: (autonomy.coordinate as string) ?? 'supervised',
  }

  // Build the complete CANS document
  const document: Record<string, unknown> = {
    version: '2.0',
    provider: {
      name: providerName,
      npi: providerNpi,
      types: [capitalize(providerType)],
      degrees: credential ? [credential] : [],
      licenses,
      certifications,
      specialty: specialty ?? undefined,
      subspecialty: subspecialties[0] ?? undefined,
      organizations,
      credential_status: 'active',
      ...(provider.dea_number ? { dea_number: provider.dea_number } : {}),
    },
    scope: {
      permitted_actions: permittedActions,
    },
    autonomy: autonomyDoc,
    consent: {
      hipaa_warning_acknowledged: true,
      synthetic_data_only: true,
      audit_consent: true,
      acknowledged_at: new Date().toISOString(),
    },
    skills: {
      authorized: [],
    },
  }

  // Generate YAML frontmatter
  const yaml = toYAML(document, 0)
  const body = generateMarkdownBody(document)
  const content = `---\n${yaml}---\n\n${body}`

  const hash = createHash('sha256').update(content, 'utf-8').digest('hex')

  return { content, hash, document }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Simple YAML serializer (no dependencies) */
function toYAML(value: unknown, indent: number): string {
  const prefix = '  '.repeat(indent)

  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return `${value}`
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    // Check if it's an array of primitives or objects
    if (typeof value[0] === 'object' && value[0] !== null) {
      return '\n' + value.map((item) => {
        const inner = toYAMLObject(item as Record<string, unknown>, indent + 2)
        // First line gets the dash prefix
        const lines = inner.split('\n')
        return `${prefix}  - ${lines[0].trim()}\n${lines.slice(1).join('\n')}`
      }).join('\n')
    }
    return '\n' + value.map((item) => `${prefix}  - ${toYAML(item, 0)}`).join('\n')
  }

  if (typeof value === 'object') {
    return '\n' + toYAMLObject(value as Record<string, unknown>, indent + 1)
  }

  return String(value)
}

function toYAMLObject(obj: Record<string, unknown>, indent: number): string {
  const prefix = '  '.repeat(indent)
  const lines: string[] = []

  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue
    const yamlVal = toYAML(val, indent)
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      lines.push(`${prefix}${key}:${yamlVal}`)
    } else if (Array.isArray(val) && val.length > 0) {
      lines.push(`${prefix}${key}:${yamlVal}`)
    } else {
      lines.push(`${prefix}${key}: ${yamlVal}`)
    }
  }

  return lines.join('\n')
}

function generateMarkdownBody(doc: Record<string, unknown>): string {
  const provider = doc.provider as Record<string, unknown>
  const name = provider.name as string
  const types = (provider.types as string[]).join(', ')
  const specialty = provider.specialty as string | undefined
  const orgs = provider.organizations as Array<Record<string, unknown>>
  const orgName = orgs[0]?.name as string ?? 'Independent Practice'

  const lines = [
    '# Clinical Activation and Notification System',
    '',
    `This document configures the CareAgent clinical AI assistant for`,
    `${name}, a ${types.toLowerCase()}${specialty ? ` specializing in ${specialty.toLowerCase()}` : ''}`,
    `at ${orgName}.`,
    '',
    '## Provider Summary',
    '',
    `${types} with active credentials${specialty ? ` in ${specialty}` : ''}.`,
    `Credentialed via Axon registry on ${new Date().toISOString().split('T')[0]}.`,
  ]

  return lines.join('\n') + '\n'
}
