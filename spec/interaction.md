# Axon Interaction Protocol Specification

## Overview

The Interaction Protocol defines how CareAgent conducts structured conversations with humans (providers, patients) through questionnaire-driven interactions. Unlike the handshake protocol (agent-to-agent, cryptographic), the interaction protocol is agent-to-human, conversational, and validated by a deterministic engine — not the LLM.

**Key properties:**

- **LLM for conversation, code for validation.** The LLM presents questions naturally and extracts answers. The protocol engine validates answers deterministically.
- **Authority hierarchy.** Questionnaire authority flows downward: Axon (regulatory) > Provider (clinical) > Patient (preference). Higher authorities cannot be overridden.
- **Classification-aware.** Every question carries domain (clinical/administrative) and sensitivity metadata. Sensitive clinical data requires encrypted storage.
- **Transport-agnostic.** The protocol engine communicates via a `MessageIO` interface. It works identically over Telegram, CLI, or WebSocket.

## Session Lifecycle

An interaction session progresses through four states:

```
[created] → [active] → [completed]
                ↓
            [failed]
```

### Session Creation

A session is created with:
- A unique **session_id** (UUIDv7 for time-sortability)
- A reference to the **questionnaire** being administered
- The **authority** (who issued the questionnaire)
- The **respondent** identity (provider ID, patient ID, etc.)
- An empty **answers** map and **conversation_history**

### Active Session

During an active session, the protocol engine:
1. Resolves the next unanswered question via conditional logic
2. Builds an LLM prompt with the question context and a `submit_answer` tool
3. Sends the prompt to the LLM (direct API call, not through any agent framework)
4. Processes the LLM response:
   - If `submit_answer` tool use → validate the answer deterministically
   - If text only → conversational turn, relay to user
5. On valid answer → advance session to next question
6. On invalid answer → re-prompt with error context (max 3 retries)
7. When all required questions are answered → session completes

### Session Completion

A completed session produces:
- A **validated answers map** (question_id → validated value)
- An optional **structured output artifact** (e.g., CANS.md)

### Session Failure

A session fails when:
- A required question exceeds max retries (3)
- The LLM client encounters an unrecoverable error
- The transport disconnects

## Question Presentation Rules

1. **One question at a time.** The engine presents exactly one question per turn.
2. **Conditional questions are evaluated lazily.** A question with `show_when` is only presented if its condition evaluates to true against current answers.
3. **Question order is deterministic.** Questions are presented in array order, skipping answered questions and those whose conditions evaluate false.
4. **LLM guidance is optional.** If a question has `llm_guidance`, it is included in the system prompt to help the LLM present the question naturally.
5. **Options are provided for select types.** For `single_select` and `multi_select`, the LLM receives the full option list for reference.

## Answer Validation Contract

All answer validation is **deterministic** — performed by code, never by the LLM.

| Answer Type    | Validation Rules |
|---------------|------------------|
| `boolean`     | Must resolve to true/false. Accepts: yes/no, y/n, true/false (case-insensitive) |
| `single_select` | Must match an option's `value` or `label` (case-insensitive) |
| `multi_select` | Each item must match an option. Comma-separated or array input accepted |
| `text`        | Must pass `validation.pattern` (regex), `min_length`, `max_length` constraints |
| `number`      | Must parse to a finite number. Respects `min_length`/`max_length` as min/max bounds |
| `date`        | Must parse as ISO 8601 date (YYYY-MM-DD or full ISO timestamp) |

### Validation Flow

```
raw_input → type_coerce → constraint_check → { valid: true, value } | { valid: false, error }
```

The validated value is always the canonical form:
- `boolean` → `true` | `false`
- `single_select` → option's `value` field
- `multi_select` → array of option `value` fields
- `text` → trimmed string
- `number` → number
- `date` → ISO 8601 string

## Structured Output Format

The LLM extracts answers via **tool use** (Claude's `tool_use` feature). The protocol engine defines a `submit_answer` tool for each question:

```json
{
  "name": "submit_answer",
  "description": "Submit the provider's answer to the current question",
  "input_schema": {
    "type": "object",
    "properties": {
      "value": { /* type-specific schema */ },
      "display_text": {
        "type": "string",
        "description": "Conversational message to show the user alongside the answer"
      }
    },
    "required": ["value", "display_text"]
  }
}
```

The `value` schema varies by answer type:
- `boolean` → `{ "type": "boolean" }`
- `single_select` → `{ "type": "string", "enum": [option values] }`
- `multi_select` → `{ "type": "array", "items": { "type": "string", "enum": [option values] } }`
- `text` → `{ "type": "string" }`
- `number` → `{ "type": "number" }`
- `date` → `{ "type": "string", "format": "date" }`

## Classification Metadata

Questions and questionnaires carry classification metadata:

```
domain: clinical | administrative
sensitivity: sensitive | non_sensitive
```

**Clinical × Sensitive** (e.g., diagnosis, medication history): Requires encrypted storage, audit logging, and consent verification before access.

**Clinical × Non-Sensitive** (e.g., specialty, practice setting): Standard audit logging, no encryption required.

**Administrative × Sensitive** (e.g., DEA number, NPI): Encrypted storage, restricted access.

**Administrative × Non-Sensitive** (e.g., organization name, display preferences): Standard handling.

## Authority Hierarchy

Questionnaires declare an `authority` field indicating who issued them:

```
axon > provider > patient
```

- **Axon authority**: Regulatory and credentialing questionnaires. Cannot be skipped or modified by providers or patients. Examples: physician credentialing, scope-of-practice determination.
- **Provider authority**: Clinical protocol questionnaires authored by the provider. Cannot be modified by patients. Examples: intake forms, clinical philosophy.
- **Patient authority**: Patient preference questionnaires. Modifiable by the patient at any time. Examples: communication preferences, consent updates.

When questionnaires from different authorities conflict, higher authority wins.

## Condition Evaluation

Question conditions support two formats:

### Legacy Format (backward-compatible)
```json
{ "question_id": "q1", "equals": "true" }
```

### Extended Format
```json
{ "question_id": "q1", "operator": "not_equals", "value": "none" }
```

Supported operators:
- `equals` — exact string match (same as legacy `equals`)
- `not_equals` — negated exact match
- `contains` — substring match (for text answers)
- `greater_than` — numeric comparison
- `less_than` — numeric comparison

When both `equals` and `operator`+`value` are present, the legacy `equals` takes precedence for backward compatibility.

## See Also

- [handshake.md](./handshake.md) — Connection handshake (agent-to-agent, cryptographic)
- [identity.md](./identity.md) — Ed25519 identity and signing
- [consent.md](./consent.md) — Consent token format
- [message.md](./message.md) — Protocol message schemas
- [credential.md](./credential.md) — Credential verification rules
