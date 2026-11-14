import { describe, expect, it } from 'vitest';
import { buildLocationKey } from '../src/location-key';

const DEST = 'dest-1';

describe('buildLocationKey', () => {
    it('builds street|number|destination for a plain address', () => {
        // Arrange / Act
        const key = buildLocationKey({ street: 'San Martin', number: '123', destinationId: DEST });
        // Assert
        expect(key).toBe('san martin|123|dest-1');
    });

    it('treats accents, case and extra spaces as the same address', () => {
        const a = buildLocationKey({ street: 'San Martín', number: '123', destinationId: DEST });
        const b = buildLocationKey({
            street: '  SAN   MARTIN ',
            number: '123',
            destinationId: DEST
        });
        expect(a).toBe(b);
    });

    it('unifies the spellings of one street type to a canonical token', () => {
        const canonical = buildLocationKey({
            street: 'Avenida San Martin',
            number: '123',
            destinationId: DEST
        });
        for (const street of [
            'Av. San Martín',
            'Av San Martin',
            'AVDA. San Martin',
            'avenida SAN MARTIN'
        ]) {
            expect(buildLocationKey({ street, number: '123', destinationId: DEST })).toBe(
                canonical
            );
        }
        const calle = buildLocationKey({ street: 'Calle Mitre', number: '1', destinationId: DEST });
        expect(buildLocationKey({ street: 'C. Mitre', number: '1', destinationId: DEST })).toBe(
            calle
        );
        const ruta = buildLocationKey({ street: 'Ruta 9', number: '1', destinationId: DEST });
        for (const street of ['RN 9', 'R.N. 9', 'rp 9', 'Ruta nacional 9']) {
            expect(buildLocationKey({ street, number: '1', destinationId: DEST })).toBe(ruta);
        }
        const pje = buildLocationKey({ street: 'Pasaje Sur', number: '1', destinationId: DEST });
        expect(buildLocationKey({ street: 'Pje. Sur', number: '1', destinationId: DEST })).toBe(
            pje
        );
        const bv = buildLocationKey({
            street: 'Boulevard Peron',
            number: '1',
            destinationId: DEST
        });
        for (const street of ['Bv. Peron', 'Bvard Peron', 'Bulevar Peron']) {
            expect(buildLocationKey({ street, number: '1', destinationId: DEST })).toBe(bv);
        }
    });

    it('keeps different street types apart: Calle 9, Ruta 9 and Av. 9 are three places', () => {
        const keys = ['Calle 9', 'Ruta 9', 'Av. 9', 'Pasaje 9', 'Boulevard 9'].map((street) =>
            buildLocationKey({ street, number: '1', destinationId: DEST })
        );
        expect(new Set(keys).size).toBe(5);
    });

    it('keeps a typed street apart from the bare name (documented false negative)', () => {
        const bare = buildLocationKey({ street: 'San Martin', number: '123', destinationId: DEST });
        const typed = buildLocationKey({
            street: 'Av. San Martin',
            number: '123',
            destinationId: DEST
        });
        expect(bare).not.toBe(typed);
    });

    it('expands common title abbreviations', () => {
        const full = buildLocationKey({
            street: 'General San Martin',
            number: '1',
            destinationId: DEST
        });
        expect(
            buildLocationKey({ street: 'Gral. San Martin', number: '1', destinationId: DEST })
        ).toBe(full);
        expect(
            buildLocationKey({ street: 'Gral San Martin', number: '1', destinationId: DEST })
        ).toBe(full);
        const dr = buildLocationKey({ street: 'Doctor Haedo', number: '1', destinationId: DEST });
        expect(buildLocationKey({ street: 'Dr. Haedo', number: '1', destinationId: DEST })).toBe(
            dr
        );
        const cnel = buildLocationKey({
            street: 'Coronel Suarez',
            number: '1',
            destinationId: DEST
        });
        expect(buildLocationKey({ street: 'Cnel. Suarez', number: '1', destinationId: DEST })).toBe(
            cnel
        );
        const pte = buildLocationKey({
            street: 'Presidente Peron',
            number: '1',
            destinationId: DEST
        });
        expect(buildLocationKey({ street: 'Pte. Peron', number: '1', destinationId: DEST })).toBe(
            pte
        );
    });

    it('strips punctuation', () => {
        const key = buildLocationKey({
            street: 'Gral. J. de San-Martin',
            number: '12,',
            destinationId: DEST
        });
        expect(key).toBe('general j de san martin|12|dest-1');
    });

    it.each([
        's/n',
        'S/N',
        'sn',
        's n',
        'S/N.',
        'sin número',
        'sin numero',
        '0',
        '',
        '   ',
        'km'
    ])('returns null for a number with no digits or s/n: %j', (number) => {
        expect(
            buildLocationKey({ street: 'Camino al arroyo', number, destinationId: DEST })
        ).toBeNull();
    });

    it('returns null when the number is absent', () => {
        expect(buildLocationKey({ street: 'San Martin', destinationId: DEST })).toBeNull();
        expect(
            buildLocationKey({ street: 'San Martin', number: null, destinationId: DEST })
        ).toBeNull();
    });

    it('returns null when street or destination is missing', () => {
        expect(buildLocationKey({ number: '1', destinationId: DEST })).toBeNull();
        expect(buildLocationKey({ street: ' ', number: '1', destinationId: DEST })).toBeNull();
        expect(buildLocationKey({ street: 'x street', number: '1' })).toBeNull();
        expect(buildLocationKey({ street: 'x street', number: '1', destinationId: '' })).toBeNull();
    });

    it('returns null when the street is only a street type', () => {
        expect(buildLocationKey({ street: 'Av.', number: '1', destinationId: DEST })).toBeNull();
    });

    it('adds floor and apartment to the key', () => {
        const key = buildLocationKey({
            street: 'Urquiza',
            number: '50',
            floor: '2',
            apartment: 'B',
            destinationId: DEST
        });
        expect(key).toBe('urquiza|50|dest-1|2|b');
    });

    it('gives different keys to different floors or apartments', () => {
        const a = buildLocationKey({
            street: 'Urquiza',
            number: '50',
            floor: '1',
            destinationId: DEST
        });
        const b = buildLocationKey({
            street: 'Urquiza',
            number: '50',
            floor: '2',
            destinationId: DEST
        });
        const c = buildLocationKey({
            street: 'Urquiza',
            number: '50',
            floor: '2',
            apartment: 'A',
            destinationId: DEST
        });
        expect(new Set([a, b, c]).size).toBe(3);
    });

    it('treats empty and absent floor/apartment as the same', () => {
        const a = buildLocationKey({
            street: 'Urquiza',
            number: '50',
            floor: '',
            apartment: ' ',
            destinationId: DEST
        });
        const b = buildLocationKey({ street: 'Urquiza', number: '50', destinationId: DEST });
        expect(a).toBe(b);
    });

    it('unifies floor and apartment spellings', () => {
        const base = { street: 'Urquiza', number: '50', destinationId: DEST };
        expect(buildLocationKey({ ...base, floor: '1°' })).toBe(
            buildLocationKey({ ...base, floor: '1' })
        );
        expect(buildLocationKey({ ...base, floor: '1º' })).toBe(
            buildLocationKey({ ...base, floor: '1' })
        );
        expect(buildLocationKey({ ...base, floor: 'PB' })).toBe(
            buildLocationKey({ ...base, floor: 'planta baja' })
        );
        expect(buildLocationKey({ ...base, apartment: 'Depto. A' })).toBe(
            buildLocationKey({ ...base, apartment: 'a' })
        );
    });

    it('gives different keys to different destinations', () => {
        const a = buildLocationKey({ street: 'Urquiza', number: '50', destinationId: 'a' });
        const b = buildLocationKey({ street: 'Urquiza', number: '50', destinationId: 'b' });
        expect(a).not.toBe(b);
    });

    it('is idempotent: normalizing the street of a key input yields the same key', () => {
        const input = {
            street: 'Av. Gral. Perón',
            number: '1 ',
            floor: '3°',
            destinationId: DEST
        } as const;
        expect(buildLocationKey(input)).toBe(buildLocationKey(input));
    });

    it('keeps numbers with letters (12 bis, 123A)', () => {
        expect(buildLocationKey({ street: 'Mitre', number: '12 bis', destinationId: DEST })).toBe(
            'mitre|12 bis|dest-1'
        );
        expect(buildLocationKey({ street: 'Mitre', number: '123A', destinationId: DEST })).toBe(
            'mitre|123a|dest-1'
        );
    });
});
