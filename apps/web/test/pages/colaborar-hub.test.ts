/**
 * @file colaborar-hub.test.ts
 * @description Source-reading tests for the /colaborar hub landing page
 * (SPEC-191 FR-2).
 *
 * Astro pages cannot be rendered in Vitest, so we assert on the source:
 *   - SSG: prerender = true + getStaticPaths enumerating es/en/pt
 *   - Three contribution cards linking (via buildUrl) to reportar/fotos/editores
 *   - All copy through t() with contributions.* keys
 *   - Icons from @repo/icons, styles via design tokens
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/colaborar/index.astro'),
    'utf8'
);

describe('colaborar/index.astro (hub landing, FR-2)', () => {
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

    describe('contribution cards', () => {
        it('links to the three contribution paths via buildUrl', () => {
            expect(src).toContain("path: 'colaborar/reportar'");
            expect(src).toContain("path: 'colaborar/fotos'");
            expect(src).toContain("path: 'colaborar/editores'");
        });

        it('uses @repo/icons for the card icons (no inline svg)', () => {
            expect(src).toContain("from '@repo/icons'");
            expect(src).toContain('AlertTriangleIcon');
            expect(src).toContain('ImageIcon');
            expect(src).toContain('EditIcon');
            expect(src).not.toContain('<svg');
        });
    });

    describe('i18n (FR-10)', () => {
        it('resolves all copy from the contributions namespace via t()', () => {
            expect(src).toContain('createTranslations');
            expect(src).toMatch(/t\(\s*'contributions\.hub\./);
        });
    });

    describe('layout and styling', () => {
        it('uses DefaultLayout with locale + title + description', () => {
            expect(src).toContain('<DefaultLayout');
            expect(src).toContain('locale={locale}');
        });

        it('styles with design tokens only (no hardcoded hex colors)', () => {
            const styleBlock = src.split('<style>')[1] ?? '';
            expect(styleBlock).toContain('var(--');
            expect(styleBlock).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        });

        it('uses scroll-reveal on the cards', () => {
            expect(src).toContain('data-reveal');
        });
    });
});
