/**
 * HOS-803 — the born-featured cover path has exactly ONE implementation.
 *
 * ## Why this is a static guard
 *
 * The behaviour it protects is already covered behaviourally: the primitive's
 * own suite proves the cap arithmetic and the write ordering, and each
 * vertical's suite proves its wiring. What none of those can see is a SIXTH
 * vertical arriving next quarter with its own hand-rolled `addXFeaturedMedia`
 * that inserts `isFeatured: true` directly.
 *
 * That copy would pass every test anyone thought to write for it, because the
 * two things it would get wrong are invisible from inside one vertical:
 *
 *  1. **The cap waiver stops being earned.** The waiver is sound only because
 *     the row is created featured inside a transaction, so the partial unique
 *     index bounds the number of quota-exempt rows at one. A create that sets
 *     the flag outside that path has no such bound.
 *  2. **The previous cover leaks into the gallery.** A vertical writing its own
 *     create will reach for the demote it can see in `setFeaturedMedia`, and on
 *     the UPLOAD path that adds one gallery row per replacement — walking past
 *     the cap one cover-swap at a time. The old cover must be DELETED here, not
 *     demoted, and that difference is invisible from inside one vertical.
 *
 * So the guard asserts the structural facts those depend on: every site in
 * `service-core` matching the LITERAL `isFeatured: true` is classified as a
 * create, a promotion or a read filter, and every featured-media entry point
 * routes through the shared primitive.
 *
 * ## Exactly what this does and does not cover
 *
 * The sweep is a literal-text match. It sees `isFeatured: true` and nothing
 * else — NOT `isFeatured: flag`, NOT `{ ...base, isFeatured }`, NOT
 * `isFeatured: true as boolean`, NOT ``sql`true``` and NOT raw SQL. So it
 * cannot claim that a new featured-create is impossible to add silently; a
 * determined or merely indirect one walks past it.
 *
 * What it does claim is narrower and still worth having: **no site written the
 * obvious way is unclassified**. That is the form a copy-paste of the existing
 * code takes, which is the realistic way a sixth vertical would arrive.
 *
 * It also does NOT claim there is literally one create — there are two, and the
 * second (the legacy JSONB mirror) is exempt for a stated reason.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SERVICE_CORE_SRC = resolve(__dirname, '../../../src');

/** The shared adapter — the only quota-bearing create of a featured row. */
const PORT_FILE = 'services/media/owned-media-featured-port.ts';

/**
 * Every entry point that registers a cover, and therefore must delegate.
 *
 * Pinned as a list rather than discovered, so that ADDING a vertical is a
 * deliberate edit here: a new `addXFeaturedMedia` that nobody adds to this list
 * still gets caught by the `isFeatured: true` sweep below.
 */
const FEATURED_ENTRY_POINTS: ReadonlyArray<{ readonly file: string; readonly fn: string }> = [
    { file: 'services/accommodation/accommodation.service.ts', fn: 'addFeaturedMedia' },
    { file: 'services/gastronomy/gastronomy.media.ts', fn: 'addGastronomyFeaturedMedia' },
    { file: 'services/experience/experience.media.ts', fn: 'addExperienceFeaturedMedia' }
];

/** Strips block comments and whole-line `//` comments so prose never counts. */
function stripComments(source: string): string {
    const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, '');
    return withoutBlocks
        .split('\n')
        .map((line) => (line.trim().startsWith('//') ? '' : line))
        .join('\n');
}

function readSource(relativePath: string): string {
    return stripComments(readFileSync(join(SERVICE_CORE_SRC, relativePath), 'utf-8'));
}

/** Every `.ts` file under `src/`, as paths relative to `src/`. */
function allSourceFiles(dir: string = SERVICE_CORE_SRC): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...allSourceFiles(full));
        } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
            out.push(relative(SERVICE_CORE_SRC, full));
        }
    }
    return out;
}

