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
 *  2. **The previous cover leaks into the gallery.** Demoting it unconditionally
 *     adds one gallery row per replacement, which walks past the cap one
 *     cover-swap at a time. Getting that right requires the cap, and a vertical
 *     writing its own create will reach for the demote it can see in
 *     `setFeaturedMedia` rather than the disposition rule it cannot.
 *
 * So the guard asserts the structural facts those depend on: every site in
 * `service-core` that writes `isFeatured: true` is classified as a create, a
 * promotion or a read filter, and every featured-media entry point routes
 * through the shared primitive.
 *
 * It does NOT claim there is literally one such site — there are two creates,
 * and the second (the legacy JSONB mirror) is exempt for a stated reason. What
 * it claims is that no site is UNCLASSIFIED, which is the property that makes a
 * new one impossible to add silently.
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
        const source = readSource(file);

        expect(source).toContain(fn);
        // Both halves: the policy (addFeaturedMediaRow) and the adapter
        // (buildOwnedMediaFeaturedPort). A vertical that imported only the
        // adapter would still be writing its own cap arithmetic.
        expect(source).toContain('addFeaturedMediaRow');
        expect(source).toContain('buildOwnedMediaFeaturedPort');
    });

    it('keeps the clear-then-set order in the primitive', () => {
        const source = readSource('services/media/add-featured-media.ts');

        const demoteAt = source.indexOf('port.demote(');
        const archiveAt = source.indexOf('port.archive(');
        const createAt = source.indexOf('port.createFeatured(');

        expect(demoteAt).toBeGreaterThan(-1);
        expect(archiveAt).toBeGreaterThan(-1);
        expect(createAt).toBeGreaterThan(-1);

        // Inserting the new cover before releasing the old one would leave two
        // rows with is_featured = true, which the partial unique index rejects.
        expect(createAt).toBeGreaterThan(demoteAt);
        expect(createAt).toBeGreaterThan(archiveAt);
    });

    it('archives the outgoing cover in ONE write, never two', () => {
        const source = readSource(PORT_FILE);

        // The CHECK constraint `NOT (is_featured AND state = 'archived')`
        // rejects a row that is still featured and already archived, so both
        // columns have to move in the same update.
        const archiveBody = source.slice(source.indexOf('archive: async'));
        const firstUpdate = archiveBody.slice(0, archiveBody.indexOf('createFeatured'));

        expect(firstUpdate).toMatch(/isFeatured:\s*false/);
        expect(firstUpdate).toMatch(/state:\s*'archived'/);
        expect((firstUpdate.match(/mediaModel\.update\(/g) ?? []).length).toBe(1);
    });
});
