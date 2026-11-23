/**
 * @file VenueLocationSection.test.tsx
 * @description Unit coverage for the venue postal-address section (HOS-2189).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LISTING_FIELD_PREFIX } from '@/components/listing/editor/field-ids';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { VenueLocationSection } from '../../../../src/components/listing/editor/VenueLocationSection.client';
import { buildEditData } from './edit-data-fixture';

// The map is Leaflet: out of scope here, covered by LocationPickerMap.test.tsx.
vi.mock('@/components/host/editor/LocationPickerMap.client', () => ({
    LocationPickerMap: () => null
}));

const idOf = (name: string) => buildFieldId({ prefix: LISTING_FIELD_PREFIX, name });

describe('VenueLocationSection', () => {
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

    it('reports an edit as a whole replacement of the location state', () => {
        const onFieldChange = vi.fn();
        render(
            <VenueLocationSection
                locale="es"
                data={buildEditData()}
                errors={{}}
                onFieldChange={onFieldChange}
            />
        );

        fireEvent.change(document.getElementById(idOf('location.number')) as HTMLInputElement, {
            target: { value: '99' }
        });

        expect(onFieldChange).toHaveBeenCalledWith('location', {
            street: '',
            number: '99',
            floor: '',
            apartment: '',
            lat: '',
            long: ''
        });
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
        expect(screen.getByText('Coordenadas')).toBeInTheDocument();
    });

    it('writes both coordinates when one is typed, keeping the address', () => {
        const onFieldChange = vi.fn();
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
                onFieldChange={onFieldChange}
            />
        );

        fireEvent.change(screen.getByLabelText(/^Latitud/), { target: { value: '-32.48' } });

        expect(onFieldChange).toHaveBeenCalledWith('location', {
            street: 'Mitre',
            number: '10',
            floor: '',
            apartment: '',
            lat: '-32.48',
            long: '-58.2'
        });
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

        expect(screen.getByText('Coordenadas').closest('details')).toHaveAttribute('open');
        expect(screen.getByLabelText(/^Latitud/)).toHaveAccessibleDescription(/Latitud inválida/);
    });
});
