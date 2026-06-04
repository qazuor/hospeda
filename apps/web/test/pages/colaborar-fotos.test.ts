/**
 * @file colaborar-fotos.test.ts
 * @description Source-reading tests for the /colaborar/fotos page
 * (SPEC-191 FR-4, BETA-68).
 *
 * Asserts:
 *   - SSG: prerender = true + getStaticPaths enumerating es/en/pt
 *   - A clearly-labelled usage/license terms section with an anchor id
 *   - Delivery-mechanics copy (links in message / email follow-up)
 *   - The "by submitting you accept the terms" line anchor-linked to the
 *     terms section, passed as island children (renders above submit)
 *   - Mounts ContributionForm preset to photo_submission
 *   - All copy through t() with contributions.* keys
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/colaborar/fotos/index.astro'),
    'utf8'
);

describe('colaborar/fotos/index.astro (photo call page, FR-4)', () => {
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

    describe('license terms section (D-9)', () => {
        it('has a terms section with an anchor id', () => {
            expect(src).toContain('id="terminos"');
        });

        it('labels the terms section with a heading from i18n', () => {
            expect(src).toMatch(/t\(\s*'contributions\.photos\.terms\.heading'/);
        });

        it('flags the license copy as pending legal sign-off (D-9)', () => {
            // The content dependency must be visible to future maintainers.
            expect(src).toContain('D-9');
        });
    });

    describe('delivery mechanics (FR-4)', () => {
        it('explains how to deliver photos via i18n keys', () => {
            expect(src).toMatch(/t\(\s*'contributions\.photos\.how\./);
        });
    });

    describe('accept-terms line (FR-4)', () => {
        it('links the accept line to the terms anchor', () => {
            expect(src).toContain('href="#terminos"');
        });

        it('passes the accept line as ContributionForm children (above submit)', () => {
            // The note must live INSIDE the island mount so it renders above
            // the submit button.
            expect(src).toMatch(
                /<ContributionForm[\s\S]*?>[\s\S]*?#terminos[\s\S]*?<\/ContributionForm>/
            );
        });
    });

    describe('form mount (D-3)', () => {
        it('mounts ContributionForm preset to photo_submission', () => {
            expect(src).toContain('presetType="photo_submission"');
            expect(src).toMatch(/<ContributionForm[^>]*client:visible/s);
            expect(src).toMatch(/<ContributionForm[^>]*locale=\{locale\}/s);
        });
    });

    describe('i18n (FR-10)', () => {
        it('resolves all copy from the contributions namespace via t()', () => {
            expect(src).toContain('createTranslations');
            expect(src).toMatch(/t\(\s*'contributions\.photos\./);
        });
    });

    describe('navigation', () => {
        it('mounts the smart back link (history-aware, hub fallback)', () => {
            expect(src).toContain('<ContributionBackLink');
        });
    });
});
