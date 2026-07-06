/**
 * @file MapCardsSidebar.test.tsx
 * @description Unit tests for the MapCardsSidebar React island.
 *
 * Coverage:
 * - A1 (SPEC-228): loading overlay + aria-busy while a viewport refetch is
 *   in flight.
 * - Contextual CompareButton (HOS-85): the map sidebar cards render the same
 *   mode-gated compare control as `AccommodationCard.astro` — hidden while
 *   compare mode is off, shown (and add/remove-reactive) while it's on.
 *
 * The CompareButton tests exercise the REAL `useCompareGuard` + compare-store
 * (mode + selection) so add/remove/label-switch reactivity is verified end to
 * end, mirroring `DetailCompareButton.test.tsx`. Only `useMyEntitlements` (the
 * network-backed leaf) is mocked.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapCardsSidebar } from '../../../src/components/maps/MapCardsSidebar.client';
import { COMPARE_ENTITLEMENT_KEY, COMPARE_LIMIT_KEY } from '../../../src/hooks/useCompareGuard';
import { clearCompare, setCompareMode } from '../../../src/store/compare-store';

// Same stub as CompareButton.test.tsx / DetailCompareButton.test.tsx: returns
// the fallback copy verbatim (no `{{name}}` interpolation) so assertions don't
// depend on the real @repo/i18n locale catalog.
vi.mock('../../../src/lib/i18n', () => ({
    createT: (_locale: string) => (key: string, fallback?: string) => fallback ?? key
}));

// CSS modules → identity proxy so class names match their keys.
vi.mock('../../../src/components/maps/MapCardsSidebar.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));
vi.mock('../../../src/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));
vi.mock('../../../src/components/shared/compare/CompareButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// FavoriteButton pulls in API/auth deps not relevant to this test.
vi.mock('../../../src/components/shared/favorite/FavoriteButton.client', () => ({
    FavoriteButton: () => null
}));

// Mock useMyEntitlements (mutable per-test value, hoist-safe) — the network
// leaf consumed by the REAL useCompareGuard used by CompareButton. Everything
// above it (guard + compare-store) runs for real.
const mockEntitlements = vi.hoisted(() => ({
    value: {
        has: (_key: string) => false,
        limit: (_key: string) => -1,
        plan: null,
        isLoading: false,
        error: null as Error | null
    }
}));

vi.mock('../../../src/hooks/useMyEntitlements', () => ({
    useMyEntitlements: () => mockEntitlements.value
}));

/** Build a fake entitlements return for a plan with a given compare cap. */
function asPlan(maxItems: number): void {
    mockEntitlements.value = {
        has: (key: string) => key === COMPARE_ENTITLEMENT_KEY,
        limit: (key: string) => (key === COMPARE_LIMIT_KEY ? maxItems : -1),
        plan: null,
        isLoading: false,
        error: null
    };
}

const i18n = {
    resultsHeading: 'Resultados en el mapa',
    resultsCount: (n: number) => `${n} resultados`,
    emptyState: 'Sin resultados',
    loading: 'Cargando resultados…',
    openSheet: 'Ver tarjetas',
    openSheetCount: (n: number) => `Ver ${n} resultados`,
    closeSheet: 'Cerrar'
};

const item = { id: 'acc-1', slug: 'casa-rio', name: 'Casa del Río' };

function renderSidebar(overrides: Partial<Parameters<typeof MapCardsSidebar>[0]> = {}) {
    return render(
        <MapCardsSidebar
            items={[item]}
            hoveredItemId={null}
            onCardHover={() => {}}
            isFetching={false}
            i18n={i18n}
            {...overrides}
        />
    );
}

beforeEach(() => {
    asPlan(2);
    setCompareMode(false);
    clearCompare();
});

afterEach(() => {
    setCompareMode(false);
    clearCompare();
    vi.clearAllMocks();
});

describe('MapCardsSidebar — A1 loading overlay', () => {
    it('shows the loading overlay with an announced spinner while fetching', () => {
        // Arrange / Act
        renderSidebar({ items: [], isFetching: true });

        // Assert — the Spinner is a labelled live region announcing the refetch.
        const status = screen.getByRole('status');
        expect(status).toHaveTextContent('Cargando resultados…');
    });

    it('marks the sidebar region aria-busy while fetching', () => {
        // Arrange / Act
        renderSidebar({ items: [], isFetching: true });

        // Assert
        const region = screen.getByRole('complementary', {
            name: 'Resultados en el mapa'
        });
        expect(region).toHaveAttribute('aria-busy', 'true');
    });

    it('renders no overlay and is not busy when idle', () => {
        // Arrange / Act
        renderSidebar({ items: [] });

        // Assert
        expect(screen.queryByRole('status')).toBeNull();
        const region = screen.getByRole('complementary', {
            name: 'Resultados en el mapa'
        });
        expect(region).toHaveAttribute('aria-busy', 'false');
    });
});

describe('MapCardsSidebar — contextual CompareButton (HOS-85)', () => {
    it('renders no compare control while compare mode is off (the default)', () => {
        // Arrange / Act
        renderSidebar();

        // Assert
        expect(screen.queryByRole('button', { name: /comparación/i })).not.toBeInTheDocument();
    });

    it('renders the "Agregar" compare control once compare mode is turned on', () => {
        // Arrange
        setCompareMode(true);

        // Act
        renderSidebar();

        // Assert
        const button = screen.getByRole('button', { name: 'Agregar a comparación' });
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('adds the accommodation and switches the label to "Agregado" on click', () => {
        // Arrange
        setCompareMode(true);
        renderSidebar();
        const button = screen.getByRole('button', { name: 'Agregar a comparación' });

        // Act
        fireEvent.click(button);

        // Assert
        expect(screen.getByText('Agregado')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Quitar de comparación' })).toHaveAttribute(
            'aria-pressed',
            'true'
        );
    });

    it('removes the accommodation and restores the "Agregar" label on a second click', () => {
        // Arrange
        setCompareMode(true);
        renderSidebar();
        const addButton = screen.getByRole('button', { name: 'Agregar a comparación' });
        fireEvent.click(addButton); // add

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Quitar de comparación' })); // remove

        // Assert
        expect(screen.getByText('Agregar')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Agregar a comparación' })).toHaveAttribute(
            'aria-pressed',
            'false'
        );
    });

    it('does not trigger card navigation/selection when the compare control is clicked', () => {
        // Arrange — desktop mode (default jsdom matchMedia mock) renders the
        // card as a div[role=button] wired to onCardSelect; clicking the
        // compare button must not bubble into it (CompareButton's own
        // handleClick stops propagation).
        setCompareMode(true);
        const onCardSelect = vi.fn();
        renderSidebar({ onCardSelect });

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Agregar a comparación' }));

        // Assert
        expect(onCardSelect).not.toHaveBeenCalled();
    });

    it('hides the compare control again when compare mode is turned back off', () => {
        // Arrange
        setCompareMode(true);
        const { rerender } = renderSidebar();
        expect(screen.getByRole('button', { name: 'Agregar a comparación' })).toBeInTheDocument();

        // Act
        setCompareMode(false);
        rerender(
            <MapCardsSidebar
                items={[item]}
                hoveredItemId={null}
                onCardHover={() => {}}
                isFetching={false}
                i18n={i18n}
            />
        );

        // Assert
        expect(screen.queryByRole('button', { name: /comparación/i })).not.toBeInTheDocument();
    });
});
