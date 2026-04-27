import { describe, expect, it } from 'vitest';
import { CityDestinationRefSchema } from '../../../src/entities/destination/destination.refs.schema';

/**
 * Test suite for CityDestinationRefSchema (SPEC-095).
 *
 * Verifies the projection accepts a CITY destination subset, rejects payloads
 * missing required hierarchy fields, and excludes heavy entity fields like
 * media or reviewsCount.
 */
describe('CityDestinationRefSchema', () => {
    const validRef = {
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'concepcion-del-uruguay',
        name: 'Concepción del Uruguay',
        summary: 'Una hermosa ciudad en Entre Ríos a orillas del Uruguay.',
        destinationType: 'CITY' as const,
        level: 4,
        path: '/argentina/litoral/entre-rios/concepcion-del-uruguay',
        pathIds: '11111111-1111-4111-8111-111111111110,11111111-1111-4111-8111-111111111111'
    };

    it('parses a valid CITY destination projection', () => {
        const result = CityDestinationRefSchema.safeParse(validRef);
        expect(result.success).toBe(true);
    });

    it('rejects when summary is missing (required from DestinationSchema)', () => {
        const { summary: _summary, ...withoutSummary } = validRef;
        const result = CityDestinationRefSchema.safeParse(withoutSummary);
        expect(result.success).toBe(false);
    });

    it('rejects when path is missing', () => {
        const { path: _path, ...withoutPath } = validRef;
        const result = CityDestinationRefSchema.safeParse(withoutPath);
        expect(result.success).toBe(false);
    });

    it('rejects when destinationType is missing', () => {
        const { destinationType: _t, ...withoutType } = validRef;
        const result = CityDestinationRefSchema.safeParse(withoutType);
        expect(result.success).toBe(false);
    });

    it('exposes only the projected keys (no media, reviewsCount, attractions)', () => {
        const shape = CityDestinationRefSchema.shape;
        const keys = Object.keys(shape).sort();
        expect(keys).toEqual([
            'destinationType',
            'id',
            'level',
            'name',
            'path',
            'pathIds',
            'slug',
            'summary'
        ]);
        expect(keys).not.toContain('media');
        expect(keys).not.toContain('reviewsCount');
        expect(keys).not.toContain('attractions');
        expect(keys).not.toContain('rating');
    });
});
