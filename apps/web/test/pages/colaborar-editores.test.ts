/**
 * @file colaborar-editores.test.ts
 * @description Source-reading tests for the /colaborar/editores page
 * (SPEC-191 FR-5, BETA-65).
 *
 * Asserts:
 *   - SSG: prerender = true + getStaticPaths enumerating es/en/pt
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
    describe('rendering mode (SSG)', () => {
        it('sets prerender = true', () => {
            expect(src).toContain('export const prerender = true');
        });

        it('enumerates es, en and pt in getStaticPaths', () => {
            expect(src).toContain('getStaticPaths');
            expect(src).toContain("{ params: { lang: 'es' } }");
            expect(src).toContain("{ params: { lang: 'en' } }");
            expect(src).toContain("{ params: { lang: 'pt' } }");
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
