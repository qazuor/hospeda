/**
 * Guard (HOS-1810): `publication_status` has ONE writer.
 *
 * The one-address rule must hold on every way into PUBLISHED: PB1 publish,
 * billing coverage restoration, a moderation lift. They all pass through
 * `listingPublicationModel.setPublicationStatus`, which carries the conflict
 * check (and the unique index is the backstop). A second writer would be a path
 * that skips it, so this fails when one appears.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../../../..');
const SOURCE_DIRS = [
    'packages/db/src',
    'packages/service-core/src',
    'packages/verticals/src',
    'apps/api/src'
];
const AUTHORIZED_WRITER = 'packages/db/src/models/listing/listing-publication.model.ts';

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return entry.name === 'migrations' ? [] : sourceFiles(path);
        return entry.isFile() && /\.ts$/.test(entry.name) ? [path] : [];
    });
}

describe('publication_status has one writer', () => {
    it('is written only by setPublicationStatus', () => {
        const violations: string[] = [];
        for (const dir of SOURCE_DIRS) {
            for (const path of sourceFiles(join(ROOT, dir))) {
                const name = relative(ROOT, path).replaceAll('\\', '/');
                if (name === AUTHORIZED_WRITER) continue;
                const content = readFileSync(path, 'utf8');
                const rawWrite = /\bSET\s+publication_status\b/i.test(content);
                const drizzleWrite = /\.set\s*\(\s*\{[^}]*\bpublicationStatus\b/s.test(content);
                if (rawWrite || drizzleWrite) violations.push(name);
            }
        }
        expect(violations).toEqual([]);
    });

    it('detects the patterns it forbids (positive control)', () => {
        expect(
            /\bSET\s+publication_status\b/i.test('UPDATE venues SET publication_status = $1')
        ).toBe(true);
        expect(
            /\.set\s*\(\s*\{[^}]*\bpublicationStatus\b/s.test(
                'db.update(t).set({ publicationStatus: x })'
            )
        ).toBe(true);
    });
});
