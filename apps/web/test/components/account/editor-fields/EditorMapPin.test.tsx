/**
 * @file EditorMapPin.test.tsx
 * @description The shared map pin of the owner editors (HOS-2496): the pin
 * writes both coordinates, the touch overlay steps aside on tap, and the
 * coordinates stay editable by hand. Leaflet is stubbed with a button that
 * stands in for a drag.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    EDITOR_MAP_DEFAULT_CENTER,
    EditorMapPin,
    type EditorMapPinProps,
    parseMapCoordinate
} from '@/components/account/editor-fields/EditorMapPin';
import { buildFieldId } from '@/lib/forms/build-field-id';

const mapProps = vi.fn();

vi.mock('@/components/host/editor/LocationPickerMap.client', () => ({
    LocationPickerMap: (props: {
        readonly center: { lat: number; lng: number };
        readonly markerPosition: { lat: number; lng: number } | null;
        readonly onMove: (lat: number, lng: number) => void;
        readonly ariaLabel: string;
    }) => {
        mapProps(props);
        return (
            <button
                type="button"
                aria-label={props.ariaLabel}
                onClick={() => props.onMove(-32.1234567, -58.7654321)}
            >
                drag
            </button>
        );
    }
}));

function renderPin(overrides: Partial<EditorMapPinProps> = {}) {
    const onChange = vi.fn();
    render(
        <EditorMapPin
            locale="es"
            idPrefix="ce"
            mapLabel="Mapa del lugar"
            lat={{ name: 'location.coordinates.lat', value: '' }}
            long={{ name: 'location.coordinates.long', value: '' }}
            onChange={onChange}
            {...overrides}
        />
    );
    return { onChange };
}

describe('EditorMapPin', () => {
    it('opens on the default centre with no pin when there are no coordinates', async () => {
        renderPin();

        await screen.findByRole('button', { name: 'Mapa del lugar' });
        expect(mapProps).toHaveBeenLastCalledWith(
            expect.objectContaining({ center: EDITOR_MAP_DEFAULT_CENTER, markerPosition: null })
        );
        expect(screen.getByText(/Todavía no hay pin/)).toBeInTheDocument();
    });

    it('places the pin on stored coordinates', async () => {
        renderPin({
            lat: { name: 'lat', value: '-32.5' },
            long: { name: 'long', value: '-58.2' }
        });

        await screen.findByRole('button', { name: 'Mapa del lugar' });
        expect(mapProps).toHaveBeenLastCalledWith(
            expect.objectContaining({ markerPosition: { lat: -32.5, lng: -58.2 } })
        );
    });

    it('writes both coordinates, rounded, when the pin moves', async () => {
        const { onChange } = renderPin();

        fireEvent.click(await screen.findByRole('button', { name: 'Mapa del lugar' }));

        expect(onChange).toHaveBeenCalledWith({ lat: '-32.123457', long: '-58.765432' });
    });

    it('removes the touch overlay once tapped', () => {
        renderPin();

        fireEvent.click(screen.getByRole('button', { name: 'Tocá para mover el pin' }));

        expect(screen.queryByRole('button', { name: 'Tocá para mover el pin' })).toBeNull();
    });

    it('keeps the coordinates editable by hand, with the editor field ids', () => {
        const { onChange } = renderPin({
            long: { name: 'location.coordinates.long', value: '-58.2' }
        });

        const latitude = screen.getByLabelText(/^Latitud/);
        expect(latitude).toHaveAttribute(
            'id',
            buildFieldId({ prefix: 'ce', name: 'location.coordinates.lat' })
        );
        fireEvent.change(latitude, { target: { value: '-32.4' } });

        expect(onChange).toHaveBeenCalledWith({ lat: '-32.4', long: '-58.2' });
    });

    it.each([
        ['', null],
        ['  ', null],
        ['abc', null],
        ['-32.5', -32.5]
    ])('parses %j as %j', (value, expected) => {
        expect(parseMapCoordinate({ value })).toBe(expected);
    });

    it('renders its texts in English', () => {
        renderPin({ locale: 'en' });

        expect(screen.getByRole('button', { name: 'Tap to move the pin' })).toBeInTheDocument();
        expect(screen.getByText('Coordinates')).toBeInTheDocument();
    });
});
