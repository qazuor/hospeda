/**
 * HOS-294 AC-8 / AC-11 — the filtered partner directory is gone and stays gone.
 *
 * This is a guard, not a unit test: the directory was retired by an owner
 * decision, and the failure it protects against is someone re-adding a piece of
 * it later without knowing that. Each assertion names one artifact that must
 * not come back.
 *
 * The sitemap assertion is the load-bearing one. `static-sitemap-pages.guard.test.ts`
 * walks `src/pages/[lang]` and fails when a page is classified nowhere — but it
 * cannot see an ENTRY whose page was deleted. Without the check below, removing
 * the page while leaving its sitemap line would have advertised a 404 to every
 * crawler with CI fully green.
 *
 * @module test/pages/partners-directory-removed
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    NON_SITEMAP_STATIC_PAGES,
    STATIC_SITEMAP_PAGES
} from '../../src/lib/seo/static-sitemap-pages';

const root = resolve(__dirname, '../..');

/** Every file that made up the retired directory. */
const DELETED_ARTIFACTS = [
    'src/pages/[lang]/partners/index.astro',
    'src/components/partner/PartnerCard.astro'
] as const;

const LOCALES = ['es', 'en', 'pt'] as const;

/** i18n namespaces that existed only to label the directory's UI. */
const DELETED_I18N_SECTIONS = ['listing', 'tiers'] as const;

describe('the partner directory is gone (AC-8)', () => {
    it.each(DELETED_ARTIFACTS)('does not resurrect %s', (relativePath) => {
        // Arrange / Act / Assert
        expect(existsSync(resolve(root, relativePath)), `${relativePath} is back`).toBe(false);
    });

    it.each(LOCALES)('leaves no directory-only i18n keys in %s', (locale) => {
        // Arrange
        const raw = readFileSync(
            resolve(root, `../../packages/i18n/src/locales/${locale}/partners.json`),
            'utf8'
        );
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        // Assert — `types` survives on purpose: the detail page renders
        // "Comercio" / "ONG" / "Institución". `tiers` does not, because the
        // tier is internal commercial state and is never shown publicly.
        for (const section of DELETED_I18N_SECTIONS) {
            expect(parsed[section], `partners.${section} is back in ${locale}`).toBeUndefined();
        }
        expect(parsed.types, `partners.types was dropped from ${locale}`).toBeDefined();
    });
});

describe('the retired URL is not advertised anywhere (AC-11)', () => {
    it('is absent from the static sitemap', () => {
        // Arrange / Act
        const paths = STATIC_SITEMAP_PAGES.map((page) => page.path);

        // Assert
        expect(paths).not.toContain('/partners/');
    });

    it('is not classified as a deliberately excluded page either', () => {
        // Arrange / Act / Assert — the exclusion map is for pages that EXIST
        // and are kept out of the sitemap. This page does not exist, so listing
        // it there would describe a file nobody can open.
        expect(Object.keys(NON_SITEMAP_STATIC_PAGES)).not.toContain('/partners/');
    });
});
