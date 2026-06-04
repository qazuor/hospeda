/**
 * Unit tests for `resolveStepText` (resolve-step-text).
 *
 * Covers the full locale fallback matrix:
 * - Each supported locale (es / en / pt) resolved when present.
 * - Fallback to `es` when the requested locale value is absent or empty.
 * - Fallback to `es` for unknown / unsupported locales.
 * - Safety-net first-value fallback when `es` is empty (contrived edge case).
 *
 * Pure function — no React, no DOM.
 *
 * @see apps/admin/src/lib/tour/resolve-step-text.ts
 * @see SPEC-174 §7.3, D7
 */

import { describe, expect, it } from 'vitest';
import type { TourI18nLabel } from '../resolve-step-text';
import { resolveStepText } from '../resolve-step-text';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_LABEL: TourI18nLabel = {
    es: 'Español',
    en: 'English',
    pt: 'Português'
};

const ES_ONLY_LABEL: TourI18nLabel = {
    es: 'Solo español',
    en: '',
    pt: ''
};

describe('resolveStepText', () => {
    // -------------------------------------------------------------------------
    // Supported locales — value present
    // -------------------------------------------------------------------------

    it('returns es value when locale is "es"', () => {
        expect(resolveStepText({ field: FULL_LABEL, locale: 'es' })).toBe('Español');
    });

    it('returns en value when locale is "en" and en is present', () => {
        expect(resolveStepText({ field: FULL_LABEL, locale: 'en' })).toBe('English');
    });

    it('returns pt value when locale is "pt" and pt is present', () => {
        expect(resolveStepText({ field: FULL_LABEL, locale: 'pt' })).toBe('Português');
    });

    // -------------------------------------------------------------------------
    // Fallback to es — requested locale present but empty
    // -------------------------------------------------------------------------

    it('falls back to es when en is empty', () => {
        expect(resolveStepText({ field: ES_ONLY_LABEL, locale: 'en' })).toBe('Solo español');
    });

    it('falls back to es when pt is empty', () => {
        expect(resolveStepText({ field: ES_ONLY_LABEL, locale: 'pt' })).toBe('Solo español');
    });

    // -------------------------------------------------------------------------
    // Fallback to es — unknown locale
    // -------------------------------------------------------------------------

    it('falls back to es for an unknown locale "fr"', () => {
        expect(resolveStepText({ field: FULL_LABEL, locale: 'fr' })).toBe('Español');
    });

    it('falls back to es for an empty locale string', () => {
        expect(resolveStepText({ field: FULL_LABEL, locale: '' })).toBe('Español');
    });

    // -------------------------------------------------------------------------
    // Safety-net — es is empty (contrived edge case)
    // -------------------------------------------------------------------------

    it('uses first non-empty value as safety-net when es is empty', () => {
        // Arrange — contrived: I18nLabelSchema requires non-empty es, but guard anyway
        const badLabel = { es: '', en: 'Only English', pt: '' } as unknown as TourI18nLabel;
        expect(resolveStepText({ field: badLabel, locale: 'pt' })).toBe('Only English');
    });

    it('returns empty string when all locales are empty (extreme edge case)', () => {
        const emptyLabel = { es: '', en: '', pt: '' } as unknown as TourI18nLabel;
        expect(resolveStepText({ field: emptyLabel, locale: 'es' })).toBe('');
    });
});
