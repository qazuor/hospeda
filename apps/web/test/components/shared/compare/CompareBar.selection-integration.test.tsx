/**
 * @file CompareBar.selection-integration.test.tsx
 * @description Integration test proving the global CompareBar reflects a
 * selection built from the accommodation DETAIL page's compare button,
 * across the store's localStorage-backed persist/hydrate cycle (HOS-85 T-012).
 *
 * Unlike `CompareBar.test.tsx` (which mocks the compare-store wholesale to
 * unit-test the bar's rendering logic in isolation), this suite exercises the
 * REAL `compare-store` module: it calls `addToCompare` with metadata exactly
 * as `DetailCompareButton` does (via `useCompareGuard.toggle`), then calls
 * `loadFromStorage()` to simulate the fresh module initialisation that happens
 * on every navigation in this Astro MPA (detail page -> listing page is a full
 * page reload, and the store re-hydrates from localStorage at module load —
 * see the `loadFromStorage()` call at the bottom of `compare-store.ts`).
 *
 * Only `useCompareGuard` (the plan-cap/entitlement layer, which pulls in a
 * network-backed hook) is mocked, mirroring `CompareBar.test.tsx`. The
 * selection itself flows through the real store end to end.
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompareBar } from '../../../../src/components/shared/compare/CompareBar.client';
import { addToCompare, clearCompare, loadFromStorage } from '../../../../src/store/compare-store';

// ---------------------------------------------------------------------------
// Module mocks (everything except the compare-store itself)
// ---------------------------------------------------------------------------

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const base = fallback ?? key;
            if (!params) return base;
            return Object.keys(params).reduce(
                (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
                base
            );
        },
        tPlural: (_key: string, count: number) => `${count} seleccionados`
    })
}));

vi.mock('../../../../src/components/shared/compare/CompareBar.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('@repo/icons', () => ({
    XIcon: ({ size }: { size?: number }) => (
        <svg
            data-testid="x-icon"
            width={size}
            aria-hidden="true"
        />
    ),
    ArrowRightIcon: ({ size }: { size?: number }) => (
        <svg
            data-testid="arrow-right-icon"
            width={size}
            aria-hidden="true"
        />
    )
}));

// The plan-cap layer is mocked (it depends on a network-backed entitlements
// hook, out of scope here); the compare-store selection is NOT mocked.
vi.mock('../../../../src/hooks/useCompareGuard', () => ({
    useCompareGuard: () => ({ maxItems: 2, isLoading: false })
}));

// ---------------------------------------------------------------------------
// Setup / teardown — real store, so reset it between tests.
// ---------------------------------------------------------------------------

beforeEach(() => {
    clearCompare();
    localStorage.clear();
});

afterEach(() => {
    clearCompare();
    localStorage.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CompareBar — cross-page selection integration (HOS-85 US-5)', () => {
    it('reflects an item added via the detail button code path after a simulated page navigation', () => {
        // Arrange: add an accommodation exactly as DetailCompareButton does —
        // `useCompareGuard.toggle` calls `addToCompare(id, meta)` on success.
        addToCompare('acc-detail-1', {
            name: 'Cabaña del Río',
            thumbnailUrl: 'https://img.example.com/acc-detail-1.jpg'
        });

        // Act: simulate the Astro MPA navigation from the detail page back to
        // a listing page — a full page reload re-runs the store module, which
        // calls `loadFromStorage()` once at load time to rehydrate from
        // localStorage. Calling it directly here simulates that fresh load.
        loadFromStorage();
        render(<CompareBar locale="es" />);

        // Assert: the freshly-mounted bar already shows the selection,
        // including the metadata persisted by the detail button.
        expect(screen.getByText('Comparás 1 de 2')).toBeInTheDocument();
        const thumb = screen.getByRole('img', { name: 'Cabaña del Río' });
        expect(thumb).toHaveAttribute('src', 'https://img.example.com/acc-detail-1.jpg');
    });

    it('still reflects the selection when metadata was not supplied (id-only restore)', () => {
        // Arrange: add without metadata (e.g. a pre-HOS-85 persisted id).
        addToCompare('acc-detail-2');

        // Act: simulate the fresh page load rehydrate.
        loadFromStorage();
        render(<CompareBar locale="es" />);

        // Assert: the bar still renders the item as a placeholder thumbnail —
        // it degrades gracefully rather than failing to show the selection.
        expect(screen.getByText('Comparás 1 de 2')).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('hides again once the selection is cleared from the same mounted bar', () => {
        // Arrange: item added and reflected in a mounted bar, as above.
        addToCompare('acc-detail-3', { name: 'Cabaña del Río' });
        loadFromStorage();
        const { container } = render(<CompareBar locale="es" />);
        expect(screen.getByText('Comparás 1 de 2')).toBeInTheDocument();

        // Act: clear the selection (e.g. via the bar's own "Limpiar" action or
        // any other consumer of the store) while the bar is mounted.
        act(() => {
            clearCompare();
        });

        // Assert: the bar hides itself entirely, matching the
        // `items.length === 0` early return in CompareBar.
        expect(container).toBeEmptyDOMElement();
    });
});
