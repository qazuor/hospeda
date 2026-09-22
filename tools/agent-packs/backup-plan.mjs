#!/usr/bin/env node
/** Read-only inventory of paths that a future installer must back up. */
import { existsSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const root = resolve(dirname(new URL(import.meta.url).pathname), '../..')
const home = process.env.HOME || '~'
const paths = [
  `${home}/.config/opencode`,
  `${home}/.claude`,
  `${home}/.codex`,
  `${home}/.engram`,
  `${home}/.local/share/opencode`,
  `${home}/.local/state/hospeda-opencode-migration`,
  resolve(root, '.opencode'),
  resolve(root, '.qz'),
  resolve(root, 'AGENTS.md'),
  resolve(root, '.specs'),
  resolve(root, '.qtm'),
  resolve(root, 'scripts/client-tools')
]
const entries = paths.map((path) => {
  if (!existsSync(path)) return { path, exists: false }
  const stat = statSync(path)
  return { path, exists: true, type: stat.isDirectory() ? 'directory' : 'file', bytes: stat.size }
})
console.log(JSON.stringify({
  mode: 'read-only',
  entries,
  secretValues: 'not-read',
  mutations: 'none',
  requiredBeforeApply: ['filesystem-space', 'checksums', 'backup-copy', 'backup-verification', 'rollback-manifest']
}, null, 2))
