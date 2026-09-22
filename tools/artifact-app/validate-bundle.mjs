import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) { console.error('usage: node validate-bundle.mjs <bundle.json>'); process.exitCode = 2; }
else {
  try {
    const b = JSON.parse(readFileSync(file, 'utf8'))
    const errors = []
    const fail = (ok, msg) => { if (!ok) errors.push(msg) }
    fail(b && typeof b === 'object' && !Array.isArray(b), 'bundle must be an object')
    fail(b?.schemaVersion === 'artifact/v1', 'schemaVersion must be artifact/v1')
    fail(typeof b?.artifact?.slug === 'string' && /^[a-z0-9][a-z0-9-]{1,63}$/.test(b.artifact.slug), 'artifact.slug is invalid')
    fail(typeof b?.artifact?.title === 'string' && b.artifact.title.trim().length > 0, 'artifact.title is required')
    fail(b?.data && typeof b.data === 'object' && !Array.isArray(b.data), 'data must be an object')
    fail(b?.view && typeof b.view === 'object' && !Array.isArray(b.view), 'view must be an object')
    const allowedBlocks = new Set(['hero','prose','metricGrid','callout','table','timeline','checklist','form','diagram','code','links','accordion'])
    const sections = Array.isArray(b?.data?.sections) ? b.data.sections : []
    for (const [i, section] of sections.entries()) {
      fail(section && typeof section === 'object' && allowedBlocks.has(section.type), `data.sections[${i}].type is not allowed`)
      fail(typeof section?.id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(section.id), `data.sections[${i}].id is invalid`)
      fail(!JSON.stringify(section).match(/<\/?(script|iframe|object|embed|form)\b/i), `data.sections[${i}] contains forbidden markup`)
      fail(!JSON.stringify(section).match(/(?:javascript:|data:text\/html|https?:\/\/)/i), `data.sections[${i}] contains external or executable URL`)
    }
    const serialized = JSON.stringify(b)
    fail(!/(?:api[_-]?key|secret|password|token|private[_-]?key|authorization)\s*[:=]/i.test(serialized), 'bundle contains a credential-shaped key')
    fail(serialized.length <= 2_000_000, 'bundle exceeds 2 MiB')
    if (errors.length) { console.error(errors.map(e => `INVALID: ${e}`).join('\n')); process.exitCode = 1 }
    else console.log(`VALID artifact/v1: ${b.artifact.slug}`)
  } catch (e) { console.error(`INVALID: ${e.message}`); process.exitCode = 1 }
}
