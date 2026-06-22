import { useGeocodingSearch } from '@/hooks/useGeocoding';
/**
 * @file LocationPicker.test.tsx
 * @description Tests for LocationPicker component.
 *
 * Verifies rendering, search input interaction, coordinate inputs,
 * and the "use my location" button.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// Mock Spinner CSS module
vi.mock('../../src/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// Hoisted mocks — must be defined before any imports that use them
const { mockMapComponent } = vi.hoisted(() => ({
    mockMapComponent: vi.fn(function MockLocationPickerMap(props: Record<string, unknown>) {
        return (
            <div
                data-testid="mock-map"
                data-lat={String((props.center as { lat: number })?.lat ?? '')}
                data-lng={String((props.center as { lng: number })?.lng ?? '')}
            />
        );
    })
}));

// Mock the geocoding hooks
vi.mock('@/hooks/useGeocoding', () => ({
    useGeocodingSearch: vi.fn(() => ({
        suggestions: [],
        isLoading: false,
        error: null
    })),
    useGeocodingReverse: vi.fn(() => ({
        suggestion: null,
        isLoading: false,
        error: null
    }))
}));

// Mock the LocationPickerMap to avoid Leaflet import
vi.mock('../../src/components/host/editor/LocationPickerMap.client', () => ({
    LocationPickerMap: mockMapComponent
}));

// Import AFTER mocks are set up
const { LocationPicker } = await import('../../src/components/host/editor/LocationPicker.client');

describe('LocationPicker', () => {
    const defaultProps = {
        locale: 'es' as const,
        value: { latitude: null, longitude: null },
        onChange: vi.fn()
    };

    it('should render section title and search input', () => {
        render(<LocationPicker {...defaultProps} />);

        expect(screen.getByText('Ubicación')).toBeInTheDocument();
        expect(screen.getByLabelText('Buscar dirección')).toBeInTheDocument();
    });

    it('should render coordinate inputs', () => {
        render(<LocationPicker {...defaultProps} />);

        expect(screen.getByLabelText('Latitud')).toBeInTheDocument();
        expect(screen.getByLabelText('Longitud')).toBeInTheDocument();
    });

    it('should render use my location button', () => {
        render(<LocationPicker {...defaultProps} />);

        expect(screen.getByText(/Usar mi ubicación actual/)).toBeInTheDocument();
    });

    it('should display lat/lng values when provided', () => {
        render(
            <LocationPicker
                {...defaultProps}
                value={{ latitude: -32.4825, longitude: -58.2372 }}
            />
        );

        const latInput = screen.getByLabelText('Latitud') as HTMLInputElement;
        const lngInput = screen.getByLabelText('Longitud') as HTMLInputElement;

        expect(latInput.value).toBe('-32.4825');
        expect(lngInput.value).toBe('-58.2372');
    });

    it('should call onChange when lat input changes', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(
            <LocationPicker
                {...defaultProps}
                onChange={onChange}
            />
        );

        const latInput = screen.getByLabelText('Latitud');
        await user.type(latInput, '-31.5');

        expect(onChange).toHaveBeenCalled();
    });

    it('should display errors when provided', () => {
        render(
            <LocationPicker
                {...defaultProps}
                errors={{ latitude: 'Latitud inválida' }}
            />
        );

        expect(screen.getByText('Latitud inválida')).toBeInTheDocument();
    });

    it('should render the map component', () => {
        render(<LocationPicker {...defaultProps} />);

        expect(screen.getByTestId('mock-map')).toBeInTheDocument();
    });

    it('shows Spinner (not ⏳) when isSearching is true (SPEC-228 T-017)', () => {
        vi.mocked(useGeocodingSearch).mockReturnValueOnce({
            suggestions: [],
            isLoading: true,
            error: null
        });

        render(<LocationPicker {...defaultProps} />);

        // No hourglass emoji
        expect(document.body.textContent).not.toContain('⏳');
        // Spinner renders a role="status" live region
        expect(screen.getByRole('status')).toBeInTheDocument();
        // Label text is in a sr-only span inside the status role (resolved i18n
        // value uses the ellipsis character).
        expect(screen.getByText('Buscando…')).toBeInTheDocument();
    });

    it('does not show Spinner when isSearching is false', () => {
        render(<LocationPicker {...defaultProps} />);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});
