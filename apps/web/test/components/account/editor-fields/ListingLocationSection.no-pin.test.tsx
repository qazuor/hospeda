/**
 * @file ListingLocationSection.no-pin.test.tsx
 * @description Owner decision 12 (Mi cuenta UI epic): a location without a pin
 * shows ONE notice at the top of the section, with a button that scrolls to and
 * focuses the map. The map no longer carries its own «no pin» line.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    ListingLocationSection,
    type ListingLocationSectionProps
} from '@/components/account/editor-fields/ListingLocationSection';

vi.mock('@/components/host/editor/LocationPickerMap.client', () => ({
    LocationPickerMap: ({ ariaLabel }: { readonly ariaLabel: string }) => (
        <div
            className="leaflet-container"
            role="application"
            tabIndex={-1}
            aria-label={ariaLabel}
        />
    )
}));

function renderSection(coordinates: { readonly lat: string; readonly long: string }) {
    const props: ListingLocationSectionProps = {
        locale: 'es',
        idPrefix: 'ce',
        title: 'Ubicación',
        helpId: 'section:accommodation.ubicacion',
        pin: {
            lat: { name: 'lat', value: coordinates.lat },
            long: { name: 'long', value: coordinates.long },
            onChange: vi.fn(),
            mapLabel: 'Mapa del lugar'
        }
    };
    return render(<ListingLocationSection {...props} />);
}

describe('ListingLocationSection without a pin (owner decision 12)', () => {
    it('shows one notice at the top of the section, before every field', () => {
        // Arrange + Act
        const { container } = renderSection({ lat: '', long: '' });

        // Assert
        const notices = screen.getAllByText('Todavía no marcaste el lugar en el mapa');
        expect(notices).toHaveLength(1);
        const stack = container.querySelector('[data-editor-map-frame]')?.closest('div')
            ?.parentElement?.parentElement;
        expect(stack?.firstElementChild?.textContent).toContain(
            'Todavía no marcaste el lugar en el mapa'
        );
        expect(screen.getByText(/Sin pin, tu ficha no muestra en el mapa/)).toBeInTheDocument();
    });

    it('scrolls to the map and focuses it from the notice button', async () => {
        // Arrange
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        const { container } = renderSection({ lat: '', long: '' });
        const frame = container.querySelector<HTMLElement>('[data-editor-map-frame]');
        await within(frame as HTMLElement).findByLabelText('Mapa del lugar');

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Ir al mapa' }));

        // Assert
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        const focused = document.activeElement;
        expect(frame?.contains(focused)).toBe(true);
    });

    it('shows no notice once the pin is placed', () => {
        renderSection({ lat: '-32.5', long: '-58.2' });
        expect(screen.queryByText('Todavía no marcaste el lugar en el mapa')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Ir al mapa' })).toBeNull();
    });

    it('puts the map action below the body instead of in the Alert action column', () => {
        renderSection({ lat: '', long: '' });
        const body = screen.getByText(/Sin pin, tu ficha no muestra en el mapa/);
        expect(
            body.parentElement?.contains(screen.getByRole('button', { name: 'Ir al mapa' }))
        ).toBe(true);
    });
});
