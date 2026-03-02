# CareAgent Interaction Protocol — Design Document

> Date: 2026-03-02
> Status: Draft
> Scope: Ecosystem-wide communication protocol for structured agent interactions

---

## Problem Statement

CareAgent entities (Axon, provider agents, patient agents) need to conduct structured interactions with each other and with humans. These interactions range from provider credentialing to clinical symptom evaluation to consent collection. The current approach — an LLM agent freestyling through a markdown script — is unreliable because it conflates two concerns: natural conversation and deterministic data collection.

We need a protocol that is native to CareAgent, not piggybacked on consumer messaging platforms, and that works for every structured interaction in the system.

---

## Core Insight

### Agents Talking to Agents

The CareAgent ecosystem is, at its foundation, **agents having conversations with other agents** — with humans in the loop where decisions require them. Every entity in the system is an agent:

- **Axon** is an agent. It represents the collective authority of medical boards, specialty societies, CMS, the FDA, and other governing bodies. It has conversations with provider agents and patient agents about credentialing, compliance, and protocol governance.
- **Provider agents** are agents. They represent individual clinicians, shaped by that clinician's specialty, voice, and preferences. They have conversations with Axon (credentialing), with patient agents (clinical care), and with their human principal (configuration, approval).
- **Patient agents** are agents. They represent individual patients, governed by the patient's consent posture and autonomy preferences. They have conversations with provider agents (receiving care), with Axon (enrollment), and with their human principal (decisions, education).

The protocol we are designing governs **all of these conversations** uniformly. The same interaction primitives that Axon uses to credential a provider are the ones a provider agent uses to evaluate a patient's symptoms.

### The Structured Interaction Primitive

The structured questionnaire is the fundamental interaction primitive of clinical medicine. Differential diagnosis, clinical intake, consent collection, credentialing, medication reconciliation — all follow the same pattern:

1. An authority asks a question
2. The respondent provides an answer
3. The answer is validated
4. The next question is determined (conditional logic)
5. A verifiable artifact is produced from the collected answers

This same pattern appears at every level of the agent hierarchy:

| Interaction | Questioner Agent | Respondent Agent | Human in Loop | Artifact |
|---|---|---|---|---|
| Provider credentialing | Axon | Provider agent | Provider | CANS.md |
| Patient clinical intake | Provider agent | Patient agent | Patient | Intake record in patient chart |
| Consent collection | Provider agent | Patient agent | Patient | Consent token |
| Symptom evaluation | Provider agent | Patient agent | Patient | Clinical assessment |
| Patient enrollment | Axon / Patient agent | Patient agent | Patient | Patient CANS.md |

---

## Design Principles

### 1. LLM for conversation, code for validation

The LLM conducts the interaction naturally — warm, professional, adaptive. But every answer that matters is captured as a **JSON structured output** conforming to a schema defined by the authority. Validation is deterministic, performed by code, never by the LLM.

If validation fails, the LLM is prompted to re-ask or clarify. The final artifact is assembled from validated structured outputs, not from free-text LLM interpretation.

### 2. Data sovereignty

Clinical conversations and their outputs belong in the patient's encrypted chart vault — not on Telegram's servers, not in OpenClaw's session logs, not anywhere else. The protocol must be transport-independent, but the reference implementation uses CareAgent-native channels where all data flows to the chart.

For developer environments with synthetic data, third-party transports (Telegram, etc.) may be used as a convenience, but the architecture must not depend on them.

### 3. Classification-aware

Every question/answer exchange carries classification metadata along two axes:

**Domain:**
- **Clinical** — directly related to patient care (symptoms, medications, diagnoses, consent for treatment)
- **Administrative** — necessary for system function but not clinical care (credentialing, scheduling, preferences)

**Sensitivity:**
- **Sensitive** — PHI, PII, credentials, financial information
- **Non-sensitive** — general preferences, provider type, practice philosophy

These classifications drive storage, transport, retention, and access decisions:

