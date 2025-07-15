import { describe, expect, it } from 'vitest';
import {
    normalizeCreateInput,
    normalizeUpdateInput
} from '../../../src/services/eventLocation/eventLocation.normalizers';
import { createActor } from '../../factories/actorFactory';
import { EventLocationFactoryBuilder } from '../../factories/eventLocationFactory';

const baseInput = EventLocationFactoryBuilder.create({
    street: ' Main St ',
    number: ' 123 ',
    floor: ' 2 ',
    apartment: ' B ',
    neighborhood: ' Downtown ',
    city: ' CityName ',
    department: ' Dept ',
    placeName: ' Venue '
});
const actor = createActor();

describe('eventLocation normalizers', () => {
    it('normalizeCreateInput trims all string fields', () => {
        const result = normalizeCreateInput(baseInput, actor);
        expect(result.street).toBe('Main St');
        expect(result.number).toBe('123');
        expect(result.floor).toBe('2');
        expect(result.apartment).toBe('B');
        expect(result.neighborhood).toBe('Downtown');
        expect(result.city).toBe('CityName');
        expect(result.department).toBe('Dept');
        expect(result.placeName).toBe('Venue');
    });

    it('normalizeUpdateInput trims only present fields', () => {
        const partial = { city: ' CityName ', street: ' Main St ' };
        const result = normalizeUpdateInput(partial, actor);
        expect(result.city).toBe('CityName');
        expect(result.street).toBe('Main St');
    });

    it('normalizeCreateInput ignores coordinates if invalid', () => {
        const input = {
            ...baseInput,
            coordinates: { lat: '', long: undefined as unknown as string }
        } as typeof baseInput;
        const result = normalizeCreateInput(input, actor);
        expect(result.coordinates).toBeUndefined();
    });

    it('normalizeCreateInput handles adminInfo undefined', () => {
        const input = { ...baseInput, adminInfo: undefined };
        const result = normalizeCreateInput(input, actor);
        expect(result.adminInfo).toBeUndefined();
    });

    it('normalizeCreateInput ignores unexpected fields', () => {
        const input = { ...baseInput, unexpectedField: 'foo' } as typeof baseInput & {
            unexpectedField: string;
        };
        const result = normalizeCreateInput(input, actor);
        expect(
            (result as typeof baseInput & { unexpectedField?: string }).unexpectedField
        ).toBeUndefined();
    });

    it('normalizeUpdateInput ignores coordinates if invalid', () => {
        const partial = { coordinates: { lat: '', long: undefined as unknown as string } } as {
            coordinates: { lat: string; long: string };
        };
        const result = normalizeUpdateInput(partial, actor);
        expect(result.coordinates).toBeUndefined();
    });

    it('normalizeUpdateInput handles adminInfo undefined', () => {
        const partial = { adminInfo: undefined };
        const result = normalizeUpdateInput(partial, actor);
        expect(result.adminInfo).toBeUndefined();
    });

    it('normalizeUpdateInput ignores unexpected fields', () => {
        const partial = { city: 'CityName', unexpectedField: 'foo' } as { city: string } & {
            unexpectedField: string;
        };
        const result = normalizeUpdateInput(partial, actor);
        expect(
            (result as { city: string } & { unexpectedField?: string }).unexpectedField
        ).toBeUndefined();
    });

    it('normalizeUpdateInput does not mutate non-string fields', () => {
        const partial = { coordinates: { lat: '1.0', long: '2.0' } };
        const result = normalizeUpdateInput(partial, actor);
        expect(result.coordinates).toEqual({ lat: '1.0', long: '2.0' });
    });

    it('normalizeUpdateInput handles all optional fields as undefined', () => {
        const partial = { city: undefined, street: undefined };
        const result = normalizeUpdateInput(partial, actor);
        expect(result.city).toBeUndefined();
        expect(result.street).toBeUndefined();
    });
});
