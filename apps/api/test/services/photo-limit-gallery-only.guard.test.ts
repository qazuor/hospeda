/**
 * HOS-791 — every read that MEASURES a photo limit or gallery cap must count
 * the gallery alone, excluding the featured image.
 *
 * ## Why this is a static guard and not behavioural tests
 *
 * The counting sites are spread across nine files in two packages, and most of
 * them cannot be reached by a unit test in this app:
 *
 * - `apps/api`'s global test setup mocks `@repo/db` wholesale, so an assertion
 *   about the arguments a model received is vacuous there.
 * - The `addMedia` route handlers sit behind the full middleware chain, which
 *   does not complete in the test environment — a request never reaches the
 *   handler, so no mock is ever called.
 * - `usage-tracking.service.ts` reads its models through a module mock that does
 *   not export them, so the read always resolves through its own catch block.
 *
 * The sites that CAN be exercised behaviourally are, and they carry the real
 * arithmetic assertions:
 *   - `test/routes/media/gallery-count.test.ts`
 *   - `test/services/subscription-downgrade-excess.service.test.ts`
 *   - `test/services/plan-photo-restriction.service.test.ts`
 *   - `test/middlewares/limit-enforcement*.test.ts`
 *   - `packages/service-core/test/services/{gastronomy,experience}/*.media.test.ts`
 *     (these mock at the MODEL level, so their stub can answer a different count
 *     per filter and genuinely fail when the filter is dropped)
 *
 * One site is guard-only for a fixable reason worth naming:
 * `packages/service-core/test/services/accommodation/addMedia.gallery-cap.test.ts`
 * stubs at the DRIZZLE level and returns one fixed count to every projected
 * select, so it cannot see the `where` at all. Its gastronomy and experience
 * twins can. Re-shaping that fixture to a model-level mock would let the
 * accommodation cap be asserted behaviourally too.
 *
 * This guard covers the remainder. It asserts one thing and claims no more:
 * **at each declared call site, the media read carries `isFeatured: false`.**
 * It does not prove the surrounding arithmetic is right.
 *
 * ## Why the guard is keyed by (file, model method)
 *
 * Not every visible-media read should exclude the featured image, and the ones
 * that should not are not a mistake:
 *
 * - Gallery COMPOSITION reads (list, reorder, admin detail) need both kinds of
 *   row — they are what turn rows into `{ featuredImage, gallery }`.
 * - `subscription-downgrade-excess.service.ts` reads both deliberately, for
 *   exactly that split.
 * - `plan-downgrade-remediation.service.ts` builds a KEEP set — "every visible
 *   URL that is not overflow" — and narrowing it would make the set say less
 *   than its name.
 *
 * So the guard does not sweep for a pattern. It names the measuring call sites,
 * and pins the expected number of calls per (file, method) pair so a SECOND call
 * site cannot appear unguarded — a `toContain` over the whole file would not
 * notice one.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../../..');

/** Strips block comments and whole-line `//` comments so prose never counts. */
function stripComments(source: string): string {
    const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, '');
    return withoutBlocks
        .split('\n')
        .map((line) => (line.trim().startsWith('//') ? '' : line))
        .join('\n');
}

/**
 * Returns the argument text of every call to `method` in `source`, matching
 * parentheses so nested calls and multi-line object literals are captured whole.
 */
function callArguments(source: string, method: string): string[] {
    const pattern = new RegExp(`\\b${method.replace('.', '\\.')}\\s*\\(`, 'g');
    const out: string[] = [];
    let match = pattern.exec(source);
    while (match !== null) {
        const open = pattern.lastIndex - 1;
        let depth = 0;
        let close = open;
        for (; close < source.length; close++) {
            if (source[close] === '(') depth++;
            else if (source[close] === ')') {
                depth--;
                if (depth === 0) break;
            }
        }
        out.push(source.slice(open, close + 1));
        match = pattern.exec(source);
    }
    return out;
}

function readSource(relativePath: string): string {
    return stripComments(readFileSync(resolve(REPO_ROOT, relativePath), 'utf-8'));
}

/**
 * The call sites that measure a photo limit or gallery cap.
 *
 * `calls` is the number of calls to that method expected in that file. It is
 * pinned so that adding a second one fails here instead of shipping unguarded:
 * if you add a legitimate one, raise the number AND make sure the new call
 * belongs on this list rather than on the "reads both" list below.
 */
