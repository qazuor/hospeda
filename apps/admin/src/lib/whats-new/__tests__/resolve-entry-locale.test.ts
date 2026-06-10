/**
 * Unit tests for `resolveEntryLocale`.
 *
 * Covers the full fallback matrix described in SPEC-175 §12.5:
 * - es-only field with 'en' or 'pt' locale → falls back to es.
 * - Full three-locale field → correct locale selected.
 * - First-key fallback when 'es' is somehow empty.
 * - Unknown locale → falls back to es.
 *
 * Pure function — no React, no DOM, no network.
 *
 * @see apps/admin/src/lib/whats-new/resolve-entry-locale.ts
 * @see SPEC-175 §7.7, §12.5
 */

import { describe, expect, it } from 'vitest';
import type { I18nField } from '../resolve-entry-locale';
import { resolveEntryLocale } from '../resolve-entry-locale';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('resolveEntryLocale', () => {
    // -------------------------------------------------------------------------
    // Spec §12.5 — explicitly required scenarios
    // -------------------------------------------------------------------------

    it('falls back to es when the en locale is absent', () => {
        // Arrange — es-only field
        const field: I18nField = { es: 'Título' };

        // Act
        const result = resolveEntryLocale({ field, locale: 'en' });

        // Assert
        expect(result).toBe('Título');
    });

    it('returns en value when the en locale is present', () => {
        // Arrange — full field with en
        const field: I18nField = { es: 'Título', en: 'Title' };

        // Act
        const result = resolveEntryLocale({ field, locale: 'en' });

        // Assert
        expect(result).toBe('Title');
    });

    it('falls back to es when the pt locale is absent', () => {
        // Arrange — es-only field
        const field: I18nField = { es: 'Título' };

        // Act
        const result = resolveEntryLocale({ field, locale: 'pt' });

        // Assert
        expect(result).toBe('Título');
    });

    // -------------------------------------------------------------------------
    // Additional matrix cases
    // -------------------------------------------------------------------------

    it('returns es value when locale is es', () => {
        // Arrange
        const field: I18nField = { es: 'Título', en: 'Title', pt: 'Título PT' };

        // Act
        const result = resolveEntryLocale({ field, locale: 'es' });

        // Assert
        expect(result).toBe('Título');
    });

    it('returns pt value when the pt locale is present', () => {
        // Arrange
        const field: I18nField = { es: 'Título', en: 'Title', pt: 'Título PT' };

        // Act
        const result = resolveEntryLocale({ field, locale: 'pt' });

        // Assert
        expect(result).toBe('Título PT');
    });

    it('returns en value from a full three-locale field when locale is en', () => {
        // Arrange
        const field: I18nField = { es: 'Título', en: 'Title', pt: 'Título PT' };

        // Act
        const result = resolveEntryLocale({ field, locale: 'en' });

        // Assert
        expect(result).toBe('Title');
    });

    it('falls back to es for an unknown/unsupported locale string', () => {
        // Arrange
        const field: I18nField = { es: 'Título', en: 'Title' };

        // Act
        const result = resolveEntryLocale({ field, locale: 'fr' });

        // Assert
        expect(result).toBe('Título');
    });

    it('uses safety-net first-key fallback when es is an empty string', () => {
        // Arrange — contrived edge case; real data is validated by Zod to have non-empty es
        const field = { es: '', en: 'Title' } as unknown as I18nField;

        // Act
        const result = resolveEntryLocale({ field, locale: 'pt' });

        // Assert — falls back to the first non-empty value ('Title')
        expect(result).toBe('Title');
    });
});
