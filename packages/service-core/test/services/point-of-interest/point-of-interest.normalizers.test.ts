import type { PointOfInterestCreateInput, PointOfInterestUpdateInput } from '@repo/schemas';
import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeViewInput
} from '../../../src/services/point-of-interest/point-of-interest.normalizers';

const testActor = { id: 'test', role: RoleEnum.ADMIN, permissions: [] };

describe('PointOfInterest Normalizers', () => {
    it('normalizeCreateInput normalizes adminInfo and leaves other fields untouched', () => {
        const input: PointOfInterestCreateInput & { extraField?: string } = {
            slug: 'autodromo-concepcion-del-uruguay',
            lat: -32.4825,
            long: -58.2372,
            type: 'STADIUM' as any,
            description: 'A valid description for the point of interest',
            icon: '🏁',
            isFeatured: true,
            isBuiltin: false,
            displayWeight: 50,
            lifecycleState: 'ACTIVE' as any,
            adminInfo: { favorite: true, notes: 'test' },
            extraField: 'should be ignored'
        };
        const result = normalizeCreateInput(input, testActor);
        expect(result).toMatchObject({
            slug: input.slug,
            lat: input.lat,
            long: input.long,
            type: input.type,
            description: input.description,
            icon: input.icon,
            isFeatured: input.isFeatured,
            isBuiltin: input.isBuiltin,
            adminInfo: { favorite: true, notes: 'test' }
        });
        // No name-derived slug generation (HOS-113 OQ-2): slug passes through unmodified.
        expect(result.slug).toBe('autodromo-concepcion-del-uruguay');
    });

    it('normalizeUpdateInput normalizes adminInfo and leaves other fields untouched', () => {
        const input: PointOfInterestUpdateInput & { extraField?: string } = {
            slug: 'autodromo-concepcion-del-uruguay',
            adminInfo: { favorite: false },
            extraField: 'should be ignored'
        };
        const result = normalizeUpdateInput(input, testActor);
        expect(result).toMatchObject({
            slug: input.slug,
            adminInfo: { favorite: false }
        });
    });

    it('normalizeListInput returns the same object', () => {
        const params = { page: 2, pageSize: 10 };
        const result = normalizeListInput(params, testActor);
        expect(result).toBe(params);
    });

    it('normalizeViewInput returns the same field and value', () => {
        const result = normalizeViewInput('slug', 'autodromo-concepcion-del-uruguay', testActor);
        expect(result).toEqual({
            field: 'slug',
            value: 'autodromo-concepcion-del-uruguay'
        });
    });
});
