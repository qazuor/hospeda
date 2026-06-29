import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapCardsSidebar } from '../../../src/components/maps/MapCardsSidebar.client';

// CSS modules → identity proxy so class names match their keys.
vi.mock('../../../src/components/maps/MapCardsSidebar.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));
vi.mock('../../../src/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// FavoriteButton pulls in API/auth deps not relevant to this test.
vi.mock('../../../src/components/shared/favorite/FavoriteButton.client', () => ({
    FavoriteButton: () => null
}));

// CompareButton pulls in entitlements/store deps; stub it so we can assert it
// renders per card without touching the compare-store or entitlements hook.
vi.mock('../../../src/components/shared/compare/CompareButton.client', () => ({
    CompareButton: () => (
        <button
            type="button"
            data-testid="compare-button"
        />
    )
}));

const i18n = {
    resultsHeading: 'Resultados en el mapa',
    resultsCount: (n: number) => `${n} resultados`,
    emptyState: 'Sin resultados',
    loading: 'Cargando resultados…',
    openSheet: 'Ver tarjetas',
    openSheetCount: (n: number) => `Ver ${n} resultados`,
    closeSheet: 'Cerrar'
};

function renderSidebar(isFetching: boolean) {
    return render(
        <MapCardsSidebar
            items={[]}
            hoveredItemId={null}
            onCardHover={() => {}}
            isFetching={isFetching}
            i18n={i18n}
        />
    );
}

describe('MapCardsSidebar — A1 loading overlay', () => {
    it('shows the loading overlay with an announced spinner while fetching', () => {
        // Arrange / Act
        renderSidebar(true);

        // Assert — the Spinner is a labelled live region announcing the refetch.
        const status = screen.getByRole('status');
        expect(status).toHaveTextContent('Cargando resultados…');
    });

    it('marks the sidebar region aria-busy while fetching', () => {
        // Arrange / Act
        renderSidebar(true);

        // Assert
        const region = screen.getByRole('complementary', {
            name: 'Resultados en el mapa'
        });
        expect(region).toHaveAttribute('aria-busy', 'true');
    });

    it('renders no overlay and is not busy when idle', () => {
        // Arrange / Act
        renderSidebar(false);

        // Assert
        expect(screen.queryByRole('status')).toBeNull();
        const region = screen.getByRole('complementary', {
            name: 'Resultados en el mapa'
        });
        expect(region).toHaveAttribute('aria-busy', 'false');
    });
});

describe('MapCardsSidebar — CompareButton integration (SPEC-288)', () => {
    it('renders a CompareButton for an accommodation card', () => {
        // Arrange / Act
        render(
            <MapCardsSidebar
                items={[{ id: 'acc-1', slug: 'casa-rio', name: 'Casa del Río' }]}
                hoveredItemId={null}
                onCardHover={() => {}}
                isFetching={false}
                i18n={i18n}
            />
        );

        // Assert — the compare toggle shares the map sidebar surface.
        expect(screen.getByTestId('compare-button')).toBeInTheDocument();
    });
});
