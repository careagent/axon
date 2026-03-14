/**
 * JSON-RPC 2.0 schemas for A2A transport.
 * These define the wire format for SendMessage, GetTask, CancelTask, etc.
 * All repos must use these schemas — do not define local JSON-RPC types.
 */

import { Type, type Static } from '@sinclair/typebox'
import { MessageSchema } from './task.js'

// --- JSON-RPC 2.0 base ---

export const JsonRpcRequestSchema = Type.Object({
  jsonrpc: Type.Literal('2.0'),
  id: Type.Union([Type.String(), Type.Number()]),
  method: Type.String(),
  params: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
})

export type JsonRpcRequest = Static<typeof JsonRpcRequestSchema>

export const JsonRpcErrorSchema = Type.Object({
  code: Type.Number(),
  message: Type.String(),
  data: Type.Optional(Type.Unknown()),
})

export type JsonRpcError = Static<typeof JsonRpcErrorSchema>

export const JsonRpcResponseSchema = Type.Object({
  jsonrpc: Type.Literal('2.0'),
  id: Type.Union([Type.String(), Type.Number(), Type.Null()]),
  result: Type.Optional(Type.Unknown()),
  error: Type.Optional(JsonRpcErrorSchema),
})

export type JsonRpcResponse = Static<typeof JsonRpcResponseSchema>

// --- A2A Methods ---

export const SendMessageParamsSchema = Type.Object({
  id: Type.String({ description: 'Task ID' }),
  sessionId: Type.Optional(Type.String()),
  message: MessageSchema,
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
})

export type SendMessageParams = Static<typeof SendMessageParamsSchema>

export const GetTaskParamsSchema = Type.Object({
  id: Type.String({ description: 'Task ID' }),
})

export type GetTaskParams = Static<typeof GetTaskParamsSchema>

export const CancelTaskParamsSchema = Type.Object({
  id: Type.String({ description: 'Task ID' }),
})

export type CancelTaskParams = Static<typeof CancelTaskParamsSchema>

// --- A2A method names ---

export const A2A_METHODS = {
  SEND_MESSAGE: 'message/send',
  SEND_STREAMING_MESSAGE: 'message/stream',
  GET_TASK: 'tasks/get',
  CANCEL_TASK: 'tasks/cancel',
} as const
