/**
 * @file ListingLocationSection.venue.test.tsx
 * @description The venue postal-address section (HOS-2189), rendered through
 * the shared location section since HOS-2496: the listing editor's `location`
 * renderer, exactly as `ListingEditor` mounts it.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LISTING_FIELD_PREFIX } from '@/components/listing/editor/field-ids';
import type {
    ListingEditData,
    ListingFieldChange,
    LocationValues
} from '@/components/listing/editor/listing-edit-data';
import {
    LISTING_SECTION_RENDERERS,
    type ListingSectionRenderContext
} from '@/components/listing/editor/section-renderers';
import { useListingEditState } from '@/components/listing/editor/use-listing-edit-state';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { buildEditData } from '../../listing/editor/edit-data-fixture';

/**
 * The map is Leaflet: out of scope here, covered by LocationPickerMap.test.tsx.
 * The stand-in keeps the `onMove` of its FIRST render, exactly as a Leaflet
 * handler registered once at mount would, so a test can move the pin with a
 * callback that is as stale as the real one could be.
 */
const mapStandIn = vi.hoisted(() => ({
    firstOnMove: null as ((lat: number, lng: number) => void) | null
}));
vi.mock('@/components/host/editor/LocationPickerMap.client', () => ({
    LocationPickerMap: ({ onMove }: { readonly onMove: (lat: number, lng: number) => void }) => {
        const captured = useRef(onMove);
        mapStandIn.firstOnMove = captured.current;
        return null;
    }
}));

const idOf = (name: string) => buildFieldId({ prefix: LISTING_FIELD_PREFIX, name });

/** Props of the test harness: the slice of the render context this section reads. */
interface VenueLocationSectionProps {
    readonly locale: 'es';
    readonly data: ListingEditData;
    readonly errors: Readonly<Record<string, string>>;
    readonly onFieldChange?: ListingFieldChange;
    readonly onLocationChange?: (patch: Partial<LocationValues>) => void;
}

/** Mounts the venue `location` renderer with an otherwise inert context. */
function VenueLocationSection({
    locale,
    data,
    errors,
    onFieldChange = vi.fn(),
    onLocationChange = vi.fn()
}: VenueLocationSectionProps) {
    const context: ListingSectionRenderContext = {
        locale,
        vertical: 'venue',
        data,
        errors: { ...errors },
        destinations: [],
        destinationsLoadFailed: false,
        amenities: [],
        features: [],
        onFieldChange,
        onPolicyChange: vi.fn(),
        onContactChange: vi.fn(),
        onLocationChange,
        onSocialChange: vi.fn(),
        onToggleAmenity: vi.fn(),
        onToggleFeature: vi.fn(),
        onChangeAmenityAttribute: vi.fn(),
        onI18nChange: vi.fn(),
        shouldOfferSlugRefresh: false,
        listingId: 'listing-1'
    };
    return LISTING_SECTION_RENDERERS.location(context);
}

/** Mounts the venue section on the editor's REAL form state, as `ListingEditor` does. */
function StatefulVenueLocation({ initial }: { readonly initial: ListingEditData }) {
    const state = useListingEditState({ buildInitialEditData: () => initial });
    return (
        <>
            <VenueLocationSection
                locale="es"
                data={state.formData}
                errors={{}}
                onFieldChange={state.onFieldChange}
                onLocationChange={state.updateLocation}
            />
            <output data-testid="location-state">{JSON.stringify(state.formData.location)}</output>
        </>
    );
}

