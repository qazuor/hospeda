#!/usr/bin/env node
/**
 * Read-only planner for the cross-client command pack.
 *
 * This intentionally has no apply mode. It validates the source manifest,
 * detects installed clients by executable name, and prints a deterministic
 * plan for a future installer.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(new URL(import.meta.url).pathname), '../..')
const manifestPath = resolve(root, 'tools/agent-packs/hops-command-manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

const args = new Set(process.argv.slice(2))
if (args.has('--help') || args.size === 0) {
  console.log('Usage: node tools/agent-packs/plan.mjs --plan|--check')
  console.log('Read-only: never writes, installs, logs in, or reads secret values.')
  process.exit(args.size === 0 ? 2 : 0)
}
if (!args.has('--plan') && !args.has('--check')) {
  console.error('ERROR: sólo se admiten --plan o --check; no existe --apply todavía.')
  process.exit(2)
}

const expected = new Set(['opencode', 'claude', 'codex'])
const clients = Object.fromEntries([...expected].map((name) => {
  const result = spawnSync('command', ['-v', name], { encoding: 'utf8', shell: true })
  const path = result.status === 0 ? result.stdout.trim() : null
  return [name, { detected: Boolean(path), executable: path }]
}))

const commandFiles = manifest.commands.map((entry) => resolve(root, entry.source))
const missing = commandFiles
  .filter((path) => !existsSync(path))
  .map((path) => path.replace(`${root}/`, ''))
const duplicateIds = manifest.commands
  .map((entry) => entry.id)
  .filter((id, index, all) => all.indexOf(id) !== index)

const result = {
  mode: args.has('--check') ? 'check' : 'plan',
  manifest: manifest.manifestId,
  schemaVersion: manifest.schemaVersion,
  source: manifest.generatedFrom,
  commands: manifest.commands.length,
  clients,
  destinations: {
    opencode: '.opencode/commands',
    claude: '.claude/commands (generated adapter; no CLAUDE.md)',
    codex: '.codex/skills or AGENTS.md adapter (generated later)'
  },
  validation: {
    missingSources: missing,
    duplicateIds,
    sourceComplete: missing.length === 0 && duplicateIds.length === 0
  },
  mutations: 'none'
}

console.log(JSON.stringify(result, null, 2))
process.exit(result.validation.sourceComplete ? 0 : 1)
