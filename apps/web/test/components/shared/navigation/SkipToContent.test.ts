/**
 * @file SkipToContent.test.ts
 * @description SPEC-157 REQ-15 — i18n the skip-link text.
 * The skip-to-content link must use a translated string from @repo/i18n
 * via t('common.skipToContent') rather than a hardcoded Spanish string.
 * The translation key must exist in all three locale files (es, en, pt).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/navigation/SkipToContent.astro'),
    'utf8'
);

// Read the three locale files directly from the package source.
// The i18n package is aliased to src in the vitest config so reading the
// source JSON is the canonical way to assert key presence.
const I18N_LOCALES_PATH = resolve(__dirname, '../../../../../../packages/i18n/src/locales');

const esCommon = JSON.parse(
    readFileSync(resolve(I18N_LOCALES_PATH, 'es/common.json'), 'utf8')
) as Record<string, unknown>;

const enCommon = JSON.parse(
    readFileSync(resolve(I18N_LOCALES_PATH, 'en/common.json'), 'utf8')
) as Record<string, unknown>;

const ptCommon = JSON.parse(
    readFileSync(resolve(I18N_LOCALES_PATH, 'pt/common.json'), 'utf8')
) as Record<string, unknown>;

describe('SkipToContent.astro (SPEC-157 REQ-15)', () => {
    describe('i18n wiring', () => {
        it('should use createTranslations to resolve translations', () => {
            expect(src).toContain('createTranslations');
        });

        it('should use t() to render the skip-link text (not a hardcoded string)', () => {
            expect(src).toContain("t('common.skipToContent')");
        });

        it('should NOT contain the hardcoded Spanish skip-link text', () => {
            // Both the original "Saltar al contenido" and any variant must be gone.
            expect(src).not.toContain('Saltar al contenido');
        });

        it('should accept a locale prop', () => {
            expect(src).toContain('locale');
        });
    });

    describe('i18n key presence in locale files', () => {
        it('should have common.skipToContent in the es locale', () => {
            expect(esCommon).toHaveProperty('skipToContent');
            expect(typeof esCommon.skipToContent).toBe('string');
            expect((esCommon.skipToContent as string).length).toBeGreaterThan(0);
        });

        it('should have common.skipToContent in the en locale', () => {
            expect(enCommon).toHaveProperty('skipToContent');
            expect(typeof enCommon.skipToContent).toBe('string');
            expect((enCommon.skipToContent as string).length).toBeGreaterThan(0);
        });

        it('should have common.skipToContent in the pt locale', () => {
            expect(ptCommon).toHaveProperty('skipToContent');
            expect(typeof ptCommon.skipToContent).toBe('string');
            expect((ptCommon.skipToContent as string).length).toBeGreaterThan(0);
        });

        it('es value should be the Spanish skip text', () => {
            expect(esCommon.skipToContent).toBe('Saltar al contenido principal');
        });

        it('en value should be "Skip to main content"', () => {
            expect(enCommon.skipToContent).toBe('Skip to main content');
        });

        it('pt value should be the Portuguese skip text', () => {
            // Accept any non-empty Portuguese string (the locale file already has this).
            expect((ptCommon.skipToContent as string).length).toBeGreaterThan(0);
        });
    });
});
