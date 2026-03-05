/**
 * A2A JSON-RPC 2.0 request handler for the Axon registry.
 *
 * Routes incoming JSON-RPC requests to the appropriate handler:
 * - message/send: Creates or updates tasks; routes form engine requests
 * - tasks/get: Retrieves a task by ID
 * - tasks/cancel: Cancels a task
 */

import { randomUUID } from 'node:crypto'
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  SendMessageParams,
  GetTaskParams,
  CancelTaskParams,
  Task,
  Message,
  DataPart,
} from '@careagent/a2a-types'

/**
 * A2A method name constants.
 * Duplicated from @careagent/a2a-types to avoid runtime import resolution
 * issues with the linked package (tsdown produces .mjs but exports declares .js).
 */
const A2A_METHODS = {
  SEND_MESSAGE: 'message/send',
  SEND_STREAMING_MESSAGE: 'message/stream',
  GET_TASK: 'tasks/get',
  CANCEL_TASK: 'tasks/cancel',
} as const
import { AxonQuestionnaires } from '../questionnaires/questionnaires.js'
import type { AgentCardStore } from './agent-card-store.js'
import type { Questionnaire, Question } from '../types/index.js'

/** Standard JSON-RPC 2.0 error codes. */
const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const

/**
 * A2A JSON-RPC 2.0 handler for the Axon registry.
 *
 * Manages an in-memory task store and routes form engine requests
 * through the Axon questionnaire system.
 */
export class A2AHandler {
  private readonly tasks: Map<string, Task>
  private readonly cardStore: AgentCardStore

  constructor(cardStore: AgentCardStore) {
    this.cardStore = cardStore
    this.tasks = new Map()
  }

  /**
   * Handle a JSON-RPC 2.0 request and return a response.
   *
   * Validates the request format, routes to the appropriate method handler,
   * and returns a properly formatted JSON-RPC response.
   */
  handle(request: JsonRpcRequest): JsonRpcResponse {
    // Validate JSON-RPC 2.0 format
    if (request.jsonrpc !== '2.0') {
      return this.errorResponse(
        request.id ?? null,
        JSON_RPC_ERRORS.INVALID_REQUEST,
        'Invalid JSON-RPC version: expected "2.0"',
      )
    }

    if (typeof request.id !== 'string' && typeof request.id !== 'number') {
      return this.errorResponse(
        null,
        JSON_RPC_ERRORS.INVALID_REQUEST,
        'Missing or invalid request id',
      )
    }

    switch (request.method) {
      case A2A_METHODS.SEND_MESSAGE:
        return this.handleSendMessage(request.id, request.params as unknown as SendMessageParams)
      case A2A_METHODS.GET_TASK:
        return this.handleGetTask(request.id, request.params as unknown as GetTaskParams)
      case A2A_METHODS.CANCEL_TASK:
        return this.handleCancelTask(request.id, request.params as unknown as CancelTaskParams)
      default:
        return this.errorResponse(
          request.id,
          JSON_RPC_ERRORS.METHOD_NOT_FOUND,
          `Unknown method: "${request.method}"`,
        )
    }
  }

  /** Handle message/send — create or update a task. */
  private handleSendMessage(
    requestId: string | number,
    params: SendMessageParams | undefined,
  ): JsonRpcResponse {
    if (params === undefined || params.message === undefined) {
      return this.errorResponse(
        requestId,
        JSON_RPC_ERRORS.INVALID_PARAMS,
        'Missing required params: message',
      )
    }

    const taskId = params.id ?? randomUUID()
    const message = params.message

    // Check if this is a form engine request (DataPart with questionnaire_id)
    const questionnaireId = this.extractQuestionnaireId(message)
    if (questionnaireId !== undefined) {
      return this.handleFormEngineRequest(requestId, taskId, params.sessionId, message, questionnaireId)
    }

    // Standard message — create or update task
    const existing = this.tasks.get(taskId)
    if (existing !== undefined) {
      // Append message to history and update status
      const history = existing.history ?? []
      history.push(message)
      const updated: Task = {
        ...existing,
        history,
        status: {
          state: 'completed',
          message,
          timestamp: new Date().toISOString(),
        },
      }
      this.tasks.set(taskId, updated)
      return this.successResponse(requestId, updated)
    }

    // Create new task
    const task: Task = {
      id: taskId,
      ...(params.sessionId !== undefined && { sessionId: params.sessionId }),
      status: {
        state: 'completed',
        message,
        timestamp: new Date().toISOString(),
      },
      history: [message],
      ...(params.metadata !== undefined && { metadata: params.metadata }),
    }
    this.tasks.set(taskId, task)
    return this.successResponse(requestId, task)
  }