describe('venue location (ListingLocationSection)', () => {
    it('seeds every control from the form state', () => {
        render(
            <VenueLocationSection
                locale="es"
                data={buildEditData({
                    location: {
                        street: 'Mitre',
                        number: '10',
                        floor: '1',
                        apartment: 'A',
                        lat: '-32.4',
                        long: '-58.2'
                    }
                })}
                errors={{}}
                onFieldChange={vi.fn()}
            />
        );

        expect((document.getElementById(idOf('location.street')) as HTMLInputElement).value).toBe(
            'Mitre'
        );
        expect(
            (document.getElementById(idOf('location.coordinates.long')) as HTMLInputElement).value
        ).toBe('-58.2');
    });

    it('reports an edit as a patch of the one member it changed', () => {
        const onLocationChange = vi.fn();
        render(
            <VenueLocationSection
                locale="es"
                data={buildEditData()}
                errors={{}}
                onLocationChange={onLocationChange}
            />
        );

        fireEvent.change(document.getElementById(idOf('location.number')) as HTMLInputElement, {
            target: { value: '99' }
        });

        expect(onLocationChange).toHaveBeenCalledWith({ number: '99' });
    });

    it('shows a field error', () => {
        render(
            <VenueLocationSection
                locale="es"
                data={buildEditData()}
                errors={{ 'location.street': 'Calle muy corta' }}
                onFieldChange={vi.fn()}
            />
        );
        expect(screen.getByText('Calle muy corta')).toBeTruthy();
    });

    it('renders one kit Section with the ubicacion help anchor and visible labels (HOS-2496)', () => {
        render(
            <VenueLocationSection
                locale="es"
                data={buildEditData()}
                errors={{}}
                onFieldChange={vi.fn()}
            />
        );

        expect(screen.getByRole('region', { name: 'Dirección' })).toHaveAttribute(
            'data-help',
            'section:venue.ubicacion'
        );
        expect(screen.getByLabelText('Calle')).toHaveAttribute('id', idOf('location.street'));
        expect(screen.getByLabelText(/^Piso/)).toHaveAttribute('id', idOf('location.floor'));
        expect(screen.getByText('Ingresar coordenadas')).toBeInTheDocument();
    });

    it('writes both coordinates when one is typed, keeping the address', () => {
        const onLocationChange = vi.fn();
        render(
            <VenueLocationSection
                locale="es"
                data={buildEditData({
                    location: {
                        street: 'Mitre',
                        number: '10',
                        floor: '',
                        apartment: '',
                        lat: '',
                        long: '-58.2'
                    }
                })}
                errors={{}}
                onLocationChange={onLocationChange}
            />
        );

        fireEvent.change(screen.getByLabelText(/^Latitud/), { target: { value: '-32.48' } });

        expect(onLocationChange).toHaveBeenCalledWith({ lat: '-32.48', long: '-58.2' });
    });

    it('opens the coordinates disclosure when a coordinate has an error', () => {
        render(
            <VenueLocationSection
                locale="es"
                data={buildEditData()}
                errors={{ 'location.coordinates.lat': 'Latitud inválida' }}
                onFieldChange={vi.fn()}
            />
        );

        expect(screen.getByText('Ingresar coordenadas').closest('details')).toHaveAttribute('open');
        expect(screen.getByLabelText(/^Latitud/)).toHaveAccessibleDescription(/Latitud inválida/);
    });
});

describe('venue location — what only the accommodation has', () => {
    it('renders no address search and no «use my location» (HOS-2496)', () => {
        render(
            <VenueLocationSection
                locale="es"
                data={buildEditData()}
                errors={{}}
                onFieldChange={vi.fn()}
            />
        );

        expect(screen.queryByLabelText('Buscar en el mapa')).not.toBeInTheDocument();
        expect(screen.queryByText(/Usar mi ubicación actual/)).not.toBeInTheDocument();
    });
});

describe('venue location — a pin move after an address edit (HOS-2496 review)', () => {
    beforeEach(() => {
        mapStandIn.firstOnMove = null;
    });

    it('keeps the address typed after mount when the pin is moved', () => {
        render(
            <StatefulVenueLocation
                initial={buildEditData({
                    location: {
                        street: 'Mitre',
                        number: '10',
                        floor: '',
                        apartment: '',
                        lat: '-32.4',
                        long: '-58.2'
                    }
                })}
            />
        );

        fireEvent.change(document.getElementById(idOf('location.street')) as HTMLInputElement, {
            target: { value: 'Rocamora' }
        });
        fireEvent.change(document.getElementById(idOf('location.number')) as HTMLInputElement, {
            target: { value: '850' }
        });
        fireEvent.change(document.getElementById(idOf('location.floor')) as HTMLInputElement, {
            target: { value: '2' }
        });

        // The map moves the pin through the callback it captured at mount.
        act(() => {
            mapStandIn.firstOnMove?.(-32.48, -58.23);
        });

        expect(JSON.parse(screen.getByTestId('location-state').textContent ?? '{}')).toEqual({
            street: 'Rocamora',
            number: '850',
            floor: '2',
            apartment: '',
            lat: '-32.480000',
            long: '-58.230000'
        });
        expect((document.getElementById(idOf('location.street')) as HTMLInputElement).value).toBe(
            'Rocamora'
        );
    });
});
