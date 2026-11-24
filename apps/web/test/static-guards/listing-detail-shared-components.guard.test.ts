/**
 * @file listing-detail-shared-components.guard.test.ts
 * @description HOS-2579 AC-8, §6.3 to §6.5: the three listing detail pages
 * render their header, contact block and location block through ONE shared
 * component each, and the per-vertical components those replaced stay deleted.
 *
 * ## What it checks
 *
 * - Each page imports `listing/header/ListingHeader.astro`,
 *   `listing/contact/ListingContactBlock.astro` and
 *   `listing/location/LocationSection.astro`, and calls the matching builder.
 * - The replaced files do not exist: `DetailHeader`, `VenueDetailHeader`,
 *   `ExperienceHero`, the three contact wrappers, `ListingContactChannels`,
 *   `VenueAddress`, `ExperienceMeetingPoint` and the accommodation-only
 *   `LocationSection`.
 * - No file under `src` imports one of those names again.
 *
 * ## What it does NOT see, so a green run is not mistaken for more
 *
 * - **A re-created copy under a new name.** A `VenueHeader2.astro` that copies
 *   the old markup passes; review is the control for that.
 * - **Render order.** Slot order is PR 3's job (HOS-2579 §13.2) and has its
 *   own tests; this guard only proves which component draws each block.
 * - **Owner editors and managers** (`*Manager.client.tsx`,
 *   `components/listing/editor/**`) are not public fichas and are not checked.
 * - **Import forms it does not parse.** Only static `import ... from '...'`
 *   lines are read; a dynamic `import()` of a deleted name would pass, and so
 *   would a specifier built from a variable.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../src');
const read = (file: string): string => readFileSync(join(SRC, file), 'utf8');

const PAGES = [
    { page: 'pages/[lang]/alojamientos/[slug].astro', vertical: 'Accommodation' },
    { page: 'pages/[lang]/comer-y-salir/[slug].astro', vertical: 'Venue' },
    { page: 'pages/[lang]/experiencias/[slug].astro', vertical: 'Experience' }
] as const;

const SHARED_IMPORTS = [
    "import ListingHeader from '@/components/listing/header/ListingHeader.astro'",
    "import ListingContactBlock from '@/components/listing/contact/ListingContactBlock.astro'",
    "import LocationSection from '@/components/listing/location/LocationSection.astro'"
] as const;

/** The per-vertical components HOS-2579 PR 2 (and PR 3, `ExperienceInfo`) replaced. */
const DELETED = [
    'components/accommodation/DetailHeader.astro',
    'components/venue/VenueDetailHeader.astro',
    'components/experience/ExperienceHero.astro',
    'components/accommodation/AccommodationContactBlock.astro',
    'components/venue/VenueContactBlock.astro',
    'components/experience/ExperienceContactBlock.astro',
    'components/listing/contact/ListingContactChannels.astro',
    'components/venue/VenueAddress.astro',
    'components/experience/ExperienceMeetingPoint.astro',
    'components/accommodation/LocationSection.astro',
    // HOS-2579 PR 3: split into its slots (ExperienceDescription + the page).
    'components/experience/ExperienceInfo.astro'
] as const;

/** Resolves a static import specifier to a path relative to `src`, or `null`. */
function resolveSpecifier({ from, specifier }: { from: string; specifier: string }): string | null {
    if (specifier.startsWith('@/')) return specifier.slice(2);
    if (specifier.startsWith('.')) return relative(SRC, resolve(dirname(from), specifier));
    return null;
}

/** Whether `file` statically imports one of {@link DELETED}. */
function importsDeleted(file: string): boolean {
    const deleted = new Set(DELETED.map((path) => path.replace(/\.astro$/, '')));
    return [...readFileSync(file, 'utf8').matchAll(/^\s*import\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)]
        .map(([, specifier]) => resolveSpecifier({ from: file, specifier: specifier as string }))
        .some(
            (target) =>
                target !== null &&
                deleted.has(
                    target
                        .split(sep)
                        .join('/')
                        .replace(/\.astro$/, '')
                )
        );
}

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return walk(full);
        return /\.(astro|tsx?)$/.test(entry) ? [full] : [];
    });
}

describe('the three listing detail pages use the shared components (HOS-2579 AC-8)', () => {
    it.each(PAGES)('$page imports the shared header, contact and location blocks', ({
        page,
        vertical
    }) => {
        const src = read(page);
        for (const statement of SHARED_IMPORTS) expect(src).toContain(statement);
        expect(src).toContain(`build${vertical}Header({`);
        expect(src).toContain(`build${vertical}ContactBlock({`);
        expect(src).toContain(`build${vertical}Location({`);
        expect(src).toContain('<ListingHeader {...headerProps} />');
    });

    it.each(DELETED)('%s stays deleted', (file) => {
        expect(existsSync(join(SRC, file))).toBe(false);
    });

    it('no source file imports a replaced component again', () => {
        const offenders = walk(SRC).filter((file) => importsDeleted(file));
        expect(offenders).toEqual([]);
    });
});
