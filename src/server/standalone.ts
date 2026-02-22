#!/usr/bin/env node

import { mkdirSync, existsSync } from 'node:fs'
import { createAxonServer } from './index.js'

const port = Number(process.env['AXON_PORT'] ?? '9999')
const host = process.env['AXON_HOST'] ?? '0.0.0.0'
const dataDir = process.env['AXON_DATA_DIR'] ?? './axon-data'

// Ensure data directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

const server = createAxonServer({ port, host, dataDir })

// Graceful shutdown
function shutdown(signal: string): void {
  console.log(`\n[axon] ${signal} received, shutting down...`)
  server.stop().then(() => {
    console.log('[axon] Server stopped.')
    process.exit(0)
  }).catch((err) => {
    console.error('[axon] Error during shutdown:', err)
    process.exit(1)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

server.start().then((url) => {
  console.log(`[axon] Axon server v1.0.0 listening on ${url}`)
  console.log(`[axon] Data directory: ${dataDir}`)
  console.log(`[axon] Health check: ${url}/health`)
}).catch((err) => {
  console.error('[axon] Failed to start server:', err)
  process.exit(1)
})
