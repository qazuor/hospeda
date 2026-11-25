/**
 * @file ListingLocationSection.accommodation.test.tsx
 * @description The shared location section as the accommodation editor
 * configures it (HOS-2496): exact address, address search, «use my location»,
 * the unplaced-pin notice and the reverse-geocoded pin reference. Ported from
 * the retired `LocationPicker` tests (H-117, HOS-795, HOS-1767, SPEC-228), so
 * the behaviour they pinned survives the fusion.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type AddressMember,
    ListingLocationSection
} from '@/components/account/editor-fields/ListingLocationSection';
import { useGeocodingReverse, useGeocodingSearch } from '@/hooks/useGeocoding';

vi.mock('../../../../src/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_target, prop) => String(prop) })
}));

vi.mock('@/hooks/useGeocoding', () => ({
    useGeocodingSearch: vi.fn(() => ({ suggestions: [], isLoading: false, error: null })),
    useGeocodingReverse: vi.fn(() => ({ suggestion: null, isLoading: false, error: null }))
}));

vi.mock('@/components/host/editor/LocationPickerMap.client', () => ({
    LocationPickerMap: () => <div data-testid="mock-map" />
}));

const ADDRESS_LABELS = {
    street: 'Calle',
    number: 'Número',
    floor: 'Piso',
    apartment: 'Departamento'
};
type AddressKey = keyof typeof ADDRESS_LABELS;

interface HarnessProps {
    readonly address?: Partial<Record<AddressKey, string>>;
    readonly lat?: string;
    readonly long?: string;
    readonly latError?: string;
    readonly onAddress?: (key: AddressKey, value: string) => void;
    readonly onPin?: (next: { readonly lat: string; readonly long: string }) => void;
    readonly onAddressFound?: (found: { street?: string; number?: string }) => void;
}

/** Renders the section the way `LocationForm` configures it. */
function renderAccommodation({
    address = {},
    lat = '',
    long = '',
    latError,
    onAddress = vi.fn(),
    onPin = vi.fn(),
    onAddressFound = vi.fn()
}: HarnessProps = {}) {
    const members: AddressMember[] = (Object.keys(ADDRESS_LABELS) as AddressKey[]).map((key) => ({
        name: key,
        label: ADDRESS_LABELS[key],
        value: address[key] ?? '',
        onChange: (value: string) => onAddress(key, value)
    }));
    return render(
        <ListingLocationSection
            locale="es"
            idPrefix="acc"
            title="Ubicación"
            description="Dirección exacta. Los turistas solo ven una ubicación aproximada en el mapa público."
            helpId="section:accommodation.ubicacion"
            address={members}
            finder={{ onAddressFound }}
            pin={{
                mapLabel: 'Mapa de ubicación',
                lat: { name: 'latitude', value: lat, error: latError },
                long: { name: 'longitude', value: long },
                onChange: onPin
            }}
        />
    );
}

const SUGGESTION = {
    label: 'Av. Belgrano 123, Concepción del Uruguay',
    lat: -32.48,
    lng: -58.23,
    street: 'Av. Belgrano',
    number: '123'
};

afterEach(() => {
    vi.mocked(useGeocodingSearch).mockReturnValue({
        suggestions: [],
        isLoading: false,
        error: null
    });
    vi.mocked(useGeocodingReverse).mockReturnValue({
        suggestion: null,
        isLoading: false,
        error: null
    });
});

