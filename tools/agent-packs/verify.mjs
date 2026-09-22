#!/usr/bin/env node
/** Read-only verification of a rendered agent-pack adapter. */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'

const args = process.argv.slice(2)
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
if (args.includes('--help') || args.length === 0) {
  console.log('Usage: node tools/agent-packs/verify.mjs --client <opencode|claude|codex> --output <dir>')
  console.log('Read-only; verifies the rendered manifest and command hashes.')
  process.exit(args.length === 0 ? 2 : 0)
}
const client = value('--client')
const output = value('--output')
if (!['opencode', 'claude', 'codex'].includes(client) || !output) {
  console.error('ERROR: --client y --output son obligatorios.')
  process.exit(2)
}
const root = resolve(output)
const manifestPath = join(root, 'manifest.json')
if (!existsSync(manifestPath)) {
  console.error(`ERROR: falta ${manifestPath}`)
  process.exit(1)
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const failures = []
const expectedIds = new Set(manifest.commands?.map((entry) => entry.id) ?? [])
for (const entry of manifest.commands ?? []) {
  if (client === 'codex') continue
  const path = join(root, 'commands', `${entry.id}.md`)
  if (!existsSync(path)) { failures.push({ id: entry.id, reason: 'missing' }); continue }
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex')
  if (actual !== entry.sha256) failures.push({ id: entry.id, reason: 'hash', expected: entry.sha256, actual })
}
if (client !== 'codex' && existsSync(join(root, 'commands'))) {
  for (const file of readdirSync(join(root, 'commands'))) {
    if (file.endsWith('.md') && !expectedIds.has(file.slice(0, -3))) {
      failures.push({ id: file, reason: 'unexpected-command' })
    }
  }
}
if (client === 'codex' && !existsSync(join(root, 'skills', 'hops-commands', 'SKILL.md'))) {
  failures.push({ id: 'hops-commands', reason: 'missing-skill' })
}
const result = { client, output: root, commands: manifest.commands?.length ?? 0, failures, valid: failures.length === 0, mutations: 'none' }
console.log(JSON.stringify(result, null, 2))
process.exit(result.valid ? 0 : 1)
