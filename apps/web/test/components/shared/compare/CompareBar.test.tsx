/**
 * @file CompareBar.test.tsx
 * @description Unit tests for the floating CompareBar island (SPEC-288 T-010).
 *
 * Coverage:
 * - Hidden when the selection is empty.
 * - Renders one thumbnail per selected item.
 * - Per-item remove calls removeFromCompare with the right id.
 * - Clear-all calls clearCompare.
 * - CTA links to the comparison page and is enabled only with >= 2 items.
 *
 * The compare-store is mocked so the test drives the `items` snapshot directly
 * and asserts the store mutators are invoked without touching localStorage.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompareBar } from '../../../../src/components/shared/compare/CompareBar.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string) => fallback ?? key,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setItems(items: Array<{ id: string; name?: string; thumbnailUrl?: string }>): void {
    mockStore.value = { ids: items.map((i) => i.id), items };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    mockStore.value = { ids: [], items: [] };
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CompareBar', () => {
    it('renders nothing when the selection is empty', () => {
        const { container } = render(<CompareBar locale="es" />);
        expect(container).toBeEmptyDOMElement();
    });

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

    it('enables the CTA linking to the comparison page when >= 2 items', () => {
        setItems([
            { id: 'a', name: 'Cabaña A' },
            { id: 'b', name: 'Cabaña B' }
        ]);

        render(<CompareBar locale="es" />);
        const cta = screen.getByRole('link', { name: 'Comparar ahora' });

        expect(cta).toHaveAttribute('href', '/es/alojamientos/comparar/');
        expect(cta).toHaveAttribute('aria-disabled', 'false');
    });

    it('disables the CTA when fewer than 2 items are selected', () => {
        setItems([{ id: 'a', name: 'Cabaña A' }]);

        render(<CompareBar locale="es" />);
        const cta = screen.getByRole('link', { name: 'Comparar ahora' });

        expect(cta).toHaveAttribute('aria-disabled', 'true');
        expect(cta).toHaveAttribute('data-disabled', 'true');
    });
});
