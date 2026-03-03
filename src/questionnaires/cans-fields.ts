/**
 * CANS field path allowlist.
 *
 * Defines the valid field paths that Axon questionnaires can populate
 * in a provider's CANS (Competency, Autonomy, Navigation, Scope) schema.
 * This is the contract between Axon questionnaires and provider-core's
 * CANS data model -- any questionnaire question must map to one of these
 * paths via its `cans_field` property.
 *
 * Adding a new CANS field requires updating both this allowlist and the
 * provider-core CANS schema.
 */
export const VALID_CANS_FIELDS: Set<string> = new Set([
  'provider.npi',
  'provider.name',
  'provider.types',
  'provider.degrees',
  'provider.licenses',
  'provider.certifications',
  'provider.dea_number',
  'provider.specialties',
  'provider.subspecialties',
  'provider.organizations',
  'scope.permitted_actions',
  'scope.taxonomy_version',
  'scope.practice_setting',
  'scope.supervision_level',
  'autonomy.chart',
  'autonomy.order',
  'autonomy.charge',
  'autonomy.perform',
  'autonomy.interpret',
  'autonomy.educate',
  'autonomy.coordinate',
  'voice.chart',
  'voice.educate',
  'voice.interpret',
  'consent.hipaa_warning_acknowledged',
  'consent.synthetic_data_only',
  'consent.audit_consent',
  'skills.authorized',
])
