import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * HOS-1641 (V6.9b) — listing fixtures carry their publication state.
 *
 * The accommodation and gastronomy JSON fixtures declare `publicationStatus`
 * instead of the old `lifecycleState` / `visibility` / `moderationState`
 * fields, which the structural migration drops from the listing tables. The
 * value is the one `0148_cut_paso_3` derives from the old pair (`ACTIVE` +
 * `PUBLIC` → `PUBLISHED`, anything else → `DRAFT`), so the seeded state does
 * not move. Nested `moderationState` keys (photos) are not listing columns and
 * are not checked here.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data');

const OLD_LISTING_KEYS = ['lifecycleState', 'visibility', 'moderationState'] as const;
const BIRTH_STATES = new Set(['PUBLISHED', 'DRAFT']);

/** Gastronomy fixtures whose old pair was not ACTIVE + PUBLIC (measured before HOS-1641). */
const DRAFT_GASTRONOMY_FIXTURES = new Set(['006-gastronomy-uruguay-bar-el-rinconcito.json']);

const listJsonFiles = (dir: string, recursive: boolean): string[] =>
    readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) return recursive ? listJsonFiles(path, true) : [];
        return entry.endsWith('.json') ? [path] : [];
    });

const readFixture = (path: string): Record<string, unknown> =>
    JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;

const ACCOMMODATION_FILES = listJsonFiles(join(DATA_DIR, 'accommodation'), true);
const GASTRONOMY_FILES = listJsonFiles(join(DATA_DIR, 'gastronomy'), false);

describe('listing fixtures declare publicationStatus (HOS-1641)', () => {
    it('finds the 104 accommodation and 6 gastronomy fixtures', () => {
        expect(ACCOMMODATION_FILES).toHaveLength(104);
        expect(GASTRONOMY_FILES).toHaveLength(6);
    });

    it.each(
        [...ACCOMMODATION_FILES, ...GASTRONOMY_FILES].map((path) => [
            relative(DATA_DIR, path),
            path
        ])
    )('%s: has a birth publicationStatus and none of the old listing keys', (_label, path) => {
        const fixture = readFixture(path);
        expect(BIRTH_STATES.has(fixture.publicationStatus as string)).toBe(true);
        for (const key of OLD_LISTING_KEYS) {
            expect(fixture).not.toHaveProperty(key);
        }
    });

    it('keeps every accommodation fixture PUBLISHED', () => {
        const states = ACCOMMODATION_FILES.map((path) => readFixture(path).publicationStatus);
        expect(new Set(states)).toEqual(new Set(['PUBLISHED']));
    });

    it.each(
        GASTRONOMY_FILES.map((path) => [path.split('/').pop() ?? path, path])
    )('%s: keeps the state its old pair implied', (file, path) => {
        const expected = DRAFT_GASTRONOMY_FIXTURES.has(file) ? 'DRAFT' : 'PUBLISHED';
        expect(readFixture(path).publicationStatus).toBe(expected);
    });
});
