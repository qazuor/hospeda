#!/usr/bin/env tsx
/**
 * SPEC-119 lint — Check that every URL used by accommodation seed JSONs
 * belongs to its type's pool in `_image-pool.ts`.
 *
 * Walks all 104 accommodation JSONs under
 * `packages/seed/src/data/accommodation/<destination>/`, collects every URL
 * from `media.featuredImage` and `media.gallery[]`, and verifies it appears
 * in `IMAGE_POOL_BY_TYPE[accommodation.type]`. Exits non-zero on any miss.
 *
 * Run via `pnpm --filter @repo/seed lint:image-pool` or directly through tsx.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMAGE_POOL_BY_TYPE } from '../src/data/accommodation/_image-pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data', 'accommodation');

type Offender = { file: string; type: string; field: string; url: string };

const collectOffenders = (): Offender[] => {
    const offenders: Offender[] = [];
    for (const dest of readdirSync(DATA_DIR, { withFileTypes: true })) {
        if (!dest.isDirectory()) continue;
        if (dest.name.startsWith('_')) continue;
        const folder = join(DATA_DIR, dest.name);
        for (const entry of readdirSync(folder, { withFileTypes: true })) {
            if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
            const filePath = join(folder, entry.name);
            const json = JSON.parse(readFileSync(filePath, 'utf8')) as {
                type: string;
                media?: {
                    featuredImage?: { url: string };
                    gallery?: { url: string }[];
                };
            };
            const pool = IMAGE_POOL_BY_TYPE[json.type as keyof typeof IMAGE_POOL_BY_TYPE];
            if (!pool) {
                offenders.push({
                    file: entry.name,
                    type: json.type,
                    field: 'type',
                    url: '(no pool for this type)'
                });
                continue;
            }
            const poolUrls = new Set(pool.map((p) => p.url));
            const featured = json.media?.featuredImage?.url;
            if (featured && !poolUrls.has(featured)) {
                offenders.push({
                    file: entry.name,
                    type: json.type,
                    field: 'media.featuredImage.url',
                    url: featured
                });
            }
            (json.media?.gallery ?? []).forEach((g, idx) => {
                if (!poolUrls.has(g.url)) {
                    offenders.push({
                        file: entry.name,
                        type: json.type,
                        field: `media.gallery[${idx}].url`,
                        url: g.url
                    });
                }
            });
        }
    }
    return offenders;
};

const offenders = collectOffenders();
if (offenders.length === 0) {
    console.log('OK: every accommodation seed URL is a member of its type pool.');
    process.exit(0);
}
console.error(`FAIL: ${offenders.length} URL(s) missing from their type pool:`);
for (const o of offenders) {
    console.error(`  ${o.file} [${o.type}] ${o.field}: ${o.url}`);
}
process.exit(1);
