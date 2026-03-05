import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  JsonRpcRequest,
  Task,
  Message,
  SendMessageParams,
} from '@careagent/a2a-types'

/** Inline A2A method constants to avoid runtime resolution issues with linked package. */
const A2A_METHODS = {
  SEND_MESSAGE: 'message/send',
  GET_TASK: 'tasks/get',
  CANCEL_TASK: 'tasks/cancel',
} as const
import { AgentCardStore } from '../../src/a2a/agent-card-store.js'
import { A2AHandler } from '../../src/a2a/json-rpc-handler.js'

function makeRequest(overrides: Partial<JsonRpcRequest> = {}): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id: 'req-1',
    method: A2A_METHODS.SEND_MESSAGE,
    ...overrides,
  }
}

function makeTextMessage(text: string, role: 'user' | 'agent' = 'user'): Message {
  return {
    role,
    parts: [{ type: 'text', text }],
  }
}

function makeSendMessageParams(overrides: Partial<SendMessageParams> = {}): SendMessageParams {
  return {
    id: 'task-1',
    message: makeTextMessage('Hello'),
    ...overrides,
  }
}

describe('A2AHandler', () => {
  let tempDir: string
  let handler: A2AHandler

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'axon-a2a-handler-test-'))
    const cardStore = new AgentCardStore(join(tempDir, 'cards.json'))
    handler = new A2AHandler(cardStore)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  // --- SendMessage ---

  describe('message/send', () => {
    it('creates a task with completed state', () => {
      const response = handler.handle(
        makeRequest({ params: makeSendMessageParams() as unknown as Record<string, unknown> }),
      )

      expect(response.error).toBeUndefined()
      const task = response.result as Task
      expect(task.id).toBe('task-1')
      expect(task.status.state).toBe('completed')
      expect(task.history).toHaveLength(1)
    })

    it('updates an existing task when same id is sent', () => {
      handler.handle(
        makeRequest({ params: makeSendMessageParams() as unknown as Record<string, unknown> }),
      )

      const response = handler.handle(
        makeRequest({
          id: 'req-2',
          params: makeSendMessageParams({
            message: makeTextMessage('Second message'),
          }) as unknown as Record<string, unknown>,
        }),
      )

      const task = response.result as Task
      expect(task.id).toBe('task-1')
      expect(task.history).toHaveLength(2)
    })

    it('preserves sessionId when provided', () => {
      const response = handler.handle(
        makeRequest({
          params: makeSendMessageParams({
            sessionId: 'session-1',
          }) as unknown as Record<string, unknown>,
        }),
      )

      const task = response.result as Task
      expect(task.sessionId).toBe('session-1')
    })

    it('returns error when message is missing', () => {
      const response = handler.handle(
        makeRequest({ params: { id: 'task-1' } as unknown as Record<string, unknown> }),
      )

      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe(-32602)
    })
  })

  // --- GetTask ---

  describe('tasks/get', () => {
    it('retrieves an existing task', () => {
      handler.handle(
        makeRequest({ params: makeSendMessageParams() as unknown as Record<string, unknown> }),
      )

      const response = handler.handle(
        makeRequest({
          id: 'req-2',
          method: A2A_METHODS.GET_TASK,
          params: { id: 'task-1' } as unknown as Record<string, unknown>,
        }),
      )

      expect(response.error).toBeUndefined()
      const task = response.result as Task
      expect(task.id).toBe('task-1')
      expect(task.status.state).toBe('completed')
    })

    it('returns error for non-existent task', () => {
      const response = handler.handle(
        makeRequest({
          method: A2A_METHODS.GET_TASK,
          params: { id: 'no-such-task' } as unknown as Record<string, unknown>,
        }),
      )

      expect(response.error).toBeDefined()
      expect(response.error!.message).toContain('not found')
    })

    it('returns error when id param is missing', () => {
      const response = handler.handle(
        makeRequest({
          method: A2A_METHODS.GET_TASK,
          params: {} as unknown as Record<string, unknown>,
        }),
      )

      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe(-32602)
    })
  })

  // --- CancelTask ---

  describe('tasks/cancel', () => {
    it('cancels an existing task', () => {
      handler.handle(
        makeRequest({ params: makeSendMessageParams() as unknown as Record<string, unknown> }),
      )

      const response = handler.handle(
        makeRequest({
          id: 'req-2',
          method: A2A_METHODS.CANCEL_TASK,
          params: { id: 'task-1' } as unknown as Record<string, unknown>,
        }),
      )

      expect(response.error).toBeUndefined()
      const task = response.result as Task
      expect(task.status.state).toBe('canceled')
    })

    it('returns error for non-existent task', () => {
      const response = handler.handle(
        makeRequest({
          method: A2A_METHODS.CANCEL_TASK,
          params: { id: 'no-such-task' } as unknown as Record<string, unknown>,
        }),
      )

      expect(response.error).toBeDefined()
      expect(response.error!.message).toContain('not found')
    })
  })

  // --- Unknown method ---

  describe('unknown method', () => {
    it('returns METHOD_NOT_FOUND error', () => {
      const response = handler.handle(
        makeRequest({ method: 'unknown/method' }),
      )

      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe(-32601)
      expect(response.error!.message).toContain('unknown/method')
    })
  })

  // --- Invalid JSON-RPC format ---

  describe('invalid JSON-RPC', () => {
    it('rejects non-2.0 version', () => {
      const response = handler.handle({
        jsonrpc: '1.0' as '2.0',
        id: 'req-1',
        method: A2A_METHODS.SEND_MESSAGE,
      })

      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe(-32600)
    })

    it('all responses have jsonrpc 2.0', () => {
      const response = handler.handle(makeRequest({ method: 'unknown' }))
      expect(response.jsonrpc).toBe('2.0')
    })
  })

  // --- Form engine integration ---

  describe('form engine integration', () => {
    it('routes message with questionnaire_id to form engine', () => {
      // Use _universal_consent which is a meta-questionnaire
      const message: Message = {
        role: 'user',
        parts: [
          {
            type: 'data',
            data: {
              questionnaire_id: '_universal_consent',
              answers: {},
            },
          },
        ],
      }

      const response = handler.handle(
        makeRequest({
          params: {
            id: 'form-task-1',
            message,
          } as unknown as Record<string, unknown>,
        }),
      )

      expect(response.error).toBeUndefined()
      const task = response.result as Task
      // Should be input-required since no answers provided
      expect(task.status.state).toBe('input-required')
      expect(task.id).toBe('form-task-1')

      // The status message should contain the next question
      const statusMsg = task.status.message
      expect(statusMsg).toBeDefined()
      expect(statusMsg!.role).toBe('agent')
      const dataPart = statusMsg!.parts.find((p) => p.type === 'data')
      expect(dataPart).toBeDefined()
      if (dataPart?.type === 'data') {
        expect(dataPart.data['status']).toBe('input-required')
        expect(dataPart.data['question']).toBeDefined()
      }
    })

    it('returns error for non-existent questionnaire', () => {
      const message: Message = {
        role: 'user',
        parts: [
          {
            type: 'data',
            data: {
              questionnaire_id: 'nonexistent_questionnaire',
              answers: {},
            },
          },
        ],
      }

      const response = handler.handle(
        makeRequest({
          params: {
            id: 'form-task-2',
            message,
          } as unknown as Record<string, unknown>,
        }),
      )

      expect(response.error).toBeDefined()
      expect(response.error!.message).toContain('not found')
    })

    it('does not route to form engine when no questionnaire_id in data', () => {
      const message: Message = {
        role: 'user',
        parts: [
          {
            type: 'data',
            data: { some_other_field: 'value' },
          },
        ],
      }

      const response = handler.handle(
        makeRequest({
          params: {
            id: 'regular-task',
            message,
          } as unknown as Record<string, unknown>,
        }),
      )

      expect(response.error).toBeUndefined()
      const task = response.result as Task
      // Should be a regular completed task, not routed to form engine
      expect(task.status.state).toBe('completed')
    })

    it('text-only messages are not routed to form engine', () => {
      const response = handler.handle(
        makeRequest({
          params: makeSendMessageParams() as unknown as Record<string, unknown>,
        }),
      )

      const task = response.result as Task
      expect(task.status.state).toBe('completed')
    })
  })
})
