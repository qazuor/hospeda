#!/usr/bin/env node
/**
 * Render a command pack into an explicit staging directory.
 * This is deliberately not an installer: it never chooses global paths.
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'

const root = resolve(dirname(new URL(import.meta.url).pathname), '../..')
const manifest = JSON.parse(readFileSync(resolve(root, 'tools/agent-packs/hops-command-manifest.json'), 'utf8'))
const args = process.argv.slice(2)
const value = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
if (args.includes('--help') || args.length === 0) {
  console.log('Usage: node tools/agent-packs/render.mjs --client <opencode|claude|codex> --output <dir>')
  console.log('Writes only to the explicit output directory; never writes global paths.')
  process.exit(args.length === 0 ? 2 : 0)
}
const client = value('--client')
const output = value('--output')
if (!['opencode', 'claude', 'codex'].includes(client) || !output) {
  console.error('ERROR: --client y --output son obligatorios; no hay destino implícito.')
  process.exit(2)
}
const destination = resolve(output)
const force = args.includes('--force')
if (existsSync(destination) && readdirSync(destination, { withFileTypes: true }).length && !force) {
  console.error(`ERROR: destino no vacío: ${destination}; usá --force de forma explícita.`)
  process.exit(3)
}
mkdirSync(destination, { recursive: true })
const sourceDir = resolve(root, '.opencode/commands')
const commandNames = manifest.commands.map((entry) => entry.id)

if (client === 'opencode' || client === 'claude') {
  const commandsDir = join(destination, 'commands')
  mkdirSync(commandsDir, { recursive: true })
  for (const name of commandNames) cpSync(join(sourceDir, `${name}.md`), join(commandsDir, `${name}.md`))
  writeFileSync(join(destination, 'manifest.json'), JSON.stringify({ manifestId: manifest.manifestId, client, commands: commandNames }, null, 2) + '\n')
} else {
  const skillDir = join(destination, 'skills', 'hops-commands')
  mkdirSync(skillDir, { recursive: true })
  writeFileSync(join(skillDir, 'SKILL.md'), `---\nname: hops-commands\ndescription: Usa los comandos deterministas de Hospeda mediante los wrappers Hops.\n---\n\nLa fuente de verdad y el catálogo están en \`manifest.json\`. Ejecutá el wrapper Hops correspondiente antes de razonar sobre estado local. No inventes resultados ni ejecutes mutaciones sensibles sin autorización.\n`)
  writeFileSync(join(destination, 'manifest.json'), JSON.stringify({ manifestId: manifest.manifestId, client, commands: commandNames }, null, 2) + '\n')
}
console.log(JSON.stringify({ client, output: destination, commands: commandNames.length, mutations: [destination] }, null, 2))
