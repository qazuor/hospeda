/**
 * @file CompareBar.test.tsx
 * @description Unit tests for the floating CompareBar island (SPEC-288 T-010,
 * redesigned HOS-85 T-007).
 *
 * Coverage:
 * - Hidden when the selection is empty.
 * - Counter renders "Comparás N de M" once the per-plan cap is known.
 * - Counter falls back to the pluralized count while the cap is loading.
 * - Guidance subtitle shown only when exactly one item is selected.
 * - Empty slots rendered up to the plan cap (cap=2 and cap=4 scenarios).
 * - No empty slots once the selection is at (or the cap is unknown/loading).
 * - Per-item remove calls removeFromCompare with the right id.
 * - Clear-all calls clearCompare.
 * - CTA links to the comparison page and is enabled only with >= 2 items.
 *
 * The compare-store and useCompareGuard hook are mocked so the test drives
 * the `items` snapshot and the plan cap directly, without touching
 * localStorage or the entitlements network call.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompareBar } from '../../../../src/components/shared/compare/CompareBar.client';

// ---------------------------------------------------------------------------
// Module mocks
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

const mockRemove = vi.fn();
const mockClear = vi.fn();
const mockStore = vi.hoisted(() => ({
    value: {
        ids: [] as string[],
        items: [] as Array<{ id: string; name?: string; thumbnailUrl?: string }>
    }
}));

vi.mock('../../../../src/store/compare-store', () => ({
    useCompareStore: () => mockStore.value,
    removeFromCompare: (...args: unknown[]) => mockRemove(...args),
    clearCompare: (...args: unknown[]) => mockClear(...args)
}));

// Mutable guard mock (hoist-safe) — individual tests reshape `value`.
const mockGuard = vi.hoisted(() => ({
    value: {
        maxItems: 2,
        isLoading: false
    }
}));

vi.mock('../../../../src/hooks/useCompareGuard', () => ({
    useCompareGuard: () => mockGuard.value
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setItems(items: Array<{ id: string; name?: string; thumbnailUrl?: string }>): void {
    mockStore.value = { ids: items.map((i) => i.id), items };
}

function setGuard(partial: Partial<typeof mockGuard.value>): void {
    mockGuard.value = { ...mockGuard.value, ...partial };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    mockStore.value = { ids: [], items: [] };
    mockGuard.value = { maxItems: 2, isLoading: false };
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CompareBar — visibility', () => {
    it('renders nothing when the selection is empty', () => {
        const { container } = render(<CompareBar locale="es" />);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('CompareBar — counter', () => {
    it('renders "Comparás N de M" once the plan cap is known', () => {
        setItems([{ id: 'a', name: 'Cabaña A' }]);
        setGuard({ maxItems: 2, isLoading: false });

        render(<CompareBar locale="es" />);

        expect(screen.getByText('Comparás 1 de 2')).toBeInTheDocument();
    });

    it('renders "Comparás N de M" for a 4-item plan cap', () => {
        setItems([
            { id: 'a', name: 'Cabaña A' },
            { id: 'b', name: 'Cabaña B' }
        ]);
        setGuard({ maxItems: 4, isLoading: false });

        render(<CompareBar locale="es" />);

        expect(screen.getByText('Comparás 2 de 4')).toBeInTheDocument();
    });

    it('falls back to the pluralized count while the plan cap is loading', () => {
        setItems([{ id: 'a', name: 'Cabaña A' }]);
        setGuard({ maxItems: -1, isLoading: true });

        render(<CompareBar locale="es" />);

        expect(screen.getByText('1 seleccionados')).toBeInTheDocument();
        expect(screen.queryByText(/Comparás/)).not.toBeInTheDocument();
    });
});

describe('CompareBar — guidance subtitle', () => {
    it('shows the guidance subtitle when exactly 1 item is selected', () => {
        setItems([{ id: 'a', name: 'Cabaña A' }]);
        setGuard({ maxItems: 2, isLoading: false });

        render(<CompareBar locale="es" />);

        expect(screen.getByText('Sumá al menos uno más para comparar')).toBeInTheDocument();
    });

    it('hides the guidance subtitle once 2 or more items are selected', () => {
        setItems([
            { id: 'a', name: 'Cabaña A' },
            { id: 'b', name: 'Cabaña B' }
        ]);
        setGuard({ maxItems: 2, isLoading: false });

        render(<CompareBar locale="es" />);

        expect(screen.queryByText('Sumá al menos uno más para comparar')).not.toBeInTheDocument();
    });
});

describe('CompareBar — empty slots', () => {
    it('renders one empty slot when 1 of 2 items are selected', () => {
        setItems([{ id: 'a', name: 'Cabaña A' }]);
        setGuard({ maxItems: 2, isLoading: false });

        render(<CompareBar locale="es" />);

        expect(screen.getAllByText('Vacío')).toHaveLength(1);
    });

    it('renders no empty slots when the selection is at the 2-item cap', () => {
        setItems([
            { id: 'a', name: 'Cabaña A' },
            { id: 'b', name: 'Cabaña B' }
        ]);
        setGuard({ maxItems: 2, isLoading: false });

        render(<CompareBar locale="es" />);

        expect(screen.queryByText('Vacío')).not.toBeInTheDocument();
    });

    it('renders two empty slots for a 4-item plan cap with 2 selected', () => {
        setItems([
            { id: 'a', name: 'Cabaña A' },
            { id: 'b', name: 'Cabaña B' }
        ]);
        setGuard({ maxItems: 4, isLoading: false });

        render(<CompareBar locale="es" />);

        expect(screen.getAllByText('Vacío')).toHaveLength(2);
    });

    it('renders no empty slots while the plan cap is still loading', () => {
        setItems([{ id: 'a', name: 'Cabaña A' }]);
        setGuard({ maxItems: -1, isLoading: true });

        render(<CompareBar locale="es" />);

        expect(screen.queryByText('Vacío')).not.toBeInTheDocument();
    });
});

describe('CompareBar — thumbnails and removal', () => {
    it('renders one thumbnail per selected item', () => {
        setItems([
            { id: 'a', name: 'Cabaña A', thumbnailUrl: 'https://img/a.jpg' },
            { id: 'b', name: 'Cabaña B', thumbnailUrl: 'https://img/b.jpg' }
        ]);

        render(<CompareBar locale="es" />);

        const thumbs = screen.getAllByRole('img');
        expect(thumbs).toHaveLength(2);
        expect(thumbs[0]).toHaveAttribute('src', 'https://img/a.jpg');
    });

    it('removes a single item via its remove button', () => {
        setItems([
            { id: 'a', name: 'Cabaña A' },
            { id: 'b', name: 'Cabaña B' }
        ]);

        render(<CompareBar locale="es" />);

        // The first remove button corresponds to item "a".
        const removeButtons = screen.getAllByRole('button', { name: /Quitar/ });
        fireEvent.click(removeButtons[0]!);

        expect(mockRemove).toHaveBeenCalledWith('a');
    });

    it('clears the whole selection via the clear button', () => {
        setItems([
            { id: 'a', name: 'Cabaña A' },
            { id: 'b', name: 'Cabaña B' }
        ]);

        render(<CompareBar locale="es" />);
        fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));

        expect(mockClear).toHaveBeenCalledTimes(1);
    });
});

describe('CompareBar — mobile z-index (HOS-85 post-review fix)', () => {
    // The CSS module is mocked (proxy of class names) above, so the z-index
    // value itself is asserted via source text — the project's documented
    // approach for style-source coverage (see apps/web/CLAUDE.md > Testing).
    const cssSrc = readFileSync(
        resolve(__dirname, '../../../../src/components/shared/compare/CompareBar.module.css'),
        'utf8'
    );

    it('anchors the bar z-index above the mobile filters/list-map floating controls', () => {
        // Above FilterSidebar's `.floatingTrigger` (raw 200) and the listing
        // pages' `.view-toggle` (raw 150), both `position: fixed` in the same
        // bottom-of-viewport band on mobile.
        expect(cssSrc).toContain('z-index: calc(var(--z-toast, 200) + 10);');
    });

    it('stays below the filters drawer overlay/panel and the mobile menu', () => {
        // calc(--z-toast + 10) = 210, well under the drawer overlay (300),
        // drawer panel (400), and --z-mobile-menu (9100).
        expect(cssSrc).not.toMatch(/z-index:\s*(300|400|9100)/);
    });
});

describe('CompareBar — data-compare-bar-visible flag (HOS-85 post-review fix)', () => {
    afterEach(() => {
        // Guard against a failing assertion leaving the flag set for later
        // test files that share the same jsdom `document`.
        delete document.documentElement.dataset.compareBarVisible;
    });

    it('does not set the flag when the selection is empty', () => {
        render(<CompareBar locale="es" />);
        expect(document.documentElement.dataset.compareBarVisible).toBeUndefined();
    });

    it('sets data-compare-bar-visible on <html> once an item is selected', () => {
        setItems([{ id: 'a', name: 'Cabaña A' }]);
        render(<CompareBar locale="es" />);
        expect(document.documentElement.dataset.compareBarVisible).toBe('');
    });

    it('clears the flag on unmount', () => {
        setItems([{ id: 'a', name: 'Cabaña A' }]);
        const { unmount } = render(<CompareBar locale="es" />);
        expect(document.documentElement.dataset.compareBarVisible).toBe('');

        unmount();

        expect(document.documentElement.dataset.compareBarVisible).toBeUndefined();
    });
});

describe('CompareBar — CTA', () => {
    it('enables the CTA linking to the comparison page when >= 2 items', () => {
        setItems([
            { id: 'a', name: 'Cabaña A' },
            { id: 'b', name: 'Cabaña B' }
        ]);

        render(<CompareBar locale="es" />);
        const cta = screen.getByRole('link', { name: 'Ver comparación' });

        expect(cta).toHaveAttribute('href', '/es/alojamientos/comparar/');
        expect(cta).toHaveAttribute('aria-disabled', 'false');
    });

    it('disables the CTA when fewer than 2 items are selected', () => {
        setItems([{ id: 'a', name: 'Cabaña A' }]);

        render(<CompareBar locale="es" />);
        const cta = screen.getByRole('link', { name: 'Ver comparación' });

        expect(cta).toHaveAttribute('aria-disabled', 'true');
        expect(cta).toHaveAttribute('data-disabled', 'true');
    });
});
