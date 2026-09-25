#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const [command, ...args] = process.argv.slice(2)
const mapped = {
  recap: ['stats', '--quick', '--json'],
  verify: ['verify'],
  'start-issue': ['start-issue'],
  env: ['env']
}[command]

if (!mapped) {
  console.error(`qz Hospeda: todavía no hay adapter para «${command || '(vacío)'}».`)
  console.error('Equivalencias disponibles: recap → hops stats --quick --json; verify → hops verify; start-issue → hops start-issue; env → hops env.')
  process.exit(2)
}

const result = spawnSync('bun', ['run', 'scripts/client-tools/src/index.ts', ...mapped, ...args], {
  cwd: process.cwd(),
  stdio: 'inherit'
})
process.exit(result.status ?? 1)
