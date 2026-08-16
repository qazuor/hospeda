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
import { useGeocodingSearch } from '@/hooks/useGeocoding';

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
        onChange: vi.fn(),
        addressValue: { street: '', number: '', floor: '', apartment: '' },
        onAddressChange: vi.fn()
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

    // -----------------------------------------------------------------------
    // G7 smoke (H-117): exact postal address fields
    // -----------------------------------------------------------------------

    it('should render the four exact-address fields', () => {
        render(<LocationPicker {...defaultProps} />);

        expect(screen.getByLabelText('Calle')).toBeInTheDocument();
        expect(screen.getByLabelText('Número')).toBeInTheDocument();
        expect(screen.getByLabelText('Piso')).toBeInTheDocument();
        expect(screen.getByLabelText('Departamento')).toBeInTheDocument();
    });

    it('should display the current address values', () => {
        render(
            <LocationPicker
                {...defaultProps}
                addressValue={{ street: 'Av. Belgrano', number: '123', floor: '4', apartment: 'B' }}
            />
        );

        expect((screen.getByLabelText('Calle') as HTMLInputElement).value).toBe('Av. Belgrano');
        expect((screen.getByLabelText('Número') as HTMLInputElement).value).toBe('123');
        expect((screen.getByLabelText('Piso') as HTMLInputElement).value).toBe('4');
        expect((screen.getByLabelText('Departamento') as HTMLInputElement).value).toBe('B');
    });

    it('should call onAddressChange with the field name when street changes', async () => {
        const user = userEvent.setup();
        const onAddressChange = vi.fn();

        render(
            <LocationPicker
                {...defaultProps}
                onAddressChange={onAddressChange}
            />
        );

        await user.type(screen.getByLabelText('Calle'), 'X');

        expect(onAddressChange).toHaveBeenCalledWith('street', 'X');
    });

    it('should fill street and number from a selected geocoding suggestion (H-117)', async () => {
        // Before this change the search box resolved a parsed street/number and
        // discarded them — the host saw the full address on screen but only
        // lat/long reached onChange. This is the regression guard for that fix.
        vi.mocked(useGeocodingSearch).mockReturnValue({
            suggestions: [
                {
                    label: 'Av. Belgrano 123, Concepción del Uruguay',
                    lat: -32.48,
                    lng: -58.23,
                    street: 'Av. Belgrano',
                    number: '123'
                }
            ],
            isLoading: false,
            error: null
        });

        const user = userEvent.setup();
        const onAddressChange = vi.fn();
        const onChange = vi.fn();

        render(
            <LocationPicker
                {...defaultProps}
                onChange={onChange}
                onAddressChange={onAddressChange}
            />
        );

        await user.type(screen.getByLabelText('Buscar dirección'), 'Av. Belgrano');
        await user.click(screen.getByText('Av. Belgrano 123, Concepción del Uruguay'));

        expect(onChange).toHaveBeenCalledWith({ latitude: -32.48, longitude: -58.23 });
        expect(onAddressChange).toHaveBeenCalledWith('street', 'Av. Belgrano');
        expect(onAddressChange).toHaveBeenCalledWith('number', '123');
    });

    it('should NOT touch street/number when the suggestion carries none', async () => {
        vi.mocked(useGeocodingSearch).mockReturnValue({
            suggestions: [{ label: 'Somewhere', lat: -32.48, lng: -58.23 }],
            isLoading: false,
            error: null
        });

        const user = userEvent.setup();
        const onAddressChange = vi.fn();

        render(
            <LocationPicker
                {...defaultProps}
                onAddressChange={onAddressChange}
            />
        );

        await user.type(screen.getByLabelText('Buscar dirección'), 'Somewhere');
        await user.click(screen.getByText('Somewhere'));

        expect(onAddressChange).not.toHaveBeenCalled();
    });
});