describe('accommodation location — address and ids', () => {
    it('renders one kit Section with the ubicacion help anchor and the privacy copy', () => {
        renderAccommodation();

        expect(screen.getByRole('region', { name: 'Ubicación' })).toHaveAttribute(
            'data-help',
            'section:accommodation.ubicacion'
        );
        expect(screen.getByText(/solo ven una ubicación aproximada/)).toBeInTheDocument();
    });

    it('keeps the accommodation field ids (acc-<zod key>)', () => {
        renderAccommodation();

        for (const id of [
            'acc-street',
            'acc-number',
            'acc-floor',
            'acc-apartment',
            'acc-latitude',
            'acc-longitude'
        ]) {
            expect(document.getElementById(id)).not.toBeNull();
        }
        expect(screen.getByLabelText('Piso')).toHaveAttribute('id', 'acc-floor');
    });

    it('reports each address field by its own key (H-117)', async () => {
        const onAddress = vi.fn();
        renderAccommodation({ onAddress });

        await userEvent.setup().type(screen.getByLabelText('Calle'), 'X');

        expect(onAddress).toHaveBeenCalledWith('street', 'X');
    });

    it('renders the address before the search box and the map (HOS-795 AC-1)', async () => {
        renderAccommodation();

        const street = screen.getByLabelText('Calle');
        const map = await screen.findByTestId('mock-map');
        const search = screen.getByLabelText('Buscar en el mapa');

        expect(
            street.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(search.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});

describe('accommodation location — address search', () => {
    beforeEach(() => {
        vi.mocked(useGeocodingSearch).mockReturnValue({
            suggestions: [SUGGESTION],
            isLoading: false,
            error: null
        });
    });

    it('places the pin and fills street and number from a picked suggestion (H-117)', async () => {
        const onPin = vi.fn();
        const onAddressFound = vi.fn();
        renderAccommodation({ onPin, onAddressFound });
        const user = userEvent.setup();

        await user.type(screen.getByLabelText('Buscar en el mapa'), 'Av. Belgrano');
        await user.click(screen.getByText(SUGGESTION.label));

        expect(onPin).toHaveBeenCalledWith({ lat: '-32.48', long: '-58.23' });
        expect(onAddressFound).toHaveBeenCalledWith({ street: 'Av. Belgrano', number: '123' });
        expect(screen.getByLabelText('Buscar en el mapa')).toHaveValue(SUGGESTION.label);
    });

    it('does not touch the address when the suggestion carries none', async () => {
        vi.mocked(useGeocodingSearch).mockReturnValue({
            suggestions: [{ label: 'Somewhere', lat: -32.48, lng: -58.23 }],
            isLoading: false,
            error: null
        });
        const onAddressFound = vi.fn();
        renderAccommodation({ onAddressFound });
        const user = userEvent.setup();

        await user.type(screen.getByLabelText('Buscar en el mapa'), 'Somewhere');
        await user.click(screen.getByText('Somewhere'));

        expect(onAddressFound).not.toHaveBeenCalled();
    });

    it('says, accessibly, that the search box is not saved (HOS-795 AC-2)', () => {
        renderAccommodation();

        expect(screen.getByLabelText('Buscar en el mapa')).toHaveAccessibleDescription(
            /no se guarda/
        );
    });

    it('shows a Spinner, never an hourglass, while searching (SPEC-228)', () => {
        vi.mocked(useGeocodingSearch).mockReturnValue({
            suggestions: [],
            isLoading: true,
            error: null
        });
        renderAccommodation();

        expect(document.body.textContent).not.toContain('⏳');
        expect(screen.getByText('Buscando…')).toBeInTheDocument();
    });
});

describe('accommodation location — pin reference and notice', () => {
    const PIN_LABEL = 'Concepción del Uruguay, Distrito Molino, Entre Ríos, Argentina';

    it('never prefills the search box from the reverse geocoder (HOS-795 AC-3)', () => {
        vi.mocked(useGeocodingReverse).mockReturnValue({
            suggestion: { label: PIN_LABEL, lat: -32.4873, lng: -58.36 },
            isLoading: false,
            error: null
        });
        renderAccommodation({ lat: '-32.4873', long: '-58.36' });

        expect(screen.getByLabelText('Buscar en el mapa')).toHaveValue('');
        expect(screen.getByText('El pin está en:')).toBeInTheDocument();
        expect(screen.queryByDisplayValue(PIN_LABEL)).not.toBeInTheDocument();
    });

    it('explains the unplaced pin above the map, and drops it once placed (HOS-1767)', async () => {
        const { rerender } = renderAccommodation();
        const notice = screen.getByText(/Todavía no marcaste el lugar en el mapa/);
        const map = await screen.findByTestId('mock-map');
        expect(notice.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        rerender(
            <ListingLocationSection
                locale="es"
                idPrefix="acc"
                title="Ubicación"
                helpId="section:accommodation.ubicacion"
                finder={{ onAddressFound: vi.fn() }}
                pin={{
                    mapLabel: 'Mapa de ubicación',
                    lat: { name: 'latitude', value: '-32.48' },
                    long: { name: 'longitude', value: '-58.23' },
                    onChange: vi.fn()
                }}
            />
        );
        expect(
            screen.queryByText(/Todavía no marcaste el lugar en el mapa/)
        ).not.toBeInTheDocument();
    });
});

describe('accommodation location — «use my location»', () => {
    const original = navigator.geolocation;
    afterEach(() => {
        Object.defineProperty(navigator, 'geolocation', { value: original, configurable: true });
    });

    it('places the pin from the browser position', async () => {
        Object.defineProperty(navigator, 'geolocation', {
            configurable: true,
            value: {
                getCurrentPosition: (
                    ok: (position: { coords: { latitude: number; longitude: number } }) => void
                ) => ok({ coords: { latitude: -32.5, longitude: -58.2 } })
            }
        });
        const onPin = vi.fn();
        renderAccommodation({ onPin });

        await userEvent
            .setup()
            .click(screen.getByRole('button', { name: /Usar mi ubicación actual/ }));

        expect(onPin).toHaveBeenCalledWith({ lat: '-32.5', long: '-58.2' });
    });

    it('explains a refused permission', async () => {
        Object.defineProperty(navigator, 'geolocation', {
            configurable: true,
            value: {
                getCurrentPosition: (
                    _ok: unknown,
                    fail: (error: { code: number; PERMISSION_DENIED: number }) => void
                ) => fail({ code: 1, PERMISSION_DENIED: 1 })
            }
        });
        renderAccommodation();

        await userEvent
            .setup()
            .click(screen.getByRole('button', { name: /Usar mi ubicación actual/ }));

        expect(screen.getByRole('alert')).toHaveTextContent(/Permiso denegado/);
    });
});

describe('accommodation location — coordinates', () => {
    it('shows a coordinate error inside an open «Coordenadas» disclosure', () => {
        renderAccommodation({ latError: 'Latitud inválida' });

        expect(screen.getByText('Ingresar coordenadas').closest('details')).toHaveAttribute('open');
        expect(screen.getByLabelText(/^Latitud/)).toHaveAccessibleDescription(/Latitud inválida/);
    });

    it('writes both coordinates when one is typed', () => {
        const onPin = vi.fn();
        renderAccommodation({ onPin, long: '-58.2' });

        fireEvent.change(screen.getByLabelText(/^Latitud/), { target: { value: '-31.5' } });

        expect(onPin).toHaveBeenCalledWith({ lat: '-31.5', long: '-58.2' });
    });
});
