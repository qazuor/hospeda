/**
 * @file media-asset-url.guard.test.ts
 * @description Static guard: no schema that persists an entity media asset may
 * validate its `url` with the permissive `z.string().url()` (H-22).
 *
 * ## Why a guard and not more parse tests
 *
 * The bug was not one bad schema — it was fifteen `url:` declarations across
 * seven files, every one of them using a validator that accepts `blob:`,
 * `data:` and `javascript:`. Parse tests can only cover the schemas that exist
 * today; the next media schema someone adds will copy its nearest neighbour and
 * silently reopen the hole, because nothing throws when a bad URL is stored —
 * the row just renders as a broken image for every visitor.
 *
 * A guard states the invariant once, for every present and future media schema.
 *
 * ## What counts as a media asset URL
 *
 * A `url:` field inside one of the files listed in `MEDIA_SCHEMA_FILES` — the
 * schemas behind `*_media` tables and the `media` JSONB blob. Deliberately NOT
 * every `z.string().url()` in the package: a user's profile link, an OG image
 * setting or a social permalink are different contracts with their own rules,
 * and widening this guard to them would be scope it cannot justify.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Package `src` root. */
const SRC = join(__dirname, '../../src');

/**
 * Every schema file that declares a persisted media asset URL.
 *
 * Pinned explicitly rather than discovered by glob: a discovery walk that
 * matched nothing would leave this guard vacuously green, which is the exact
 * failure mode it exists to prevent. Adding a media schema means adding it
 * here — and the `every listed file exists` case below fails loudly if one is
 * renamed or removed.
 */
const MEDIA_SCHEMA_FILES = [
    'common/media.schema.ts',
    'common/content-media.schema.ts',
    'common/commerce-media.schema.ts',
    'entities/accommodation/subtypes/accommodation.media.schema.ts',
    'entities/accommodation/accommodation.http.schema.ts',
    'entities/experience/subtypes/experience.media.schema.ts',
    'entities/gastronomy/subtypes/gastronomy.media.schema.ts'
] as const;

/**
 * A `url:` property validated with the permissive builder.
 *
 * Anchored on the `url:` KEY, so an `ImageAttributionSchema.sourceUrl` (a
 * credit link, not an asset) or any other URL-shaped field is out of scope, and
 * a rename cannot slip past by dropping the word "url" from the call.
 */
const PERMISSIVE_URL = /^\s*url:\s*z\s*\n?\s*\.?string\(\)\s*\.url\(/m;

/** Same thing spread over several lines, as Biome sometimes formats it. */
const PERMISSIVE_URL_MULTILINE = /^\s*url:\s*z\s*$\s*^\s*\.string\(\)$\s*^\s*\.url\(/m;

function read(rel: string): string {
    return readFileSync(join(SRC, rel), 'utf-8');
}

describe('media asset URLs are validated with mediaAssetUrl (H-22)', () => {
    it('every listed media schema file exists and is readable', () => {
        // Instrument check: the assertions below iterate this list, so a stale
        // path would make the whole guard pass while inspecting nothing.
        const unreadable = MEDIA_SCHEMA_FILES.filter((rel) => {
            try {
                return read(rel).length === 0;
            } catch {
                return true;
            }
        });

        expect(unreadable).toEqual([]);
        expect(MEDIA_SCHEMA_FILES.length).toBeGreaterThan(0);
    });

    it('no media schema declares its url with the permissive z.string().url()', () => {
        const offenders = MEDIA_SCHEMA_FILES.filter((rel) => {
            const source = read(rel);
            return PERMISSIVE_URL.test(source) || PERMISSIVE_URL_MULTILINE.test(source);
        });

        expect(
            offenders,
            'z.string().url() accepts blob:, data: and javascript:. Nine rows carrying ' +
                'blob:https://admin.hospeda.com.ar/<uuid> reached production and were served ' +
                'as <img src> on a real post and a real event. Use mediaAssetUrl() from ' +
                'common/media.schema.ts instead.'
        ).toEqual([]);
    });

    it('every listed file actually references mediaAssetUrl', () => {
        // The complement of the assertion above. Without this, deleting a
        // `url:` field entirely would also satisfy "no permissive url" — the
        // guard would report success for a schema that validates nothing.
        const missing = MEDIA_SCHEMA_FILES.filter((rel) => !read(rel).includes('mediaAssetUrl'));

        expect(missing).toEqual([]);
    });
});