| | Sensitive | Non-sensitive |
|---|---|---|
| **Clinical** | Encrypted in vault, append-only, patient-controlled access | Encrypted in vault, append-only |
| **Administrative** | Encrypted at rest, access-controlled | May be stored in plaintext (e.g., CANS.md autonomy tiers) |

### 4. No data stored on third-party platforms

In production, all interaction data — questions asked, answers given, artifacts produced — is stored exclusively within the CareAgent ecosystem (patient chart vault, provider workspace, Axon registry). Third-party messaging platforms are display-only transports at most.

---

## Interaction Modes

Not all interactions are rigid questionnaires. The protocol supports a spectrum of modes, and a single interaction may transition between them:

### Structured Mode

Strict questionnaire. Defined questions, validated answers, conditional branching. The authority controls the flow completely.

**Used for:** Credentialing, consent, medication reconciliation, any interaction where the requirements are well-defined and the stakes are highest.

**Properties:**
- Questions defined in advance by the authority
- Each answer validated against a JSON schema
- Conditional logic determines the next question (`show_when` rules)
- No improvisation — the LLM presents questions as specified
- Produces a deterministic structured output

### Guided Mode

The authority sets the topic, boundaries, and expected outcome. The LLM has latitude in how it reaches the goal — it can follow up on unexpected responses, rephrase for clarity, explore relevant tangents — but it must produce a specific structured output at the end.

**Used for:** Symptom evaluation, clinical philosophy discussion, care planning, any interaction where clinical judgment and adaptability matter.

**Properties:**
- Authority defines the goal and the output schema
- LLM conducts the conversation with professional judgment
- Guardrails prevent deviation beyond the defined topic/scope
- Must still produce a validated structured output
- The authority can define "must-collect" fields that are required regardless of conversational path

### Open Mode

Conversational within guardrails. The LLM engages naturally, but hard boundaries remain in effect (scope of practice, no PHI leakage, no unauthorized actions).

**Used for:** Patient education, general questions, advocacy, relationship building.

**Properties:**
- No predefined output schema required (though one may be optionally defined)
- Agent's hardening layers still fully active
- CANS.md constraints still enforced
- Audit logging still captures the interaction
- The interaction may escalate to Guided or Structured mode if the conversation enters territory that requires it

### Mode Transitions

A single interaction can move between modes. Example — a symptom evaluation:

1. **Structured**: Chief complaint, vital signs, allergies (required fields, validated)
2. **Guided**: "Tell me more about the pain" — LLM explores with follow-ups
3. **Structured**: Confirm assessment, document plan, collect consent for treatment
4. **Open**: "Do you have any other questions?" — patient asks about recovery

Transitions are triggered by the authority's interaction definition, not by the LLM deciding to switch modes.

---

## Questionnaire Schema

The structured interaction primitive. This is an evolution of what already exists in Axon's `data/questionnaires/` directory.

### Question Definition

```
{
  "id": "string — unique within the questionnaire",
  "text": "string — the question as presented to the human",
  "llm_guidance": "string — optional instructions for the LLM on how to present this question",
  "answer_type": "boolean | single_select | multi_select | text | number | date",
  "required": "boolean",
  "classification": {
    "domain": "clinical | administrative",
    "sensitivity": "sensitive | non_sensitive"
  },
  "validation": {
    "pattern": "regex — for text answers",
    "min_length": "number",
    "max_length": "number",
    "min": "number — for numeric answers",
    "max": "number",
    "options": "array — for select types"
  },
  "show_when": {
    "question_id": "string — the question this depends on",
    "operator": "equals | not_equals | contains | greater_than | less_than",
    "value": "the value to compare against"
  },
  "npi_prefill": "string — key for NPI lookup auto-fill",
  "npi_lookup": "boolean — trigger NPI lookup on this answer",
  "cans_field": "string — maps this answer to a CANS.md field path",
  "action_assignments": "array — maps answers to permitted actions (for scope questions)",
  "mode": "structured | guided — default structured"
}
```

### Questionnaire Definition

