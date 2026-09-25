#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const [command, ...args] = process.argv.slice(2)
const aliases = { recap: ['stats', '--quick', '--json'] }
if (!command) {
  console.error('qz Hospeda: falta el comando')
  process.exit(2)
}

const mapped = aliases[command] || [command]
const result = spawnSync('bun', ['run', 'scripts/client-tools/src/index.ts', ...mapped, ...args], {
  cwd: process.cwd(),
  stdio: 'inherit'
})
process.exit(result.status ?? 1)
