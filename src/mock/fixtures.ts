/**
 * Pre-seeded realistic test fixtures for the mock Axon server.
 *
 * All NPI numbers pass the Luhn check algorithm with 80840 prefix.
 * Provider data is realistic but fictional -- for integration testing only.
 */

/** Shape of the mock fixture data for pre-seeding a MockAxonServer. */
export interface MockFixtures {
  organizations: Array<{
    organization_npi: string
    organization_name: string
    organization_type: string
    neuron_endpoint_url: string
  }>
  providers: Array<{
    npi: string
    name: string
    provider_type: string
    specialty: string
    organization_npi: string
    credentials: Array<{
      credential_type: 'license' | 'certification' | 'privilege'
      credential_id: string
      status: 'active' | 'pending' | 'expired' | 'suspended' | 'revoked'
      issuer: string
      issued_date: string
      expiry_date: string
    }>
  }>
}

/**
 * Default fixtures with 1 organization, 3 providers (2 active, 1 expired).
 *
 * NPI numbers verified against Luhn algorithm:
 * - Organization: 1245319599
 * - Dr. Sarah Chen: 1679576722
 * - Dr. James Wilson: 1376841239
 * - Dr. Robert Hayes (expired): 1003000126
 */
export const DEFAULT_FIXTURES: MockFixtures = {
  organizations: [
    {
      organization_npi: '1245319599',
      organization_name: 'Metro Health System',
      organization_type: 'health_system',
      neuron_endpoint_url: 'https://neuron.metrohealth.example.com/v1',
    },
  ],
  providers: [
    {
      npi: '1679576722',
      name: 'Dr. Sarah Chen',
      provider_type: 'physician',
      specialty: 'internal_medicine',
      organization_npi: '1245319599',
      credentials: [
        {
          credential_type: 'license',
          credential_id: 'MD-2021-44892',
          status: 'active',
          issuer: 'California Medical Board',
          issued_date: '2021-03-15',
          expiry_date: '2027-03-15',
        },
        {
          credential_type: 'certification',
          credential_id: 'ABIM-IM-78432',
          status: 'active',
          issuer: 'American Board of Internal Medicine',
          issued_date: '2020-06-01',
          expiry_date: '2030-06-01',
        },
      ],
    },
    {
      npi: '1376841239',
      name: 'Dr. James Wilson',
      provider_type: 'physician',
      specialty: 'surgery',
      organization_npi: '1245319599',
      credentials: [
        {
          credential_type: 'license',
          credential_id: 'MD-2019-31205',
          status: 'active',
          issuer: 'California Medical Board',
          issued_date: '2019-08-20',
          expiry_date: '2026-08-20',
        },
      ],
    },
    {
      npi: '1003000126',
      name: 'Dr. Robert Hayes',
      provider_type: 'physician',
      specialty: 'internal_medicine',
      organization_npi: '1245319599',
      credentials: [
        {
          credential_type: 'license',
          credential_id: 'MD-2015-10034',
          status: 'expired',
          issuer: 'California Medical Board',
          issued_date: '2015-01-10',
          expiry_date: '2023-01-10',
        },
      ],
    },
  ],
}
