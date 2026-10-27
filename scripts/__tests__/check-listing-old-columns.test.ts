import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
    EXCLUSIONS_FILE,
    findListingOldColumnReads,
    isScannedPath,
    type ListingOldColumnExclusions,
    main
} from '../check-listing-old-columns.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const NO_EXCLUSIONS: ListingOldColumnExclusions = {
    subEntityFilePatterns: [],
    subEntityReferences: [],
    files: []
};

function scan(file: string, content: string, exclusions = NO_EXCLUSIONS) {
    return findListingOldColumnReads({ files: [{ file, content }], exclusions });
}

describe('TEST:V6:18 AC:V6:32 no file reads the six old listing columns', () => {
    it('TEST:1813:6 AC:1:15 scans the moved venue schema path', () => {
        const file = 'packages/schemas/src/entities/venue/venue.crud.schema.ts';
        expect(scan(file, 'const state = row.lifecycleState;')).toEqual([
            { file, line: 1, rule: 'listing-file', name: 'lifecycleState' }
        ]);
    });

    describe('(i) one case per rule', () => {
        it('(a) acc-only: an accommodation-only name fails anywhere', () => {
            expect(
                scan('apps/api/src/lib/anything.ts', '\nconst flag = row.ownerSuspended;')
            ).toEqual([
                {
                    file: 'apps/api/src/lib/anything.ts',
                    line: 2,
                    rule: 'acc-only',
                    name: 'ownerSuspended'
                }
            ]);
            expect(
                scan('packages/db/src/x.ts', "const c = 'billing_unpublished_at';")
            ).toContainEqual(
                expect.objectContaining({ rule: 'acc-only', name: 'billing_unpublished_at' })
            );
        });

        it('(b) drizzle: a listing table column fails outside listing paths', () => {
            expect(scan('apps/api/src/lib/indexnow.ts', 'eq(venues.visibility, x)')).toEqual([
                {
                    file: 'apps/api/src/lib/indexnow.ts',
                    line: 1,
                    rule: 'drizzle',
                    name: 'visibility'
                }
            ]);
        });

        it('(c) sql: a raw SQL string over a listing table fails, naming file and line', () => {
            const content = [
                "import { sql } from 'drizzle-orm';",
                'const q = sql`SELECT id FROM accommodations',
                "    WHERE lifecycle_state = 'ACTIVE'`;"
            ].join('\n');
            expect(scan('apps/api/src/lib/report.ts', content)).toEqual([
                {
                    file: 'apps/api/src/lib/report.ts',
                    line: 3,
                    rule: 'sql',
                    name: 'lifecycle_state'
                }
            ]);
        });

        it('(c) sql: the same text inside a comment does not fail', () => {
            const content = [
                "// SELECT id FROM accommodations WHERE lifecycle_state = 'ACTIVE'",
                "/* SELECT id FROM accommodations WHERE lifecycle_state = 'ACTIVE' */",
                'const ok = true;'
            ].join('\n');
            expect(scan('apps/api/src/lib/report.ts', content)).toEqual([]);
        });

        it('(c) sql: prose that names the table and the word visibility is not SQL', () => {
            expect(
                scan(
                    'apps/admin/src/config/tour.ts',
                    "const t = 'Edit your accommodations and their visibility.';"
                )
            ).toEqual([]);
        });

        it('(c) sql: the sub-entity table accommodation_media is not a listing table', () => {
            const content =
                'sql`INSERT INTO accommodation_media (url, moderation_state) VALUES (1, 2)`';
            expect(scan('apps/e2e/tests/verticals/upload.spec.ts', content)).toEqual([]);
        });

        it('(d) listing-file: an old name in a listing path fails, as code or string key', () => {
            const file = 'apps/admin/src/features/accommodations/config/accommodations.config.ts';
            expect(scan(file, "const c = { accessorKey: 'lifecycleState' };")).toEqual([
                { file, line: 1, rule: 'listing-file', name: 'lifecycleState' }
            ]);
            const model = 'packages/db/src/models/accommodation/accommodation.model.ts';
            expect(scan(model, "where(sql`lifecycle_state = 'ACTIVE'`)")).toEqual([
                { file: model, line: 1, rule: 'listing-file', name: 'lifecycle_state' }
            ]);
        });

        it('(d) listing-file: the same name outside a listing path is not a listing read', () => {
            expect(scan('apps/api/src/routes/post/list.ts', 'post.lifecycleState')).toEqual([]);
        });

        it('(d) listing-file: a module specifier is a path, not a read', () => {
            const content = "import { f } from '../../utils/listing-faq-visibility';";
            expect(scan('apps/api/src/routes/venue/public/getById.ts', content)).toEqual([]);
        });
    });

    describe('(ii) seed JSON fixtures', () => {
        const fixture = 'packages/seed/src/data/gastronomy/001-parrilla.json';

        it('a moderationState nested in media is the photo and does not fail', () => {
            const content = JSON.stringify(
                {
                    id: 'g1',
                    publicationStatus: 'PUBLISHED',
                    media: { gallery: [{ moderationState: 'APPROVED' }] }
                },
                null,
                4
            );
            expect(scan(fixture, content)).toEqual([]);
        });

        it('a moderationState at the listing level fails with its line', () => {
            const content = JSON.stringify({ id: 'g1', moderationState: 'APPROVED' }, null, 4);
            expect(scan(fixture, content)).toEqual([
                { file: fixture, line: 3, rule: 'listing-file', name: 'moderationState' }
            ]);
        });

        it('scans only the two listing fixture folders and never migration history', () => {
            expect(isScannedPath({ file: fixture }).scanned).toBe(true);
            expect(
                isScannedPath({ file: 'packages/seed/src/data/accommodation/destinations/a.json' })
                    .scanned
            ).toBe(true);
            expect(isScannedPath({ file: 'packages/seed/src/data/post/a.json' }).scanned).toBe(
                false
            );
            expect(
                isScannedPath({ file: 'packages/db/src/migrations/0148_cut_paso_3.sql' }).scanned
            ).toBe(false);
            expect(
                isScannedPath({ file: 'packages/db/src/migrations/meta/helper.ts' }).scanned
            ).toBe(false);
            expect(isScannedPath({ file: 'apps/api/docs/route-architecture.md' }).scanned).toBe(
                false
            );
            expect(isScannedPath({ file: 'scripts/check-listing-clock.ts' }).scanned).toBe(true);
        });
    });

    describe('(iii) the closed exclusion list', () => {
        const mediaFile = 'apps/web/src/components/listing/editor/MediaSection.client.tsx';
        const mediaPattern = {
            pattern: 'media',
            table: 'accommodation_media',
            reason: 'photo state'
        };

        it('a sub-entity pattern switches off rule (d) only', () => {
            const exclusions = { ...NO_EXCLUSIONS, subEntityFilePatterns: [mediaPattern] };
            expect(scan(mediaFile, 'item.moderationState', exclusions)).toEqual([]);
            expect(scan(mediaFile, 'accommodations.moderationState', exclusions)).toEqual([
                { file: mediaFile, line: 1, rule: 'drizzle', name: 'moderationState' }
            ]);
        });

        it('a dead pattern, file or counted reference fails', () => {
            const exclusions: ListingOldColumnExclusions = {
                subEntityFilePatterns: [mediaPattern],
                subEntityReferences: [
                    {
                        file: 'apps/api/src/routes/accommodation/x.ts',
                        name: 'lifecycleState',
                        count: 1,
                        table: 't',
                        reason: 'r'
                    }
                ],
                files: [{ file: 'packages/db/test/integration/gone.test.ts', reason: 'r' }]
            };
            const violations = findListingOldColumnReads({ files: [], exclusions });
            expect(violations.map(({ file, rule }) => `${file} ${rule}`)).toEqual([
                `${EXCLUSIONS_FILE} dead-exclusion`,
                `${EXCLUSIONS_FILE} dead-exclusion`,
                `${EXCLUSIONS_FILE} dead-exclusion`
            ]);
        });

        it('a counted reference allows exactly its count and fails on one more', () => {
            const file = 'packages/db/src/models/accommodation/accommodation.model.ts';
            const exclusions = {
                ...NO_EXCLUSIONS,
                subEntityReferences: [
                    { file, name: 'lifecycleState', count: 1, table: 'users', reason: 'owner' }
                ]
            };
            expect(scan(file, 'owner: { lifecycleState: true }', exclusions)).toEqual([]);
            expect(
                scan(
                    file,
                    'owner: { lifecycleState: true }\nwhere: eq(t.lifecycleState, x)',
                    exclusions
                )
            ).toHaveLength(2);
        });
    });

    it('(iv) the real tree has zero violations', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            expect(main()).toEqual({ exitCode: 0 });
            expect(log).toHaveBeenCalledWith(expect.stringContaining('OK:'));
            expect(error).not.toHaveBeenCalled();
        } finally {
            log.mockRestore();
            error.mockRestore();
        }
    });

    it('(v) is wired into check:guards and the guards CI job', () => {
        const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
            scripts: Record<string, string>;
        };
        expect(pkg.scripts['check:listing-old-columns']).toBe(
            'tsx scripts/check-listing-old-columns.ts'
        );
        const guards = pkg.scripts['check:guards'] ?? '';
        const own = guards.indexOf('pnpm check:listing-old-columns');
        expect(own).toBeGreaterThan(-1);
        expect(own).toBeLessThan(guards.indexOf('pnpm check:role-never-decides'));
        expect(guards.trimEnd().endsWith('pnpm check:fake-lies')).toBe(true);
        const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
        const step = ci.indexOf('run: pnpm check:listing-old-columns');
        expect(step).toBeGreaterThan(ci.indexOf('run: pnpm check:listing-delete-doors'));
    });
});
