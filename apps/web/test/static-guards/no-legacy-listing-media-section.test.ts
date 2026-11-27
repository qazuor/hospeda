/**
 * @file no-legacy-listing-media-section.test.ts
 * @description HOS-2495 (AC-20): accommodation, venue and experience edit their
 * photos with ONE component, `host/editor/PhotoSection.client.tsx`. The
 * venue/experience-only `MediaSection` and its hooks were deleted; this guard
 * keeps a second photo editor from coming back, which is how the two drifted
 * apart in the first place (a flat 30 cap on one side, the plan cap on the
 * other).
 *
 * What it checks:
 *  - none of the five legacy files exists;
 *  - no file under `src` imports them or renders `<MediaSection`;
 *  - both `fotos.astro` routes render `PhotoSection` with a `vertical`.
 *
 * What it cannot see: a NEW photo editor under another name. The `fotos.astro`
 * assertion is what catches that for the two routes that matter.
 *
 * @module test/static-guards/no-legacy-listing-media-section
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = resolve(__dirname, '../../src');

/** The files HOS-2495 deleted. */
const LEGACY_FILES = [
    'components/listing/editor/MediaSection.client.tsx',
    'components/listing/editor/use-listing-media.ts',
    'components/listing/editor/use-listing-media-upload.ts',
    'components/listing/editor/listing-media-upload.ts',
    'components/listing/editor/media-section-helpers.ts'
] as const;

/** An import of a legacy module, or a render of the legacy component. */
const LEGACY_USE =
    /from\s+['"][^'"]*\/(?:MediaSection\.client|use-listing-media(?:-upload)?|listing-media-upload|media-section-helpers)['"]|<MediaSection\b/;

/** The photo routes, and the vertical each must pass. */
const PHOTO_ROUTES = [
    'pages/[lang]/mi-cuenta/propiedades/[id]/editar/fotos.astro',
    'pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar/fotos.astro'
] as const;

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

describe('one listing photo editor (HOS-2495, AC-20)', () => {
    const files = walk(WEB_SRC).filter((file) => /\.(ts|tsx|astro)$/.test(file));

    it('scans a non-trivial set of files', () => {
        expect(files.length).toBeGreaterThan(500);
    });

    it.each(LEGACY_FILES)('%s does not exist', (file) => {
        expect(existsSync(join(WEB_SRC, file))).toBe(false);
    });

    it('no source imports a legacy module or renders <MediaSection', () => {
        const offenders = files
            .filter((file) => LEGACY_USE.test(readFileSync(file, 'utf8')))
            .map((file) => relative(WEB_SRC, file));
        expect(offenders).toEqual([]);
    });

    it.each(PHOTO_ROUTES)('%s renders the shared PhotoSection with a vertical', (route) => {
        const source = readFileSync(join(WEB_SRC, route), 'utf8');
        expect(source).toMatch(
            /import\s+\{\s*PhotoSection\s*\}\s+from\s+['"][^'"]*\/host\/editor\/PhotoSection\.client['"]/
        );
        expect(source).toMatch(/<PhotoSection\b[^>]*\bvertical=/);
        expect(source).toMatch(/<PhotoSection\b[^>]*\blistingId=/);
    });
});
