import { Type, type Static } from '@sinclair/typebox'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/** A single step in an onboarding flow. */
export const OnboardingFlowStepSchema = Type.Object({
  /** Questionnaire ID to fetch. May contain {{placeholder}} for dynamic resolution. */
  questionnaire_id: Type.String(),
  /** Human-readable label for this step. */
  label: Type.String(),
  /** If true, the answer to `routing_question_id` determines the next step's questionnaire. */
  routes_to_next: Type.Optional(Type.Boolean()),
  /** The question ID whose answer provides the routing value. */
  routing_question_id: Type.Optional(Type.String()),
})

/** An ordered onboarding flow — a sequence of questionnaire steps. */
export const OnboardingFlowSchema = Type.Object({
  /** Target type this flow applies to (e.g., 'provider'). */
  target_type: Type.String(),
  /** Ordered steps to execute. */
  steps: Type.Array(OnboardingFlowStepSchema),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OnboardingFlowStep = Static<typeof OnboardingFlowStepSchema>
export type OnboardingFlow = Static<typeof OnboardingFlowSchema>

// ---------------------------------------------------------------------------
// Flow definitions
// ---------------------------------------------------------------------------

/**
 * Get the onboarding flow for a given target type.
 *
 * Currently only 'provider' is supported. Returns undefined for unknown types.
 *
 * The provider flow has 3 steps:
 * 1. Universal consent (HIPAA, synthetic data, audit)
 * 2. Provider type selection (routes to next step)
 * 3. Type-specific questionnaire (resolved via {{provider_type}} placeholder)
 */
export function getOnboardingFlow(targetType: string): OnboardingFlow | undefined {
  if (targetType === 'provider') {
    return {
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
    }
  }

  return undefined
}
