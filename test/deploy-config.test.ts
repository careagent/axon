/**
 * Deployment configuration validation tests.
 *
 * Validates that Dockerfile, docker-compose.yml, and Caddyfile are
 * consistent and correctly configured for production deployment.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')

function readConfig(filename: string): string {
  return readFileSync(join(ROOT, filename), 'utf-8')
}

describe('Dockerfile', () => {
  const dockerfile = readConfig('Dockerfile')

  it('uses multi-stage build with node:22-alpine', () => {
    expect(dockerfile).toContain('FROM node:22-alpine AS build')
    expect(dockerfile).toContain('FROM node:22-alpine')
  })

  it('runs as non-root axon user', () => {
    expect(dockerfile).toContain('adduser -S axon')
    expect(dockerfile).toContain('USER axon')
  })

  it('exposes port 9999', () => {
    expect(dockerfile).toContain('EXPOSE 9999')
  })

  it('sets AXON_PORT environment variable to 9999', () => {
    expect(dockerfile).toContain('ENV AXON_PORT=9999')
  })

  it('includes a healthcheck on port 9999', () => {
    expect(dockerfile).toContain('HEALTHCHECK')
    expect(dockerfile).toContain('http://127.0.0.1:9999/health')
  })

  it('uses standalone.js as entrypoint', () => {
    expect(dockerfile).toContain('ENTRYPOINT ["node", "dist/server/standalone.js"]')
  })

  it('copies data directory for taxonomy and questionnaires', () => {
    expect(dockerfile).toContain('COPY --from=build /app/data/ data/')
  })
})

describe('docker-compose.yml', () => {
  const compose = readConfig('docker-compose.yml')

  it('defines axon service', () => {
    expect(compose).toContain('axon:')
  })

  it('defines caddy service', () => {
    expect(compose).toContain('caddy:')
  })

  it('axon service publishes port 9999 on localhost only', () => {
    expect(compose).toContain('127.0.0.1:9999:9999')
  })

  it('caddy service maps ports 80 and 443', () => {
    expect(compose).toContain('"80:80"')
    expect(compose).toContain('"443:443"')
  })

  it('caddy depends on axon health', () => {
    expect(compose).toContain('condition: service_healthy')
  })

  it('caddy is under with-caddy profile for self-contained deploys', () => {
    expect(compose).toContain('with-caddy')
  })

  it('caddy loads secrets.env for AXON_DOMAIN', () => {
    expect(compose).toContain('secrets.env')
  })

  it('mounts Caddyfile as read-only', () => {
    expect(compose).toContain('./Caddyfile:/etc/caddy/Caddyfile:ro')
  })

  it('uses persistent volumes for caddy data and axon data', () => {
    expect(compose).toContain('axon-data:')
    expect(compose).toContain('caddy-data:')
    expect(compose).toContain('caddy-config:')
  })
})

describe('Caddyfile', () => {
  const caddyfile = readConfig('Caddyfile')

  it('uses AXON_DOMAIN environment variable for server name', () => {
    expect(caddyfile).toContain('{$AXON_DOMAIN}')
  })

  it('reverse-proxies to axon service on port 9999', () => {
    expect(caddyfile).toContain('reverse_proxy axon:9999')
  })

  it('sets security headers', () => {
    expect(caddyfile).toContain('X-Content-Type-Options nosniff')
    expect(caddyfile).toContain('X-Frame-Options DENY')
    expect(caddyfile).toContain('Strict-Transport-Security')
  })

  it('strips Server header', () => {
    expect(caddyfile).toContain('-Server')
  })
})

describe('.dockerignore', () => {
  const dockerignore = readConfig('.dockerignore')

  it('excludes node_modules', () => {
    expect(dockerignore).toContain('node_modules/')
  })

  it('excludes test directory', () => {
    expect(dockerignore).toContain('test/')
  })

  it('excludes secrets.env', () => {
    expect(dockerignore).toContain('secrets.env')
  })

  it('excludes .git directory', () => {
    expect(dockerignore).toContain('.git/')
  })
})

describe('port consistency', () => {
  const dockerfile = readConfig('Dockerfile')
  const compose = readConfig('docker-compose.yml')
  const caddyfile = readConfig('Caddyfile')

  it('all configs use the same axon port (9999)', () => {
    // Dockerfile EXPOSE
    expect(dockerfile).toMatch(/EXPOSE 9999/)
    // Dockerfile ENV
    expect(dockerfile).toMatch(/ENV AXON_PORT=9999/)
    // docker-compose port mapping
    expect(compose).toContain('9999:9999')
    // Caddyfile reverse_proxy
    expect(caddyfile).toMatch(/reverse_proxy axon:9999/)
  })
})
