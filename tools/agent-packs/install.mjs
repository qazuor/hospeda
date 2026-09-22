#!/usr/bin/env node
/**
 * Read-only installation planner. The apply path is intentionally unavailable.
 * It reports destinations and required backup groups without reading secrets.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const root = resolve(dirname(new URL(import.meta.url).pathname), '../..')
const manifestPath = resolve(root, 'tools/agent-packs/hops-command-manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const args = new Set(process.argv.slice(2))
if (args.has('--help') || args.size === 0) {
  console.log('Usage: node tools/agent-packs/install.mjs --plan|--check')
  console.log('Read-only: --apply no está implementado; nunca lee valores de secretos.')
  process.exit(args.size === 0 ? 2 : 0)
}
if (!args.has('--plan') && !args.has('--check')) {
  console.error('ERROR: sólo se admiten --plan o --check; --apply está bloqueado.')
  process.exit(2)
}
const clients = ['opencode', 'claude', 'codex'].map((name) => {
  const result = spawnSync('command', ['-v', name], { encoding: 'utf8', shell: true })
  return { name, detected: result.status === 0, executable: result.status === 0 ? result.stdout.trim() : null }
})
const sources = manifest.commands.map((entry) => resolve(root, entry.source))
const sourceDrift = manifest.commands.flatMap((entry, index) => {
  const path = sources[index]
  if (!existsSync(path)) return [{ id: entry.id, reason: 'missing-source' }]
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex')
  return actual === entry.sha256 ? [] : [{ id: entry.id, reason: 'source-drift' }]
})
const home = process.env.HOME || '~'
const result = {
  mode: args.has('--check') ? 'check' : 'plan',
  manifest: manifest.manifestId,
  clients,
  commands: manifest.commands.length,
  destinations: {
    opencode: `${home}/.config/opencode/commands`,
    claude: `${home}/.claude/commands`,
    codex: `${home}/.codex/skills/hops-commands`
  },
  requiredBackups: [
    `${home}/.config/opencode`,
    `${home}/.claude`,
    `${home}/.codex`,
    `${home}/.local/state/hospeda-opencode-migration`
  ],
  sourceDrift,
  apply: 'blocked; explicit backup/approval/rollback implementation required',
  secrets: 'values-not-read',
  mutations: 'none'
}
console.log(JSON.stringify(result, null, 2))
process.exit(sourceDrift.length === 0 ? 0 : 1)