/**
 * Every place in `service-core` that writes `isFeatured: true`, classified.
 *
 * Set equality, not a subset check: a NEW site fails this test and has to be
 * classified by a human, which is the entire point. The three kinds are not
 * interchangeable —
 *
 *  - `create-cover`   — inserts a row that is featured. Only the shared port may
 *                       do this on the quota-bearing path; a second one would
 *                       mean a second set of cap rules.
 *  - `promote`        — updates an EXISTING row. Harmless: the row was already
 *                       counted against the gallery, so promoting it moves no
 *                       totals. This is `setFeaturedMedia`, once per vertical.
 *  - `read-filter`    — a `where` clause. Writes nothing.
 */
const FEATURED_TRUE_SITES: ReadonlyArray<{
    readonly file: string;
    readonly kind: 'create-cover' | 'promote' | 'read-filter';
    readonly why: string;
}> = [
    {
        file: 'services/media/owned-media-featured-port.ts',
        kind: 'create-cover',
        why: 'THE quota-bearing cover create, shared by every vertical (HOS-803).'
    },
    {
        file: 'services/accommodation/accommodation.media-sync.ts',
        kind: 'create-cover',
        why: 'A different mechanism, not a second copy of this one: the replace-all mirror of the legacy accommodations.media JSONB column, which hard-deletes every row and re-inserts the whole set from the payload. It moves no quota because it does not add a photo — it rewrites the rows for photos the JSONB already held.'
    },
    {
        file: 'services/accommodation/accommodation.service.ts',
        kind: 'promote',
        why: 'setFeaturedMedia — promotes a row that already exists.'
    },
    {
        file: 'services/gastronomy/gastronomy.media.ts',
        kind: 'promote',
        why: 'setFeaturedGastronomyMedia — promotes a row that already exists.'
    },
    {
        file: 'services/experience/experience.media.ts',
        kind: 'promote',
        why: 'setFeaturedExperienceMedia — promotes a row that already exists.'
    },
    {
        file: 'services/post/post.media.ts',
        kind: 'promote',
        why: 'setFeaturedPostMedia — promotes a row that already exists.'
    },
    {
        file: 'services/event/event.media.ts',
        kind: 'promote',
        why: 'setFeaturedEventMedia — promotes a row that already exists.'
    },
    {
        file: 'services/post/post.service.ts',
        kind: 'read-filter',
        why: 'getFeaturedPosts builds `where = { isFeatured: true }`. A read.'
    }
];

