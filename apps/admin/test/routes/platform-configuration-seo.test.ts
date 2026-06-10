/**
 * @file platform-configuration-seo.test.ts
 * @description Source-based tests for the SEO settings page. Page location
 * set in SPEC-156 PR-2 (T-020); data layer rewritten in SPEC-156 PR-3 (T-030)
 * to read + write through the platform_settings API via `usePlatformSetting`
 * / `useUpdatePlatformSetting`. Tests cover that the localStorage source
 * has been removed, the page is wired to the `seo.defaults` key with the
 * matching legacy adapter, and the form fields use the API-canonical names
 * (metaTitleTemplate / metaDescriptionDefault / ogImageDefault).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const seoSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/platform/configuration/seo.tsx'),
    'utf8'
);

describe('platform/configuration/seo.tsx (T-020 + T-030)', () => {
    it('registers the new route path', () => {
        expect(seoSrc).toContain("createFileRoute('/_authed/platform/configuration/seo')");
    });

    describe('data layer migration (T-030)', () => {
        it('no longer reads or writes localStorage', () => {
            expect(seoSrc).not.toContain('localStorage.getItem');
            expect(seoSrc).not.toContain('localStorage.setItem');
            expect(seoSrc).not.toContain('hospeda-admin-seo-settings');
        });

        it('reads seo.defaults via usePlatformSetting + seoDefaults adapter', () => {
            expect(seoSrc).toContain("key: 'seo.defaults'");
            expect(seoSrc).toContain('legacyAdapters.seoDefaults');
            expect(seoSrc).toContain('usePlatformSetting');
        });

        it('writes seo.defaults via useUpdatePlatformSetting', () => {
            expect(seoSrc).toContain('useUpdatePlatformSetting');
            expect(seoSrc).toContain('seoMutation.mutate');
        });

        it('validates the form values with SeoDefaultsValueSchema before saving', () => {
            expect(seoSrc).toContain('SeoDefaultsValueSchema.safeParse');
        });
    });

    describe('form fields use API-canonical names', () => {
        it('uses metaTitleTemplate (not titleTemplate)', () => {
            expect(seoSrc).toContain('metaTitleTemplate');
            expect(seoSrc).not.toMatch(/handleChange\('titleTemplate'/);
        });

        it('uses metaDescriptionDefault (not defaultDescription)', () => {
            expect(seoSrc).toContain('metaDescriptionDefault');
            expect(seoSrc).not.toMatch(/handleChange\('defaultDescription'/);
        });

        it('uses ogImageDefault (not defaultOgImage)', () => {
            expect(seoSrc).toContain('ogImageDefault');
            expect(seoSrc).not.toMatch(/handleChange\('defaultOgImage'/);
        });
    });

    it('still renders the meta defaults card', () => {
        expect(seoSrc).toContain("'admin-pages.systemSettings.seo.metaDefaults'");
    });

    it('still renders the read-only sitemap + robots badges', () => {
        expect(seoSrc).toContain("'admin-pages.systemSettings.seo.sitemapGeneration'");
        expect(seoSrc).toContain("'admin-pages.systemSettings.seo.robotsTxt'");
    });
});
