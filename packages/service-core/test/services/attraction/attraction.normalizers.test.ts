import type { CreateAttractionSchema, UpdateAttractionSchema } from '@repo/schemas';
import { RoleEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeViewInput
} from '../../../src/services/attraction/attraction.normalizers';

const testActor = { id: 'test', role: RoleEnum.ADMIN, permissions: [] };

describe('Attraction Normalizers', () => {
    it('normalizeCreateInput normalizes adminInfo y deja campos extra intactos', () => {
        const input: z.infer<typeof CreateAttractionSchema> & { extraField?: string } = {
            name: 'Test Attraction',
            description: 'A valid description for the attraction',
            icon: '🎡',
            destinationId: 'dest-1',
            isFeatured: true,
            isBuiltin: false,
            adminInfo: { favorite: true, notes: 'test' },
            extraField: 'should be ignored'
        };
        const result = normalizeCreateInput(input, testActor);
        expect(result).toMatchObject({
            name: input.name,
            description: input.description,
            icon: input.icon,
            destinationId: input.destinationId,
            isFeatured: input.isFeatured,
            isBuiltin: input.isBuiltin,
            adminInfo: { favorite: true, notes: 'test' }
        });
        // No se exige que extraField sea eliminado
    });

    it('normalizeUpdateInput normalizes adminInfo y deja campos extra intactos', () => {
        const input: z.infer<typeof UpdateAttractionSchema> & { extraField?: string } = {
            id: 'attr-1',
            name: 'Test Attraction',
            adminInfo: { favorite: false },
            extraField: 'should be ignored'
        };
        const result = normalizeUpdateInput(input, testActor);
        expect(result).toMatchObject({
            id: input.id,
            name: input.name,
            adminInfo: { favorite: false }
        });
        // No se exige que extraField sea eliminado
    });

    it('normalizeListInput returns the same object', () => {
        const params = { page: 2, pageSize: 10 };
        const result = normalizeListInput(params, testActor);
        expect(result).toBe(params);
    });

    it('normalizeViewInput returns the same field and value', () => {
        const result = normalizeViewInput('slug', 'test-slug', testActor);
        expect(result).toEqual({ field: 'slug', value: 'test-slug' });
    });
});