```
{
  "id": "string — e.g., 'physician-credentialing-v1'",
  "version": "semver",
  "display_name": "string",
  "authority": "string — who authored this (e.g., 'axon:medical-board-composite')",
  "description": "string",
  "target_type": "string — e.g., 'physician', 'patient', 'nurse_practitioner'",
  "classification": {
    "domain": "clinical | administrative",
    "sensitivity": "sensitive | non_sensitive"
  },
  "output_schema": "JSON Schema — what the completed questionnaire produces",
  "output_artifact": "string — what gets created (e.g., 'cans.md', 'consent_token', 'intake_record')",
  "questions": "array of Question Definitions",
  "sections": "array — optional grouping of questions into named stages",
  "llm_system_prompt": "string — system-level instructions for the LLM conducting this interaction",
  "completion_criteria": "object — what must be true for the questionnaire to be considered complete"
}
```

### Interaction Session

When a questionnaire is being executed, the session tracks state:

```
{
  "session_id": "UUIDv7",
  "questionnaire_id": "string",
  "questionnaire_version": "semver",
  "authority": "string — who initiated this",
  "respondent": "string — who is answering",
  "human_principal": "string — the human behind the responding agent",
  "started_at": "ISO 8601",
  "current_question_id": "string",
  "answers": {
    "<question_id>": {
      "value": "the validated answer",
      "raw_input": "what the human actually said",
      "validated_at": "ISO 8601",
      "classification": { "domain": "...", "sensitivity": "..." }
    }
  },
  "mode": "structured | guided | open",
  "status": "in_progress | complete | abandoned | failed",
  "completed_at": "ISO 8601 | null",
  "output": "the produced artifact, once complete"
}
```

---

## How It Works — Provider Onboarding Example

Applying this protocol to the immediate problem:

1. **Provider sends `/careagent_on`** (or equivalent in future native UI)

2. **Provider agent contacts Axon**: "I need to credential a physician"

3. **Axon returns the physician credentialing questionnaire** — a full Questionnaire Definition with questions, validation rules, conditional logic, output schema, and LLM system prompt

4. **Provider agent's LLM receives the questionnaire** as structured context:
   - System prompt from the questionnaire (tone, rules, constraints)
   - Current question to present
   - Validation rules for the expected answer
   - The LLM's job: present the question naturally, collect the answer, return it as a JSON structured output

5. **Each answer is validated by code**, not by the LLM:
   - Schema validation (type, pattern, required fields)
   - Business logic validation (NPI Luhn check, license format)
   - If invalid → LLM is prompted to re-ask with the validation error as context

6. **Conditional logic determines the next question** — evaluated by code, not by the LLM

7. **When all required questions are answered**, the validated answers are assembled into CANS.md by code using the output schema — not by asking the LLM to write YAML

8. **The completed CANS.md is signed and stored** with integrity sidecar

9. **The interaction session is logged** to the audit trail

---

## System Architecture

### Two Communication Layers

The system has two distinct communication layers that must not be conflated:

**Layer 1: Agent-to-Agent (Protocol Layer)**

Direct communication between CareAgent entities over WebSocket connections (brokered by Neuron). This is where the protocol engine lives. Axon's credentialing agent talks to the provider's protocol engine. The provider's protocol engine talks to the patient's protocol engine. This layer is fully controlled by CareAgent — structured, deterministic, audited.

**Layer 2: Agent-to-Human (Interface Layer)**

How a human sees what their agent is doing and provides input. For the dev environment, this is OpenClaw + Telegram. In the future, it could be a native UI, a CLI, a web app, or any other interface. This layer is a display/input transport only — it does not drive the protocol.

```
┌─────────────────────────────────────────────────────────┐
│                    PROTOCOL LAYER                        │
│                                                         │
│  Axon Agent ←──WebSocket──→ Provider Protocol Engine    │
│                             Provider Protocol Engine ←──WebSocket──→ Patient Protocol Engine
│                                                         │
│  (Questionnaire execution, validation, session state,   │
│   artifact generation — all deterministic, all code)    │
└────────────────────┬────────────────────┬───────────────┘
                     │                    │
              ┌──────┴──────┐      ┌──────┴──────┐
              │  INTERFACE  │      │  INTERFACE  │
              │   LAYER     │      │   LAYER     │
              │             │      │             │
              │ OpenClaw ←→ │      │ OpenClaw ←→ │
              │ Telegram    │      │ Telegram    │
              │ (provider)  │      │ (patient)   │
              └─────────────┘      └─────────────┘
```

