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
