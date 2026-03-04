/**
 * Supabase Edge Function: NPI Lookup
 *
 * Proxies NPI lookups to the CMS NPPES registry and returns a normalized
 * response. Deployed as a Supabase Edge Function (Deno runtime).
 *
 * Query params:
 *   ?npi=1234567893
 *
 * Responses:
 *   200 — normalized provider identity
 *   400 — invalid NPI format
 *   404 — no NPPES record found
 *   502 — NPPES registry unreachable
 */

// @ts-nocheck — Deno types not available in Node TypeScript context

Deno.serve(async (req: Request) => {
  // CORS headers for browser clients
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: corsHeaders },
    )
  }

  const url = new URL(req.url)
  const npi = url.searchParams.get('npi')

  if (!npi || !/^\d{10}$/.test(npi)) {
    return Response.json(
      { error: 'NPI must be exactly 10 digits' },
      { status: 400, headers: corsHeaders },
    )
  }

  try {
    const nppesUrl = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`
    const nppesRes = await fetch(nppesUrl, {
      signal: AbortSignal.timeout(10_000),
    })

    if (!nppesRes.ok) {
      return Response.json(
        { error: 'NPPES registry returned an error' },
        { status: 502, headers: corsHeaders },
      )
    }

    const nppesData = await nppesRes.json()

    if (
      !nppesData.result_count ||
      nppesData.result_count === 0 ||
      !nppesData.results?.[0]
    ) {
      return Response.json(
        { error: `No NPPES record found for NPI: ${npi}` },
        { status: 404, headers: corsHeaders },
      )
    }

    const result = nppesData.results[0]
    const basic = result.basic ?? {}
    const enumerationType =
      result.enumeration_type === 'NPI-1' ? 'NPI-1' : 'NPI-2'
    const primaryTaxonomy =
      result.taxonomies?.find((t: Record<string, unknown>) => t.primary) ??
      result.taxonomies?.[0]
    const practiceAddress = result.addresses?.find(
      (a: Record<string, unknown>) => a.address_purpose === 'LOCATION',
    )

    // Build normalized response
    const response: Record<string, unknown> = {
      npi,
      enumeration_type: enumerationType,
      status:
        basic.status === 'A' ? 'active' : basic.status ?? 'unknown',
    }

    if (enumerationType === 'NPI-1') {
      // Individual provider
      const nameParts: string[] = []
      if (basic.name_prefix) nameParts.push(basic.name_prefix)
      if (basic.first_name) nameParts.push(basic.first_name)
      if (basic.middle_name) nameParts.push(basic.middle_name)
      if (basic.last_name) nameParts.push(basic.last_name)
      let displayName = nameParts.join(' ')
      if (basic.credential) displayName += `, ${basic.credential}`

      response.name = displayName
      response.first_name = basic.first_name ?? ''
      response.last_name = basic.last_name ?? ''
      response.credential = basic.credential ?? undefined
    } else {
      // Organization
      response.organization_name = basic.organization_name ?? 'Unknown Organization'
      response.name = basic.organization_name ?? 'Unknown Organization'

      // DBA name from other_names
      const dba = (result.other_names ?? []).find(
        (n: Record<string, unknown>) => n.type === 'Doing Business As',
      )
      response.dba_name = dba?.organization_name ?? undefined

      // Authorized official
      if (basic.authorized_official_first_name || basic.authorized_official_last_name) {
        response.authorized_official = {
          first_name: basic.authorized_official_first_name ?? undefined,
          last_name: basic.authorized_official_last_name ?? undefined,
          title: basic.authorized_official_title_or_position ?? undefined,
          telephone: basic.authorized_official_telephone_number ?? undefined,
        }
      }

      response.organizational_subpart = basic.organizational_subpart ?? undefined
      response.certification_date = basic.certification_date ?? undefined
    }

    // All taxonomies
    const allTaxonomies = (result.taxonomies ?? []).map(
      (t: Record<string, unknown>) => ({
        code: t.code ?? undefined,
        desc: t.desc ?? undefined,
        primary: t.primary ?? false,
        state: t.state ?? undefined,
        license: t.license ?? undefined,
        taxonomy_group: t.taxonomy_group ?? undefined,
      }),
    )
    if (allTaxonomies.length > 0) {
      response.taxonomies = allTaxonomies
    }

    if (primaryTaxonomy) {
      response.specialty = primaryTaxonomy.desc ?? undefined
      response.taxonomy_code = primaryTaxonomy.code ?? undefined
      response.license_state = primaryTaxonomy.state ?? undefined
      response.license_number = primaryTaxonomy.license ?? undefined
    }

    // All licenses from all taxonomy entries
    const allLicenses = (result.taxonomies ?? [])
      .filter((t: Record<string, unknown>) => t.state && t.license)
      .map((t: Record<string, string | boolean | undefined>) => ({
        state: t.state!,
        number: t.license!,
        specialty: t.desc ?? undefined,
        taxonomy_code: t.code ?? undefined,
        primary: t.primary ?? false,
      }))
    if (allLicenses.length > 0) {
      response.licenses = allLicenses
    }

    // Primary address
    if (practiceAddress) {
      response.practice_state = practiceAddress.state ?? undefined
      response.practice_city = practiceAddress.city ?? undefined
      response.practice_address = {
        address_1: practiceAddress.address_1 ?? undefined,
        city: practiceAddress.city ?? undefined,
        state: practiceAddress.state ?? undefined,
        postal_code: practiceAddress.postal_code ?? undefined,
        telephone: practiceAddress.telephone_number ?? undefined,
        fax: practiceAddress.fax_number ?? undefined,
      }
    }

    // Mailing address
    const mailingAddress = result.addresses?.find(
      (a: Record<string, unknown>) => a.address_purpose === 'MAILING',
    )
    if (mailingAddress) {
      response.mailing_address = {
        address_1: mailingAddress.address_1 ?? undefined,
        city: mailingAddress.city ?? undefined,
        state: mailingAddress.state ?? undefined,
        postal_code: mailingAddress.postal_code ?? undefined,
      }
    }

    // Additional practice locations (NPI-2 only)
    const practiceLocations = (result.practiceLocations ?? []).map(
      (loc: Record<string, unknown>) => ({
        address_1: loc.address_1 ?? undefined,
        city: loc.city ?? undefined,
        state: loc.state ?? undefined,
        postal_code: loc.postal_code ?? undefined,
        telephone: loc.telephone_number ?? undefined,
        fax: loc.fax_number ?? undefined,
      }),
    )
    if (practiceLocations.length > 0) {
      response.practice_locations = practiceLocations
    }

    return Response.json(response, { status: 200, headers: corsHeaders })
  } catch {
    return Response.json(
      { error: 'Failed to reach NPPES registry' },
      { status: 502, headers: corsHeaders },
    )
  }
})