### Direct LLM Access (CareAgent Controls the Prompt)

The protocol engine makes its own LLM API calls directly. It does not delegate to OpenClaw's agent loop. This is critical.

**Why:** When CareAgent ran inside OpenClaw's agent loop (the approach that broke), the LLM received OpenClaw's system prompt, scaffolded workspace files (AGENTS.md, USER.md, TOOLS.md), session history, and CareAgent's instructions — all competing for the LLM's attention. The LLM tried to reconcile two masters and went off-script.

**Now:** The protocol engine constructs the exact prompt it needs:
- System instructions from the questionnaire definition (tone, rules, constraints)
- The current question to present
- Validation rules and expected output schema
- Conversation history (only what CareAgent has tracked)
- Zero contamination from OpenClaw's context

The protocol engine reuses the same LLM API key and model configured in OpenClaw — no separate credentials needed. But it makes its own API calls, constructs its own prompts, and requests its own structured outputs.

**OpenClaw's role reduces to message bus:**
- Receives messages from Telegram → forwards to the protocol engine
- Receives responses from the protocol engine → sends to Telegram
- Provides API key / model configuration (reused, not duplicated)

**OpenClaw does NOT:**
- Construct LLM prompts
- Manage conversation context
- Scaffold workspace files for CareAgent
- Run its own agent loop for CareAgent interactions

### CareAgent as Sub-Agent (Not Replacement)

CareAgent — whether provider or patient — is a **specialized sub-agent** within the user's personal agent ecosystem. It does not replace the user's personal agent.

A patient who uses OpenClaw as their personal assistant keeps using it for everything else. CareAgent lives alongside it as a clinical specialist. The patient doesn't have to choose between their personal agent and their health agent — CareAgent activates when clinical interactions are needed and defers to the personal agent for everything else.

This also means CareAgent must work standalone. A patient who doesn't use OpenClaw (or any agent platform) can run CareAgent directly on their device. The protocol engine doesn't depend on OpenClaw — it uses OpenClaw as a convenient transport when available.

Provider-core and patient-core already support both modes via their OpenClaw and standalone adapters. This architecture formalizes that: the protocol engine is the core, and the adapters (OpenClaw, standalone, future native UI) are interchangeable interface layers.

---

## What This Replaces

### The BOOTSTRAP.md approach (what broke)

Instead of giving OpenClaw's LLM a giant markdown document and hoping it follows the script alongside competing instructions, the protocol engine makes its own LLM calls with exactly the context it needs. One question at a time. Structured output requested. Validated by code. No competing prompts.

### OpenClaw as agent runtime

OpenClaw is no longer running CareAgent's agent loop. It's a message bus between Telegram and the protocol engine. CareAgent controls its own LLM relationship entirely.

### The two-approach split

The programmatic InterviewIO engine (Approach A) and the LLM-driven BOOTSTRAP.md (Approach B) merge into a single approach: **code drives the flow, LLM provides the conversational interface via direct API calls.** The InterviewIO abstraction was close to right — it now becomes the bridge between the protocol engine and the LLM, rather than between the protocol engine and raw terminal prompts.

---

## Protocol Ownership vs. Questionnaire Ownership

The protocol itself — the rules of engagement, schema definitions, validation logic, interaction modes — lives on Axon. Axon is the authority on *how* agents communicate. This is analogous to how standards bodies define communication protocols, not the content that flows over them.

Questionnaires — specific instances of the protocol applied to a purpose — are distributed across the ecosystem. Different agents author and own different questionnaires:

### Axon-Authored Questionnaires

Credentialing, regulatory compliance, enrollment — anything that governing bodies define. These are canonical and immutable per version. A provider agent fetches them from Axon and executes them as-is. No modifications permitted.

