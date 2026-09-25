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

const translatedArgs = command === 'verify'
  ? args.filter((arg) => arg !== '--json').flatMap((arg) => arg === '--changed' ? ['--tests'] : [arg])
  : args
if (command === 'verify' && args.includes('--json')) {
  console.error('qz Hospeda: verify todavía no tiene salida JSON; se ejecuta en formato humano.')
}
const result = spawnSync('bun', ['run', 'scripts/client-tools/src/index.ts', ...mapped, ...translatedArgs], {
  cwd: process.cwd(),
  stdio: 'inherit'
})
process.exit(result.status ?? 1)
