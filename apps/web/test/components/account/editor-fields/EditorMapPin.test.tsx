/**
 * @file EditorMapPin.test.tsx
 * @description The shared map pin of the owner editors (HOS-2496): the pin
 * writes both coordinates, the touch overlay steps aside on tap, and the
 * coordinates stay editable by hand. Leaflet is stubbed with a button that
 * stands in for a drag.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
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
        // Owner decision 12: the «no pin» notice lives at the top of the
        // section, never beside the map.
        expect(screen.queryByText(/Todavía no hay pin/)).toBeNull();
        expect(screen.queryByText(/Arrastrá el pin/)).toBeNull();
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
        expect(screen.getByText('Enter coordinates')).toBeInTheDocument();
    });

    it('shows current coordinates in the disclosure summary', () => {
        renderPin({ lat: { name: 'lat', value: '-32.5' }, long: { name: 'long', value: '-58.2' } });
        expect(screen.getByText(/-32.500000, -58.200000/).closest('summary')).not.toBeNull();
    });

    it('opens manual entry when a coordinate has a validation error', () => {
        renderPin({ lat: { name: 'lat', value: '', error: 'Invalid latitude' } });
        expect(screen.getByLabelText(/^Latitud/).closest('details')).toHaveAttribute('open');
    });

    it('lets an editor that stores numbers finish typing a negative coordinate', () => {
        // Regression (HOS-2496): the accommodation and meeting-point editors
        // parse the text to a number and hand back String(number). A bare «-»
        // parsed to null, came back as '', and the owner could never type a
        // southern latitude by hand.
        function NumberBacked() {
            const [lat, setLat] = useState<number | null>(null);
            const parse = (value: string) => parseMapCoordinate({ value });
            return (
                <EditorMapPin
                    locale="es"
                    idPrefix="acc"
                    mapLabel="Mapa"
                    lat={{ name: 'latitude', value: lat === null ? '' : String(lat) }}
                    long={{ name: 'longitude', value: '' }}
                    onChange={(next) => setLat(parse(next.lat))}
                />
            );
        }
        render(<NumberBacked />);
        const latitude = screen.getByLabelText(/^Latitud/);

        fireEvent.change(latitude, { target: { value: '-' } });
        expect(latitude).toHaveValue('-');
        fireEvent.change(latitude, { target: { value: '-32.' } });
        expect(latitude).toHaveValue('-32.');
        fireEvent.change(latitude, { target: { value: '-32.5' } });
        expect(latitude).toHaveValue('-32.5');
    });

    it('follows a moved pin into the coordinate inputs', async () => {
        function Controlled() {
            const [pair, setPair] = useState({ lat: '-32.5', long: '-58.2' });
            return (
                <EditorMapPin
                    locale="es"
                    idPrefix="ce"
                    mapLabel="Mapa del lugar"
                    lat={{ name: 'lat', value: pair.lat }}
                    long={{ name: 'long', value: pair.long }}
                    onChange={setPair}
                />
            );
        }
        render(<Controlled />);

        fireEvent.click(await screen.findByRole('button', { name: 'Mapa del lugar' }));

        expect(screen.getByLabelText(/^Latitud/)).toHaveValue('-32.123457');
        expect(screen.getByLabelText(/^Longitud/)).toHaveValue('-58.765432');
    });

    it('shows the baseline coordinates again after a discard (HOS-2497 review)', () => {
        function Discardable() {
            const baseline = { lat: '-32.5', long: '-58.2' };
            const [pair, setPair] = useState(baseline);
            return (
                <>
                    <EditorMapPin
                        locale="es"
                        idPrefix="ce"
                        mapLabel="Mapa del lugar"
                        lat={{ name: 'lat', value: pair.lat }}
                        long={{ name: 'long', value: pair.long }}
                        onChange={setPair}
                    />
                    <button
                        type="button"
                        onClick={() => setPair(baseline)}
                    >
                        Descartar
                    </button>
                </>
            );
        }
        render(<Discardable />);
        const latitude = screen.getByLabelText(/^Latitud/);

        fireEvent.change(latitude, { target: { value: '-31.9' } });
        fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

        expect(latitude).toHaveValue('-32.5');
    });
});
