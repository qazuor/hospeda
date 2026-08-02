/**
 * @file remove-media-deletes-asset.guard.test.ts
 * @description Static guard: every route that removes a media row must also
 * hand the service a media provider, so the Cloudinary binary is deleted with
 * it (HOS-372).
 *
 * ## Why a guard and not six tests
 *
 * The media provider is an OPTIONAL parameter on all three verticals'
 * `removeMedia` entry points. That is deliberate — local dev and CI run without
 * Cloudinary credentials and must still be able to remove photos. But optional
 * means a new route, or a refactor of an existing one, can silently omit it:
 * nothing throws, nothing logs an error, the row still disappears, and the
 * binary is orphaned again. The bug reappears invisibly.
 *
 * Six per-route tests would not catch that, because the failure mode is a route
 * that does not exist yet. This guard is discovery-based instead: it finds every
 * caller by looking for references to the remove-media symbols, then asserts
 * each one wires the provider. A seventh vertical added tomorrow is covered the
 * moment its route calls the service.
 *
 * ## What this guard does NOT verify
 *
 * - That the provider is actually non-null at runtime (it is null without
 *   Cloudinary credentials — by design).
 * - The ORDER of the deletion (binary before row). That is an invariant of the
 *   service layer, covered by the behavioral regression tests in
 *   `packages/service-core/test/services/gastronomy/gastronomy.media.test.ts`.
 * - Any caller outside `apps/api/src/routes/` — a cron job or script calling the
 *   service directly is not discovered here.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Absolute path to the API route tree. */
const ROUTES_DIR = join(__dirname, '../../../src/routes');

/**
 * Symbols that remove a media row. A file referencing any of these is, by
 * definition, a remove-media call site and must wire the provider.
 *
 * Matching on the symbol rather than on a filename or a call shape is what
 * makes this guard survive renames and reformatting.
 */
const REMOVE_MEDIA_SYMBOLS = [
    'removeGastronomyMedia',
    'removeExperienceMedia',
    '.removeMedia('
] as const;

/** The symbol that supplies the provider. */
const PROVIDER_SYMBOL = 'getMediaProvider';

/** Recursively collect every `.ts` file under a directory. */
function collectTsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...collectTsFiles(full));
        } else if (entry.name.endsWith('.ts')) {
            out.push(full);
        }
    }
    return out;
}

/** Every route file that calls a remove-media service entry point. */
function findRemoveMediaCallSites(): Array<{ path: string; source: string }> {
    return collectTsFiles(ROUTES_DIR)
        .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
        .filter(({ source }) => REMOVE_MEDIA_SYMBOLS.some((symbol) => source.includes(symbol)));
}

describe('remove-media routes delete the Cloudinary asset (HOS-372 guard)', () => {
    const callSites = findRemoveMediaCallSites();

    it('should discover the known remove-media call sites', () => {
        // Non-vacuity: if the discovery predicate silently stops matching (a
        // rename, a moved directory), every assertion below would pass over an
        // empty list and the guard would be worthless while looking green.
        // Three verticals x two tiers = six known routes today.
        expect(callSites.length).toBeGreaterThanOrEqual(6);
    });

    it('should wire a media provider in every remove-media call site', () => {
        const missing = callSites
            .filter(({ source }) => !source.includes(PROVIDER_SYMBOL))
            .map(({ path }) => relative(ROUTES_DIR, path));

        expect(
            missing,
            `These routes remove a media row without passing a media provider, so the ` +
                `Cloudinary binary is orphaned. Pass \`getMediaProvider()\` to the service ` +
                `(see apps/api/src/routes/gastronomy/protected/removeMedia.ts):\n  ` +
                missing.join('\n  ')
        ).toEqual([]);
    });
});
