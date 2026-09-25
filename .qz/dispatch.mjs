#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const [command, ...args] = process.argv.slice(2)
const aliases = { recap: ['stats', '--quick', '--json'] }
const supported = new Set([
  'artifact', 'back-merge', 'branch-plan', 'ci', 'close-issue', 'context',
  'db-fresh', 'db-migrate', 'db-seed', 'db-start', 'db-stop', 'db-studio',
  'db-update-template', 'dependabot-review', 'engram', 'env',
  'gentle-sdd-status', 'gentle-status', 'handoff', 'issue-preflight', 'merge',
  'promote', 'recap', 'run', 'servers-down', 'servers-up', 'smoke-plan',
  'start-issue', 'stats', 'test', 'update', 'verify', 'wt-clean'
])
if (!supported.has(command)) {
  console.error(`qz Hospeda: comando no soportado: ${command || '(vacío)'}`)
  console.error(`Comandos disponibles: ${[...supported].sort().join(', ')}`)
  process.exit(2)
}

const mapped = aliases[command] || [command]
const result = spawnSync('bun', ['run', 'scripts/client-tools/src/index.ts', ...mapped, ...args], {
  cwd: process.cwd(),
  stdio: 'inherit'
})
process.exit(result.status ?? 1)
