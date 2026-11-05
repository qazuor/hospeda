/**
 * @file listing-section-presentation.test.ts
 * @description TEST:5.1:4 — every catalog section's presentation has a page
 * (HOS-1787 leaf 5.1, F-V1-048).
 *
 * The `satisfies Record<ListingSectionId<V>, …>` in
 * `listing-section-presentation.ts` proves every catalog section HAS a slug and
 * a label; it cannot prove the slug has a route file. That half is filesystem
 * truth, so it is asserted here.
 */

import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LISTING_SECTION_PRESENTATION } from '@/lib/editor/listing-section-presentation';

const ROUTES_DIR = resolve(
    __dirname,
    '../../../src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar'
);

const ROUTE_FILES = readdirSync(ROUTES_DIR).filter((file) => file.endsWith('.astro'));

describe('TEST:5.1:4 listing section presentation', () => {
    for (const vertical of ['venue', 'experience'] as const) {
        it(`gives every ${vertical} catalog section a route file`, () => {
            for (const [sectionId, presentation] of Object.entries(
                LISTING_SECTION_PRESENTATION[vertical]
            )) {
                expect(
                    ROUTE_FILES,
                    `${vertical}.${sectionId} declares slug "${presentation.slug}" but no route file renders it`
                ).toContain(`${presentation.slug}.astro`);
            }
        });

        it(`gives every ${vertical} section a distinct slug`, () => {
            const slugs = Object.values(LISTING_SECTION_PRESENTATION[vertical]).map(
                (presentation) => presentation.slug
            );

            expect(new Set(slugs).size).toBe(slugs.length);
        });

        it(`gives every ${vertical} section an i18n label key`, () => {
            for (const presentation of Object.values(LISTING_SECTION_PRESENTATION[vertical])) {
                expect(presentation.labelKey).toMatch(/^listing\.owner\.editor\./);
            }
        });
    }

    it('uses a URL-safe slug everywhere', () => {
        for (const vertical of ['venue', 'experience'] as const) {
            for (const presentation of Object.values(LISTING_SECTION_PRESENTATION[vertical])) {
                expect(presentation.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
            }
        }
    });
});
