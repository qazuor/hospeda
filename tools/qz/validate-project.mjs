#!/usr/bin/env node
/** Read-only validation of a project's .qz/project.json adapter. */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const projectRoot = resolve(process.argv[2] || process.cwd())
const path = resolve(projectRoot, '.qz/project.json')
if (!existsSync(path)) {
  console.error(`ERROR: no existe ${path}`)
  process.exit(1)
}
const config = JSON.parse(readFileSync(path, 'utf8'))
const errors = []
for (const key of ['schemaVersion', 'projectId', 'adapter', 'issues', 'branches', 'worktree', 'database', 'servers', 'commands']) {
  if (!(key in config)) errors.push(`missing:${key}`)
}
if (config.schemaVersion !== 1) errors.push('schemaVersion:unsupported')
if (typeof config.projectId !== 'string' || config.projectId.length === 0) errors.push('projectId:type')
if (typeof config.adapter !== 'string' || config.adapter.length === 0) errors.push('adapter:type')
if (!config.issues?.provider || !config.issues?.teamKey) errors.push('issues:provider/teamKey')
if (!config.branches?.base || !Array.isArray(config.branches?.protected)) errors.push('branches:base/protected')
if (config.branches?.pattern !== undefined && typeof config.branches.pattern !== 'string') errors.push('branches.pattern')
if (config.branches?.promotion !== undefined && (!Array.isArray(config.branches.promotion) || config.branches.promotion.some((branch) => typeof branch !== 'string' || branch.length === 0))) {
  errors.push('branches.promotion')
}
if (config.branches?.backMerge !== undefined && (!Array.isArray(config.branches.backMerge) || config.branches.backMerge.some((merge) => !merge || typeof merge.from !== 'string' || typeof merge.to !== 'string' || merge.from.length === 0 || merge.to.length === 0))) {
  errors.push('branches.backMerge')
}
if (!config.worktree?.pathPattern || !config.worktree?.envSource) errors.push('worktree:pathPattern/envSource')
if (config.worktree?.envSource && typeof config.worktree.envSource.kind !== 'string') {
  errors.push('worktree.envSource:kind')
}
if (typeof config.worktree?.envSource?.kind === 'string') {
  const kind = config.worktree.envSource.kind
  if (!['none', 'protected-checkout', 'path'].includes(kind)) errors.push('worktree.envSource:unsupported-kind')
  if (kind === 'path' && (typeof config.worktree.envSource.relativePath !== 'string' || config.worktree.envSource.relativePath.length === 0)) {
    errors.push('worktree.envSource:relativePath')
  }
  if (typeof config.worktree.envSource.relativePath === 'string' && (config.worktree.envSource.relativePath.startsWith('/') || config.worktree.envSource.relativePath.split(/[\\/]+/).includes('..'))) {
    errors.push('worktree.envSource:unsafe-relativePath')
  }
}
if (config.worktree?.envSource?.kind === 'protected-checkout' && !config.worktree.envSource.checkoutName) {
  errors.push('worktree.envSource:checkoutName')
}
if (config.worktree?.envSource?.checkoutName !== undefined && (typeof config.worktree.envSource.checkoutName !== 'string' || !/^[A-Za-z0-9._-]+$/.test(config.worktree.envSource.checkoutName))) {
  errors.push('worktree.envSource:unsafe-checkoutName')
}
if (config.database && typeof config.database !== 'object') errors.push('database:type')
if (config.database?.strategy !== undefined && typeof config.database.strategy !== 'string') {
  errors.push('database.strategy')
}
if (typeof config.database?.strategy === 'string') {
  if (!/^[a-z][a-z0-9-]*$/.test(config.database.strategy)) {
    errors.push('database.strategy:slug')
  }
  if (config.database.strategy === 'postgres-template') {
    for (const key of ['container', 'templateDatabase', 'databaseNamePattern', 'connectionEnvVar']) {
      if (typeof config.database[key] !== 'string' || config.database[key].length === 0) {
        errors.push(`database:${key}:required-for-postgres-template`)
      }
    }
  }
}
if (config.database?.templateDatabase !== undefined && typeof config.database.templateDatabase !== 'string') {
  errors.push('database.templateDatabase')
}
if (config.database?.connectionEnvVar !== undefined && typeof config.database.connectionEnvVar !== 'string') {
  errors.push('database.connectionEnvVar')
}
for (const key of ['schemaFingerprintPaths', 'schemaSentinelTables', 'templateFingerprintPaths']) {
  if (config.database?.[key] !== undefined && (!Array.isArray(config.database[key]) || config.database[key].some((value) => typeof value !== 'string' || value.length === 0))) {
    errors.push(`database.${key}`)
  }
}
if (!Array.isArray(config.servers) || config.servers.length === 0) errors.push('servers:empty')
const serverIds = new Set()
for (const [index, server] of (config.servers || []).entries()) {
  if (!server || typeof server.id !== 'string' || server.id.length === 0) {
    errors.push(`servers[${index}]:id`)
    continue
  }
  if (serverIds.has(server.id)) errors.push(`servers[${index}]:duplicate-id:${server.id}`)
  serverIds.add(server.id)
  if (!Number.isInteger(server.defaultPort) || server.defaultPort < 1 || server.defaultPort > 65535) {
    errors.push(`servers[${index}]:defaultPort`)
  }
  if (typeof server.start !== 'string' || server.start.length === 0) errors.push(`servers[${index}]:start`)
  if (server.healthPath !== undefined && typeof server.healthPath !== 'string') {
    errors.push(`servers[${index}]:healthPath`)
  }
}
if (typeof config.commands?.genericPrefix !== 'string' || config.commands.genericPrefix.length === 0) errors.push('commands:genericPrefix')
if (typeof config.commands?.projectPrefix !== 'string' || config.commands.projectPrefix.length === 0) errors.push('commands:projectPrefix')
const serialized = JSON.stringify(config).toLowerCase()
for (const forbidden of ['password', 'secret', 'token', 'privatekey', 'accesskey']) {
  if (serialized.includes(`"${forbidden}"`)) errors.push(`forbidden-field:${forbidden}`)
}
const result = { projectRoot, manifest: path, projectId: config.projectId, adapter: config.adapter, servers: config.servers?.map((s) => s.id), errors, valid: errors.length === 0, mutations: 'none', secretValues: 'not-read' }
console.log(JSON.stringify(result, null, 2))
process.exit(result.valid ? 0 : 1)
