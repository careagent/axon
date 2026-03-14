/**
 * A2A Task lifecycle schemas — aligned with the A2A specification.
 * Tasks represent units of work between agents (credentialing, intake, clinical interactions).
 * All repos must use these schemas — do not define local Task types.
 */

import { Type, type Static } from '@sinclair/typebox'

// --- Task State ---

export const TaskStateSchema = Type.Union([
  Type.Literal('submitted'),
  Type.Literal('working'),
  Type.Literal('input-required'),
  Type.Literal('completed'),
  Type.Literal('canceled'),
  Type.Literal('failed'),
])

export type TaskState = Static<typeof TaskStateSchema>

// --- Message Parts ---

export const TextPartSchema = Type.Object({
  type: Type.Literal('text'),
  text: Type.String(),
})

export const DataPartSchema = Type.Object({
  type: Type.Literal('data'),
  data: Type.Record(Type.String(), Type.Unknown()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
})

export const FilePartSchema = Type.Object({
  type: Type.Literal('file'),
  file: Type.Object({
    name: Type.Optional(Type.String()),
    mimeType: Type.Optional(Type.String()),
    bytes: Type.Optional(Type.String({ description: 'Base64-encoded file content' })),
    uri: Type.Optional(Type.String({ format: 'uri' })),
  }),
})

export const PartSchema = Type.Union([TextPartSchema, DataPartSchema, FilePartSchema])

export type TextPart = Static<typeof TextPartSchema>
export type DataPart = Static<typeof DataPartSchema>
export type FilePart = Static<typeof FilePartSchema>
export type Part = Static<typeof PartSchema>

// --- CareAgent-specific Part metadata ---

export const ClinicalClassificationSchema = Type.Object({
  domain: Type.Union([Type.Literal('clinical'), Type.Literal('administrative')]),
  sensitivity: Type.Union([Type.Literal('sensitive'), Type.Literal('non_sensitive')]),
})

export type ClinicalClassification = Static<typeof ClinicalClassificationSchema>

// --- Messages ---

export const MessageRoleSchema = Type.Union([
  Type.Literal('user'),
  Type.Literal('agent'),
])

export type MessageRole = Static<typeof MessageRoleSchema>

export const MessageSchema = Type.Object({
  role: MessageRoleSchema,
  parts: Type.Array(PartSchema),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
})

export type Message = Static<typeof MessageSchema>

// --- Task ---

export const TaskStatusSchema = Type.Object({
  state: TaskStateSchema,
  message: Type.Optional(MessageSchema),
  timestamp: Type.Optional(Type.String({ format: 'date-time' })),
})

export type TaskStatus = Static<typeof TaskStatusSchema>

export const TaskSchema = Type.Object({
  id: Type.String({ description: 'Task identifier' }),
  sessionId: Type.Optional(Type.String({ description: 'Session grouping identifier' })),
  status: TaskStatusSchema,
  history: Type.Optional(Type.Array(MessageSchema)),
  artifacts: Type.Optional(Type.Array(Type.Object({
    name: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    parts: Type.Array(PartSchema),
    metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  }))),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
})

export type Task = Static<typeof TaskSchema>