const MEASURING_SITES: ReadonlyArray<{
    readonly file: string;
    readonly method: string;
    readonly calls: number;
    readonly measures: string;
}> = [
    {
        file: 'apps/api/src/middlewares/limit-enforcement.ts',
        method: 'findByAccommodation',
        calls: 1,
        measures: 'plan photo limit (enforcePhotoLimit — currently unmounted, kept correct)'
    },
    {
        file: 'apps/api/src/routes/accommodation/protected/addMedia.ts',
        method: 'findByAccommodation',
        calls: 1,
        measures: 'plan photo limit — the route the web app actually calls'
    },
    {
        file: 'apps/api/src/routes/accommodation/admin/addMedia.ts',
        method: 'findByAccommodation',
        calls: 1,
        measures: 'plan photo limit — admin mirror of the protected route'
    },
    {
        file: 'apps/api/src/routes/media/admin/upload.ts',
        method: 'findByAccommodation',
        calls: 1,
        measures: 'plan photo limit on the admin upload route'
    },
    {
        file: 'apps/api/src/routes/media/gallery-count.ts',
        method: 'findByAccommodation',
        calls: 1,
        measures: 'per-entity gallery cap (accommodation)'
    },
    {
        file: 'apps/api/src/routes/media/gallery-count.ts',
        method: 'findByGastronomy',
        calls: 1,
        measures: 'per-entity gallery cap (gastronomy)'
    },
    {
        file: 'apps/api/src/routes/media/gallery-count.ts',
        method: 'findByExperience',
        calls: 1,
        measures: 'per-entity gallery cap (experience)'
    },
    {
        file: 'apps/api/src/services/usage-tracking.service.ts',
        method: 'findByAccommodations',
        calls: 1,
        measures: 'the per-accommodation photo usage the owner is shown'
    },
    {
        file: 'packages/service-core/src/services/accommodation/accommodation.service.ts',
        method: 'mediaModel.count',
        calls: 1,
        measures: 'service-layer gallery cap inside addMedia (accommodation)'
    },
    {
        file: 'packages/service-core/src/services/gastronomy/gastronomy.media.ts',
        method: 'mediaModel.count',
        calls: 1,
        measures: 'service-layer gallery cap inside addMedia (gastronomy)'
    },
    {
        file: 'packages/service-core/src/services/experience/experience.media.ts',
        method: 'mediaModel.count',
        calls: 1,
        measures: 'service-layer gallery cap inside addMedia (experience)'
    }
];

/**
 * Reads that MUST see the featured row. Guarded in the opposite direction: a
 * well-meaning "consistency" edit that adds the filter here breaks real
 * behaviour, so it should fail loudly with the reason attached.
 */
const READS_BOTH_KINDS: ReadonlyArray<{
    readonly file: string;
    readonly method: string;
    readonly why: string;
}> = [
    {
        file: 'apps/api/src/services/subscription-downgrade-excess.service.ts',
        method: 'findByAccommodations',
        why: 'it splits the rows into featuredImage + gallery; filtering here would erase the featured image from the preview. The featured image is excluded from the COUNT downstream, not from this query.'
    },
    {
        file: 'apps/api/src/services/plan-downgrade-remediation.service.ts',
        method: 'findByAccommodation',
        why: 'it builds a KEEP set, which means "every visible URL that is not overflow". Narrowing it would make the set say less than its name. (It would not actually archive the featured image — archiveAccommodationPhotos filters is_featured = false itself.)'
    }
];

describe('HOS-791 — photo limits and gallery caps are measured on the gallery alone', () => {
    it.each(MEASURING_SITES)('$file → $method carries isFeatured: false ($measures)', ({
        file,
        method,
        calls
    }) => {
        const args = callArguments(readSource(file), method);

        // Pinned so a second, unguarded call site cannot slip in unnoticed.
        expect(args).toHaveLength(calls);

        for (const arg of args) {
            expect(arg).toMatch(/state:\s*'visible'/);
            expect(arg).toMatch(/isFeatured:\s*false/);
        }
    });

    it.each(READS_BOTH_KINDS)('$file → $method deliberately does NOT filter isFeatured', ({
        file,
        method,
        why
    }) => {
        const args = callArguments(readSource(file), method);
        expect(args.length).toBeGreaterThan(0);

        for (const arg of args) {
            expect(/isFeatured/.test(arg), `This read must see the featured row: ${why}`).toBe(
                false
            );
        }
    });
});
