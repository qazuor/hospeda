/**
 * @file colaborar-reportar.test.ts
 * @description Source-reading tests for the /colaborar/reportar page
 * (SPEC-191 FR-3, BETA-69).
 *
 * Asserts:
 *   - SSR (HOS-74): no prerender/getStaticPaths; locale from Astro.locals.locale
 *   - Mounts ContributionForm locked to report_destination_info
 *   - The ?destino= context is handled by the island (client-side), not the page
 *   - All copy through t() with contributions.* keys
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/colaborar/reportar/index.astro'),
    'utf8'
);

describe('colaborar/reportar/index.astro (report form page, FR-3)', () => {
    describe('rendering mode (SSR — HOS-74)', () => {
        it('does NOT set prerender = true (SSR so the middleware CSP header reaches it)', () => {
            expect(src).not.toContain('export const prerender = true');
        });

        it('does NOT declare getStaticPaths (lang resolved at request time under SSR)', () => {
            expect(src).not.toContain('getStaticPaths');
        });

        it('reads the locale from Astro.locals.locale (validated by middleware)', () => {
            expect(src).toContain('Astro.locals.locale');
        });

        it('does NOT read query params server-side (the ?destino= island handles it client-side)', () => {
            expect(src).not.toContain('Astro.url.searchParams');
            expect(src).not.toContain('Astro.request.url');
        });
    });

    describe('form mount (D-3)', () => {
        it('mounts ContributionForm preset to report_destination_info', () => {
            expect(src).toContain('ContributionForm');
            expect(src).toContain('presetType="report_destination_info"');
        });

        it('hydrates the form island with client:visible', () => {
            expect(src).toMatch(/<ContributionForm[^>]*client:visible/s);
        });

        it('passes the locale to the form island', () => {
            expect(src).toMatch(/<ContributionForm[^>]*locale=\{locale\}/s);
        });
    });

    describe('i18n (FR-10)', () => {
        it('resolves all copy from the contributions namespace via t()', () => {
            expect(src).toContain('createTranslations');
            expect(src).toMatch(/t\(\s*'contributions\.report\./);
        });
    });

    describe('navigation', () => {
        it('mounts the smart back link (history-aware, hub fallback)', () => {
            expect(src).toContain('<ContributionBackLink');
        });
    });
});