Examples: physician credentialing questionnaire, nurse practitioner scope assessment, DEA eligibility verification.

### Provider-Authored Questionnaires

Clinical intake forms, symptom evaluation trees, follow-up protocols, consent workflows. These live in the provider agent's workspace and are shaped by that provider's specialty, clinical approach, and learned preferences.

A cardiologist's intake questionnaire looks different from a psychiatrist's. As the provider agent learns the provider's voice through the refinement engine, its guided-mode interactions improve — the agent understands how *this particular doctor* approaches differential diagnosis, what follow-up questions they always ask, how they explain things to patients. Over time, the provider's questionnaires evolve to reflect their clinical style.

Examples: new patient intake, post-surgical follow-up, symptom triage, medication review.

### Patient-Authored Questionnaires

Down the road, patient agents may define their own structured interactions — medication reminders, symptom tracking logs, pre-appointment preparation checklists. These would live in the patient agent's workspace.

### Authority Hierarchy

When questionnaires overlap or conflict, the authority hierarchy resolves precedence:

1. **Axon** — regulatory and credentialing requirements are non-negotiable
2. **Provider agent** — clinical protocols within the provider's scope of practice
3. **Patient agent** — personal preferences and self-directed interactions

A provider cannot author a questionnaire that bypasses Axon's credentialing requirements. A patient cannot override a provider's clinical intake protocol (though the patient always retains the right to refuse participation entirely — consent is sovereign).

---

## Dev Environment Strategy

For testing and iteration, the dev environment uses **Telegram via OpenClaw as the human interface** with synthetic data only.

This is acceptable because:
- All data is synthetic — no real PHI, no real credentials
- The protocol engine is transport-agnostic — swapping Telegram for a native UI later changes nothing about the protocol
- Telegram provides the visceral "this is real" experience that inspires contributors
- OpenClaw handles Telegram integration (polling, message delivery) so we don't build that ourselves

The key constraint: OpenClaw is **message bus only**. CareAgent's protocol engine hooks into OpenClaw to receive user messages and send responses, but it makes its own LLM calls and manages its own session state. OpenClaw's agent loop is not involved in CareAgent interactions.

---

## Open Questions

1. **OpenClaw hook mechanism.** How exactly does the protocol engine receive messages from OpenClaw without using OpenClaw's agent loop? Options: slash command handlers (already working), event hooks, message interceptors. Needs investigation of OpenClaw's plugin API surface.

2. **How do agents fetch questionnaires?** Axon already serves them over HTTP. Do we need versioning, caching, offline fallback?

3. **Guided mode specification.** How do we define the boundaries and "must-collect" fields for guided mode interactions? This needs more design work before clinical use cases.

4. **Mode transition triggers.** Who decides when to switch from structured to guided to open? The questionnaire definition, or the LLM within guardrails?

5. **Multi-agent session.** When a provider agent is conducting intake with a patient agent, both LLMs are active. How does the protocol handle two LLMs in the same interaction session?

6. **LLM API abstraction.** The protocol engine needs to call LLMs directly. Should it support multiple providers (Anthropic, OpenAI) from the start, or start with one and abstract later?

7. **Axon as agent.** Axon is currently a stateless HTTP server. What does it mean for Axon to have its own agent identity? Does it need its own LLM, or is Axon's "agent" purely the protocol engine executing questionnaires deterministically?

---

## Next Steps

1. Formalize the interaction protocol spec in `axon/spec/interaction.md`
2. Formalize the questionnaire schema as a TypeBox schema in Axon (evolving existing `data/questionnaires/` format)
3. Build the protocol engine — code that drives questionnaire execution, makes direct LLM calls, validates responses, manages session state
4. Build the OpenClaw message bus adapter — receives Telegram messages, routes to protocol engine, sends responses back
5. Refactor provider onboarding to use the protocol engine with the existing Axon physician questionnaire
6. Test end-to-end: `/careagent_on` → Axon questionnaire → Telegram conversation → validated CANS.md
7. Extend the protocol to cover the provider-patient interaction pattern
