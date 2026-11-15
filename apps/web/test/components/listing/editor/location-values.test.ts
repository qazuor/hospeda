/**
 * @file location-values.test.ts
 * @description Load and diff of the venue postal address in the owner editor
 * (HOS-2189).
 */
import { describe, expect, it } from 'vitest';
import {
    buildLocationPatch,
    EMPTY_LOCATION_VALUES,
    parseLocationValues
} from '@/components/listing/editor/location-values';

describe('parseLocationValues', () => {
    it('reads a stored address, coordinates included', () => {
        expect(
            parseLocationValues({
                raw: {
                    street: 'Av. San Martín',
                    number: '123',
                    floor: '2',
                    apartment: 'B',
                    coordinates: { lat: '-32.48', long: '-58.23' }
                }
            })
        ).toEqual({
            street: 'Av. San Martín',
            number: '123',
            floor: '2',
            apartment: 'B',
            lat: '-32.48',
            long: '-58.23'
        });
    });

    it.each([null, undefined, 'x', 42, []])('collapses %s to an empty address', (raw) => {
        expect(parseLocationValues({ raw })).toEqual(EMPTY_LOCATION_VALUES);
    });
});

describe('buildLocationPatch', () => {
    const baseline = { ...EMPTY_LOCATION_VALUES, street: 'Mitre', number: '10' };

    it('is undefined when nothing changed', () => {
        expect(buildLocationPatch({ current: baseline, baseline })).toBeUndefined();
    });

    it('sends only the member that changed', () => {
        expect(buildLocationPatch({ current: { ...baseline, number: '11' }, baseline })).toEqual({
            number: '11'
        });
    });

    it('clears a member with an empty string, never by omission', () => {
        expect(buildLocationPatch({ current: { ...baseline, number: '' }, baseline })).toEqual({
            number: ''
        });
    });

    it('sends the coordinates as a unit, only when both are filled', () => {
        expect(buildLocationPatch({ current: { ...baseline, lat: '-32.4' }, baseline })).toBe(
            undefined
        );
        expect(
            buildLocationPatch({ current: { ...baseline, lat: '-32.4', long: '-58.2' }, baseline })
        ).toEqual({ coordinates: { lat: '-32.4', long: '-58.2' } });
    });
});
