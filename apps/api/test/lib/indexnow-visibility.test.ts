/**
 * @fileoverview
 * The IndexNow visibility check (HOS-585 AC-4).
 *
 * The check is what stops an unpublished page from being announced. Two
 * distinct things can break it, and only one of them is obvious:
 *
 * 1. A seventh entity type becomes notifiable and is not added here — that type
 *    is then silently refused and stops being announced entirely.
 * 2. One lookup's WHERE clause loses a condition. This is the dangerous one:
 *    the query still runs, still returns a row, and unpublished pages go out to
 *    Bing while every coverage-shaped test stays green. A first version of this
 *    file asserted only (1), and deleting `lifecycleState`/`visibility` from
 *    the accommodation lookup did NOT turn it red.
 *
 * **Why (2) is a source-level guard and not a query assertion.** `test/setup.ts`
 * replaces `@repo/db` wholesale for every suite in this app, and its
 * `accommodations` stub is `{ id: 'id', deletedAt: 'deleted_at', ... }` — plain
 * strings, without even a `slug`. Any runtime inspection here would be
 * describing that stub rather than the real Drizzle condition, which is a test
 * that passes while proving nothing. The six lookups are near-identical blocks
 * where the realistic defect is a missing line, and that is precisely what a
 * source guard sees.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    isEntityPubliclyVisible,
    VISIBILITY_CHECKED_ENTITY_TYPES
} from '../../src/lib/indexnow-visibility';

const SOURCE = readFileSync(resolve(__dirname, '../../src/lib/indexnow-visibility.ts'), 'utf8');

/** Must stay identical to `NOTIFIABLE_ENTITY_TYPES` in apps/web. */
const NOTIFIABLE_ENTITY_TYPES = [
    'accommodation',
    'destination',
    'event',
    'post',
    'gastronomy',
    'experience'
] as const;

/** The Drizzle table each entity type reads, as written in the source. */
const TABLE_OF: Readonly<Record<(typeof NOTIFIABLE_ENTITY_TYPES)[number], string>> = {
    accommodation: 'accommodations',
    destination: 'destinations',
    event: 'events',
    post: 'posts',
    gastronomy: 'gastronomies',
    experience: 'experiences'
};

/**
 * The text of one entity type's lookup: from its key to the start of the next
 * one (or the end of the map).
 *
 * Slicing per block matters — asserting against the whole file would pass as
 * long as SOME lookup carried a condition, which is exactly the "one of six
 * blocks lost a line" defect this guard exists for.
 */
function lookupBlock(entityType: string): string {
    const start = SOURCE.indexOf(`\n    ${entityType}: async (slug) =>`);
    expect(start, `no lookup block found for ${entityType}`).toBeGreaterThan(-1);

    const rest = SOURCE.slice(start + 1);
    const nextKey = rest.search(/\n {4}[a-zA-Z]+: async \(slug\) =>/);
    const endOfMap = rest.indexOf('\n};');
    const end = nextKey === -1 ? endOfMap : Math.min(nextKey, endOfMap);

    return rest.slice(0, end === -1 ? undefined : end);
}

describe('IndexNow visibility sources', () => {
    it('covers every notifiable entity type, and nothing else', () => {
        // A frozen literal, not an import: NOTIFIABLE_ENTITY_TYPES lives in
        // apps/web and the API cannot reach it, so this is deliberately the
        // second half of a cross-package contract.
        expect([...VISIBILITY_CHECKED_ENTITY_TYPES].sort()).toEqual(
            [...NOTIFIABLE_ENTITY_TYPES].sort()
        );
    });

    /**
     * All four conditions are load-bearing: `slug` addresses the row,
     * `lifecycleState` + `visibility` are the pair that makes a page public
     * (the same pair `AccommodationService._isPubliclyVisible` and
     * `isCommerceListingPubliclyVisible` use), and `deletedAt` catches a soft
     * delete those two never see because their callers hold a live row.
     */
    it.each(
        NOTIFIABLE_ENTITY_TYPES
    )('%s filters on slug + lifecycle + visibility + soft-delete', (entityType) => {
        const table = TABLE_OF[entityType];
        const block = lookupBlock(entityType);

        expect(block, `${entityType}: missing slug filter`).toContain(`eq(${table}.slug, slug)`);
        expect(block, `${entityType}: missing lifecycle filter`).toContain(
            `eq(${table}.lifecycleState, ACTIVE)`
        );
        expect(block, `${entityType}: missing visibility filter`).toContain(
            `eq(${table}.visibility, PUBLIC)`
        );
        expect(block, `${entityType}: missing soft-delete filter`).toContain(
            `isNull(${table}.deletedAt)`
        );
    });

    it('binds ACTIVE and PUBLIC to the shared enums, not to string literals', () => {
        // A literal would drift silently if either enum were ever renamed.
        expect(SOURCE).toContain('const ACTIVE = LifecycleStatusEnum.ACTIVE;');
        expect(SOURCE).toContain('const PUBLIC = VisibilityEnum.PUBLIC;');
    });

    it('slices one block per entity type (the guard is not reading the whole file)', () => {
        // Without this, a block-slicing bug would make every assertion above
        // run against the entire source and pass on any single lookup.
        const block = lookupBlock('post');

        expect(block).toContain('posts.slug');
        expect(block).not.toContain('accommodations.slug');
        expect(block).not.toContain('experiences.slug');
    });

    it('refuses an entity type it has no source for, instead of assuming public', async () => {
        // Reaches no database: the type is rejected before any lookup runs,
        // which is why this one assertion survives the global @repo/db mock.
        await expect(
            isEntityPubliclyVisible({ entityType: 'partner', slug: 'algun-partner' })
        ).resolves.toBe(false);
    });
});