  /** Handle tasks/get — retrieve a task by ID. */
  private handleGetTask(
    requestId: string | number,
    params: GetTaskParams | undefined,
  ): JsonRpcResponse {
    if (params === undefined || params.id === undefined) {
      return this.errorResponse(
        requestId,
        JSON_RPC_ERRORS.INVALID_PARAMS,
        'Missing required params: id',
      )
    }

    const task = this.tasks.get(params.id)
    if (task === undefined) {
      return this.errorResponse(
        requestId,
        JSON_RPC_ERRORS.INVALID_PARAMS,
        `Task not found: "${params.id}"`,
      )
    }

    return this.successResponse(requestId, task)
  }

  /** Handle tasks/cancel — cancel a task. */
  private handleCancelTask(
    requestId: string | number,
    params: CancelTaskParams | undefined,
  ): JsonRpcResponse {
    if (params === undefined || params.id === undefined) {
      return this.errorResponse(
        requestId,
        JSON_RPC_ERRORS.INVALID_PARAMS,
        'Missing required params: id',
      )
    }

    const task = this.tasks.get(params.id)
    if (task === undefined) {
      return this.errorResponse(
        requestId,
        JSON_RPC_ERRORS.INVALID_PARAMS,
        `Task not found: "${params.id}"`,
      )
    }

    const canceled: Task = {
      ...task,
      status: {
        state: 'canceled',
        timestamp: new Date().toISOString(),
      },
    }
    this.tasks.set(params.id, canceled)
    return this.successResponse(requestId, canceled)
  }

  /**
   * Handle a form engine request by delegating to the Axon questionnaire system.
   *
   * When a message contains a DataPart with `data.questionnaire_id`, the handler
   * looks up the questionnaire and returns the next question as a task in
   * 'input-required' state. If the questionnaire is complete, the task state
   * becomes 'completed'.
   */
  private handleFormEngineRequest(
    requestId: string | number,
    taskId: string,
    sessionId: string | undefined,
    message: Message,
    questionnaireId: string,
  ): JsonRpcResponse {
    // Look up the questionnaire
    const questionnaire =
      AxonQuestionnaires.getForType(questionnaireId) ??
      AxonQuestionnaires.getMetaQuestionnaire(questionnaireId)

    if (questionnaire === undefined) {
      return this.errorResponse(
        requestId,
        JSON_RPC_ERRORS.INVALID_PARAMS,
        `Questionnaire not found: "${questionnaireId}"`,
      )
    }

    // Extract answers from the message data part
    const dataPart = message.parts.find((p): p is DataPart => p.type === 'data')
    const answers = (dataPart?.data?.['answers'] as Record<string, unknown> | undefined) ?? {}

    // Find the next unanswered question
    const nextQuestion = this.findNextQuestion(questionnaire, answers)

    if (nextQuestion === undefined) {
      // All questions answered — task is completed
      const responseMessage: Message = {
        role: 'agent',
        parts: [
          {
            type: 'data',
            data: {
              questionnaire_id: questionnaireId,
              status: 'completed',
              answers,
            },
          },
        ],
      }

      const task: Task = {
        id: taskId,
        ...(sessionId !== undefined && { sessionId }),
        status: {
          state: 'completed',
          message: responseMessage,
          timestamp: new Date().toISOString(),
        },
        history: [message, responseMessage],
      }
      this.tasks.set(taskId, task)
      return this.successResponse(requestId, task)
    }

    // Return the next question as input-required
    const responseMessage: Message = {
      role: 'agent',
      parts: [
        {
          type: 'data',
          data: {
            questionnaire_id: questionnaireId,
            status: 'input-required',
            question: {
              id: nextQuestion.id,
              text: nextQuestion.text,
              answer_type: nextQuestion.answer_type,
              ...(nextQuestion.options !== undefined && { options: nextQuestion.options }),
              ...(nextQuestion.required !== undefined && { required: nextQuestion.required }),
            },
            progress: {
              total: questionnaire.questions.length,
              answered: Object.keys(answers).length,
            },
          },
        },
      ],
    }

    const task: Task = {
      id: taskId,
      ...(sessionId !== undefined && { sessionId }),
      status: {
        state: 'input-required',
        message: responseMessage,
        timestamp: new Date().toISOString(),
      },
      history: [message, responseMessage],
    }
    this.tasks.set(taskId, task)
    return this.successResponse(requestId, task)
  }

  /** Extract questionnaire_id from the first DataPart in a message, if present. */
  private extractQuestionnaireId(message: Message): string | undefined {
    for (const part of message.parts) {
      if (part.type === 'data' && typeof part.data['questionnaire_id'] === 'string') {
        return part.data['questionnaire_id'] as string
      }
    }
    return undefined
  }

  /** Find the next unanswered question in a questionnaire. */
  private findNextQuestion(
    questionnaire: Questionnaire,
    answers: Record<string, unknown>,
  ): Question | undefined {
    for (const question of questionnaire.questions) {
      if (answers[question.id] === undefined) {
        return question
      }
    }
    return undefined
  }

  /** Build a successful JSON-RPC response. */
  private successResponse(id: string | number, result: unknown): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      result,
    }
  }

  /** Build an error JSON-RPC response. */
  private errorResponse(
    id: string | number | null,
    code: number,
    message: string,
  ): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message },
    }
  }
}
