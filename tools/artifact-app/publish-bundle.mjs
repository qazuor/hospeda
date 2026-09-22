import { readFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

const input = process.argv[2]
if (!input) throw new Error('usage: node publish-bundle.mjs <bundle.json>')
const bundle = JSON.parse(readFileSync(input, 'utf8'))
if (bundle?.schemaVersion !== 'artifact/v1' || !bundle.artifact?.slug || !bundle.artifact?.title || !bundle.data || !bundle.view) throw new Error('invalid artifact/v1 bundle')
const dir = process.env.ARTIFACT_DATA_DIR || join(homedir(), '.local', 'share', 'opencode-artifacts')
mkdirSync(dir, { recursive: true })
const db = new DatabaseSync(join(dir, 'artifacts.sqlite'))
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS artifacts (id TEXT PRIMARY KEY, project TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, latest_version INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS versions (artifact_id TEXT NOT NULL, version INTEGER NOT NULL, bundle_json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (artifact_id, version)); CREATE TABLE IF NOT EXISTS events (event_id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL, version INTEGER NOT NULL, type TEXT NOT NULL, payload_json TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);`)
const timestamp = new Date().toISOString()
let artifact = db.prepare('SELECT * FROM artifacts WHERE slug=?').get(bundle.artifact.slug)
if (!artifact) {
  const id = bundle.artifact.id || `art_${randomUUID()}`
  db.prepare('INSERT INTO artifacts VALUES (?,?,?,?,?,?,?)').run(id, bundle.artifact.project || 'default', bundle.artifact.slug, bundle.artifact.title, timestamp, timestamp, 0)
  artifact = db.prepare('SELECT * FROM artifacts WHERE id=?').get(id)
}
const version = artifact.latest_version + 1
const normalized = { ...bundle, artifact: { ...bundle.artifact, id: artifact.id }, version: { ...bundle.version, id: `ver_${randomUUID()}`, number: version, createdAt: timestamp, basedOnVersion: artifact.latest_version || null, sourceHash: bundle.version?.sourceHash || `sha256:${createHash('sha256').update(JSON.stringify(bundle.data)).digest('hex')}` } }
db.prepare('INSERT INTO versions VALUES (?,?,?,?)').run(artifact.id, version, JSON.stringify(normalized), timestamp)
db.prepare('UPDATE artifacts SET title=?,updated_at=?,latest_version=? WHERE id=?').run(normalized.artifact.title, timestamp, version, artifact.id)
console.log(JSON.stringify({ artifactId: artifact.id, slug: artifact.slug, version, url: `http://127.0.0.1:${process.env.ARTIFACT_PORT || 4317}/artifacts/${artifact.slug}` }, null, 2))
