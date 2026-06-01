#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const auditRoot = join(__dirname, '..');
const mdPath = join(auditRoot, 'pages-inventory.md');
const outPath = join(auditRoot, '_fixtures', 'inventory.json');

type Entry = {
    n: number;
    url: string;
    file: string;
    purpose: 'LIST' | 'VIEW' | 'EDIT' | 'CREATE' | 'DASHBOARD' | 'SETTINGS' | 'OTHER';
    entity: string;
    priority: 'critical' | 'standard';
    // Computed
    slug: string; // filename-safe, e.g. "users__id__edit"
    artifactDir: string; // relative dir under audits/spec-131/, e.g. "access"
};

const md = readFileSync(mdPath, 'utf8');
const lines = md.split('\n');

const entries: Entry[] = [];
for (const line of lines) {
    // Match table rows like: | 1 | `/dashboard` | `apps/...` | DASHBOARD | dashboard | critical |
    const m = line.match(
        /^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*(\w+)\s*\|\s*(\S+)\s*\|\s*(\w+)\s*\|/
    );
    if (!m) continue;

    const [, n, url, file, purpose, entity, priority] = m;

    // Convert URL to filename-safe slug.
    // Drop leading "/", replace "/" with "__", strip "$".
    const slug = url.replace(/^\//, '').replace(/\$/g, '').replace(/\//g, '__') || 'root';

    entries.push({
        n: Number(n),
        url,
        file,
        purpose: purpose as Entry['purpose'],
        entity,
        priority: priority as Entry['priority'],
        slug,
        artifactDir: entity
    });
}

writeFileSync(outPath, `${JSON.stringify(entries, null, 2)}\n`);
console.log(`Wrote ${entries.length} entries to ${outPath}`);
console.log(
    `Breakdown: critical=${entries.filter((e) => e.priority === 'critical').length}, standard=${entries.filter((e) => e.priority === 'standard').length}`
);