describe('HOS-803 — one implementation of the born-featured cover path', () => {
    it('has no unclassified isFeatured: true site anywhere in service-core', () => {
        const found = allSourceFiles()
            .filter((file) => /isFeatured:\s*true/.test(readSource(file)))
            .sort();

        const classified = FEATURED_TRUE_SITES.map((s) => s.file).sort();

        // If this fails with a NEW file, decide which kind it is. A `promote`
        // or `read-filter` is fine — add it here. A `create-cover` is not:
        // route it through `addFeaturedMediaRow` instead, or the gallery cap
        // acquires a second, unsynchronised set of rules.
        expect(found).toEqual(classified);
    });

    it('has exactly one quota-bearing cover create', () => {
        const covers = FEATURED_TRUE_SITES.filter((s) => s.kind === 'create-cover');

        // media-sync is the second create, and is exempt for a stated reason:
        // it rewrites rows for photos that already exist rather than adding one.
        expect(covers.map((s) => s.file)).toContain('services/media/owned-media-featured-port.ts');
        expect(covers).toHaveLength(2);
    });

    it.each(
        FEATURED_ENTRY_POINTS
    )('$fn delegates to the shared primitive instead of re-deriving the rules', ({ file, fn }) => {
        const whole = readSource(file);

        expect(whole).toContain(fn);

        // Slice to the function, not the file. `accommodation.service.ts` is
        // ~4,700 lines and imports the primitive near the top, so a whole-file
        // `toContain` would stay green while `addFeaturedMedia` itself was
        // rewritten by hand — the exact blind spot this guard exists to cover.
        const start = whole.indexOf(fn);
        const source = whole.slice(start, start + 3000);
        // Both halves: the policy (addFeaturedMediaRow) and the adapter
        // (buildOwnedMediaFeaturedPort). A vertical that imported only the
        // adapter would still be writing its own cap arithmetic.
        expect(source).toContain('addFeaturedMediaRow');
        expect(source).toContain('buildOwnedMediaFeaturedPort');
    });

    it('keeps the release-then-create order in the primitive', () => {
        const source = readSource('services/media/add-featured-media.ts');

        const deleteAt = source.indexOf('port.deletePrevious(');
        const createAt = source.indexOf('port.createFeatured(');

        expect(deleteAt).toBeGreaterThan(-1);
        expect(createAt).toBeGreaterThan(-1);

        // Inserting the new cover before releasing the old one would leave two
        // live rows with is_featured = true, which the partial unique index
        // rejects.
        expect(createAt).toBeGreaterThan(deleteAt);
    });

    it('releases the outgoing cover by clearing the flag AND soft-deleting it', () => {
        const source = readSource(PORT_FILE);

        const body = source.slice(
            source.indexOf('deletePrevious:'),
            source.indexOf('createFeatured:')
        );

        // TWO writes, both required (HOS-803 C-1).
        //
        // `softDelete` patches only the timestamps and the actor, so on its own
        // it leaves the row carrying `is_featured = true`. The partial unique
        // index ignores deleted rows and `findById` does not filter them, so
        // that row stays a promotable target — re-featuring it demotes the LIVE
        // cover into the gallery for a row that no longer exists.
        //
        // The `isFeatured: false` here is therefore REQUIRED, and this
        // expectation is the inverse of what it was before C-1 was found: the
        // earlier version forbade the literal outright, on the theory that any
        // occurrence meant a demote had crept in. It is written as a separate
        // `update` rather than folded into a literal patch alongside
        // `deletedAt`, because such a literal would trip check 3 of
        // scripts/check-soft-delete-actor.ts.
        expect(body).toMatch(/mediaModel\.update\(/);
        expect(body).toMatch(/isFeatured:\s*false/);
        expect(body).toMatch(/mediaModel\.softDelete\(/);

        // Order: the flag must be cleared before, or at worst with, the delete —
        // never after, which would leave a window where the row is deleted and
        // still flagged.
        expect(body.indexOf('mediaModel.update(')).toBeLessThan(
            body.indexOf('mediaModel.softDelete(')
        );

        // Still ruled out: archiving the old cover instead of removing it, the
        // design this replaced.
        expect(body).not.toMatch(/state:\s*'archived'/);
    });

    it('checks deletedAt in every setFeatured, so a released cover cannot be revived', () => {
        // The other half of C-1. `findById` returns soft-deleted rows, so each
        // setFeatured must reject them explicitly — `updateMedia` always did,
        // these three did not. Behaviour is covered by
        // `accommodation/featured-media-deleted-row-revival.test.ts`; this
        // pins the two commerce twins, which have no equivalent suite.
        const SET_FEATURED_SITES: ReadonlyArray<{ file: string; fn: string }> = [
            {
                file: 'services/accommodation/accommodation.service.ts',
                fn: 'public async setFeaturedMedia('
            },
            {
                file: 'services/gastronomy/gastronomy.media.ts',
                fn: 'export async function setFeaturedGastronomyMedia('
            },
            {
                file: 'services/experience/experience.media.ts',
                fn: 'export async function setFeaturedExperienceMedia('
            }
        ];

        for (const site of SET_FEATURED_SITES) {
            const whole = readSource(site.file);
            const start = whole.indexOf(site.fn);
            expect(start).toBeGreaterThan(-1);
            const body = whole.slice(start, start + 2500);

            expect(body).toMatch(/mediaRow\.deletedAt/);
        }
    });

    it('does not consult any gallery count — the swap is quota-neutral', () => {
        const source = readSource('services/media/add-featured-media.ts');

        // One row into the featured slot, one out of the table. A count
        // reappearing here means someone has reintroduced a disposition
        // decision, and with it the branch that could keep the old cover.
        expect(source).not.toMatch(/countVisibleGallery/);
        expect(source).not.toMatch(/entityGalleryCap/);
    });
});
