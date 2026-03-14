/**
 * @careagent/a2a-types — Shared A2A contract schemas for the CareAgent ecosystem.
 *
 * This package is the single source of truth for all A2A-related TypeBox schemas.
 * All repos (axon, neuron, provider-core, patient-core) must import from here.
 * Do NOT define local Agent Card, Task, or JSON-RPC schemas in individual repos.
 */

export {
  AgentCapabilitySchema,
  AgentAuthSchema,
  AgentProviderSchema,
  AgentLocationSchema,
  CareAgentMetadataSchema,
  AgentCardSchema,
  type AgentCapability,
  type AgentAuth,
  type AgentProvider,
  type AgentLocation,
  type CareAgentMetadata,
  type AgentCard,
} from './agent-card.js'

export {
  TaskStateSchema,
  TextPartSchema,
  DataPartSchema,
  FilePartSchema,
  PartSchema,
  ClinicalClassificationSchema,
  MessageRoleSchema,
  MessageSchema,
  TaskStatusSchema,
  TaskSchema,
  type TaskState,
  type TextPart,
  type DataPart,
  type FilePart,
  type Part,
  type ClinicalClassification,
  type MessageRole,
  type Message,
  type TaskStatus,
  type Task,
} from './task.js'

export {
  JsonRpcRequestSchema,
  JsonRpcErrorSchema,
  JsonRpcResponseSchema,
  SendMessageParamsSchema,
  GetTaskParamsSchema,
  CancelTaskParamsSchema,
  A2A_METHODS,
  type JsonRpcRequest,
  type JsonRpcError,
  type JsonRpcResponse,
  type SendMessageParams,
  type GetTaskParams,
  type CancelTaskParams,
} from './json-rpc.js'
