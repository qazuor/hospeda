// @vitest-environment jsdom
/**
 * Tests for useLocalizedLabel.
 *
 * Covers:
 * - Returns the label for the current locale when available.
 * - Falls back to 'es' when the current locale has no entry.
 * - Falls back to the first available key when both currentLocale and 'es' are missing.
 * - Returns 'en' when locale is 'en'.
 * - Returns 'pt' when locale is 'pt'.
 *
 * The global setup mocks `@/hooks/use-translations` to return `locale: 'es'`.
 * This file overrides that mock per test to control the active locale.
 *
 * @see apps/admin/src/hooks/use-localized-label.ts
 * @see SPEC-154 T-021 (label rendering helper)
 */

import { useLocalizedLabel } from '@/hooks/use-localized-label';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @/hooks/use-translations so we can control the active locale.
// This overrides the global setup mock for this test file.
// ---------------------------------------------------------------------------

const mockLocale = { current: 'es' };

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        tPlural: (key: string, _count: number) => key,
        locale: mockLocale.current
    })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setLocale(locale: string): void {
    mockLocale.current = locale;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_LABEL = {
    es: 'Catálogo',
    en: 'Catalog',
    pt: 'Catálogo PT'
} as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLocalizedLabel', () => {
    it('returns the Spanish label when locale is "es"', () => {
        setLocale('es');
        const { result } = renderHook(() => useLocalizedLabel(FULL_LABEL));
        expect(result.current).toBe('Catálogo');
    });

    it('returns the English label when locale is "en"', () => {
        setLocale('en');
        const { result } = renderHook(() => useLocalizedLabel(FULL_LABEL));
        expect(result.current).toBe('Catalog');
    });

    it('returns the Portuguese label when locale is "pt"', () => {
        setLocale('pt');
        const { result } = renderHook(() => useLocalizedLabel(FULL_LABEL));
        expect(result.current).toBe('Catálogo PT');
    });

    it('falls back to "es" when the current locale is unknown', () => {
        setLocale('fr'); // unsupported locale
        const { result } = renderHook(() => useLocalizedLabel(FULL_LABEL));
        expect(result.current).toBe('Catálogo');
    });

    it('falls back to the first available key when locale and "es" are both missing', () => {
        setLocale('fr'); // unsupported
        // Fabricate a label object without 'es' (bypassing the Zod schema
        // since this is a test for the fallback path).
        const partialLabel = { en: 'English Only', pt: 'Português' } as unknown as {
            es: string;
            en: string;
            pt: string;
        };
        const { result } = renderHook(() => useLocalizedLabel(partialLabel));
        // 'fr' → no match; 'es' → no match; falls back to first value ('English Only').
        expect(result.current).toBe('English Only');
    });

    it('memoizes the result — stable between re-renders with same locale + label', () => {
        setLocale('es');
        const { result, rerender } = renderHook(() => useLocalizedLabel(FULL_LABEL));
        const first = result.current;
        rerender();
        expect(result.current).toBe(first);
    });

    it('updates when locale changes', () => {
        setLocale('es');
        const { result, rerender } = renderHook(() => useLocalizedLabel(FULL_LABEL));
        expect(result.current).toBe('Catálogo');

        setLocale('en');
        rerender();
        expect(result.current).toBe('Catalog');
    });
});
