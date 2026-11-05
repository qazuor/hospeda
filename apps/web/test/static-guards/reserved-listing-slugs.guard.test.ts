/**
 * @file reserved-listing-slugs.guard.test.ts
 * @description HOS-1862 — keeps `RESERVED_LISTING_SLUGS` in sync with the real
 * static route segments of every listing folder.
 *
 * A static sibling of `[slug]` (a folder like `tipo/`, or a file like
 * `mapa.astro`) wins over the dynamic route, so a listing that takes that word
 * as its slug loses its page. The list is the only thing protecting the write
 * paths, and nothing in the compiler notices when a new static entry appears.
 * This guard reads the actual page folders — the folder name comes from
 * `ENTITY_PUBLIC_PATHS`, never from a hand-written literal — and fails when a
 * static segment is missing from the list.
 *
 * The floor assertions below fail closed: a mistyped path would otherwise
 * yield zero segments and a green guard.
 *
 * @module test/static-guards/reserved-listing-slugs.guard
 */

import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RESERVED_LISTING_SLUGS } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ENTITY_PUBLIC_PATHS } from '../../src/lib/seo/entity-public-urls';

const PAGES_DIR = resolve(__dirname, '../../src/pages/[lang]');

/** Listing verticals with a public detail route and static siblings. */
const LISTING_VERTICALS = ['accommodation', 'venue', 'experience'] as const;

type ListingVertical = (typeof LISTING_VERTICALS)[number];

/**
 * Resolves the public folder name of a vertical from the canonical URL map.
 *
 * @param vertical - The listing vertical.
 * @returns The first path segment of its public detail URL.
 */
function publicFolderFor(vertical: ListingVertical): string {
    const path = ENTITY_PUBLIC_PATHS[vertical]('x');
    const [folder] = path.split('/').filter(Boolean);
    if (!folder) {
        throw new Error(`${vertical} has no public folder in ENTITY_PUBLIC_PATHS`);
    }
    return folder;
}

/**
 * Lists the static route segments directly under a listing folder.
 *
 * A segment is a top-level entry that is neither dynamic (starts with `[`) nor
 * `index.astro`. Directories keep their name; `.astro` files drop the
 * extension.
 *
 * @param directory - Absolute path of the listing folder.
 * @returns The static segment names, in directory order.
 */
function staticSegmentsIn(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true })
        .filter((entry) => !entry.name.startsWith('['))
        .flatMap((entry) => {
            if (entry.isDirectory()) return [entry.name];
            if (entry.isFile() && entry.name.endsWith('.astro') && entry.name !== 'index.astro') {
                return [entry.name.slice(0, -'.astro'.length)];
            }
            return [];
        });
}

describe('RESERVED_LISTING_SLUGS matches the static page segments', () => {
    it('lists every static segment of each listing folder', () => {
        for (const vertical of LISTING_VERTICALS) {
            const folder = publicFolderFor(vertical);
            const directory = join(PAGES_DIR, folder);
            const reserved = new Set(RESERVED_LISTING_SLUGS[vertical]);

            for (const segment of staticSegmentsIn(directory)) {
                expect(
                    reserved.has(segment),
                    `${folder}/${segment} is a static segment but "${segment}" is missing from RESERVED_LISTING_SLUGS.${vertical}`
                ).toBe(true);
            }
        }
    });

    it('reads the real folders (floor: accommodation contributes tipo and mapa)', () => {
        const folder = publicFolderFor('accommodation');
        const segments = staticSegmentsIn(join(PAGES_DIR, folder));

        expect(segments).toContain('tipo');
        expect(segments).toContain('mapa');
    });

    it('reads the real folders (floor: every listing folder has a page segment)', () => {
        for (const vertical of LISTING_VERTICALS) {
            const folder = publicFolderFor(vertical);
            expect(staticSegmentsIn(join(PAGES_DIR, folder))).toContain('page');
        }
    });
});
