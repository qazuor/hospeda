/**
 * @file colaborar-editores.test.ts
 * @description Source-reading tests for the /colaborar/editores page
 * (SPEC-191 FR-5, BETA-65).
 *
 * Asserts:
 *   - SSR (HOS-74): no prerender/getStaticPaths; locale from Astro.locals.locale
 *   - Recruitment copy through t() with contributions.* keys
 *   - Mounts ContributionForm preset to editor_application
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/colaborar/editores/index.astro'),
    'utf8'
);

describe('colaborar/editores/index.astro (editor recruitment page, FR-5)', () => {
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
    });

    describe('form mount (D-3)', () => {
        it('mounts ContributionForm preset to editor_application', () => {
            expect(src).toContain('presetType="editor_application"');
            expect(src).toMatch(/<ContributionForm[^>]*client:visible/s);
            expect(src).toMatch(/<ContributionForm[^>]*locale=\{locale\}/s);
        });
    });

    describe('i18n (FR-10)', () => {
        it('resolves all copy from the contributions namespace via t()', () => {
            expect(src).toContain('createTranslations');
            expect(src).toMatch(/t\(\s*'contributions\.editors\./);
        });
    });

    describe('navigation', () => {
        it('mounts the smart back link (history-aware, hub fallback)', () => {
            expect(src).toContain('<ContributionBackLink');
        });
    });
});
