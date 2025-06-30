import { RoleEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeViewInput
} from '../../../src/services/accommodation/accommodation.normalizers';
import type {
    CreateAccommodationSchema,
    UpdateAccommodationSchema
} from '../../../src/services/accommodation/accommodation.schemas';

const testActor = { id: 'test', role: RoleEnum.ADMIN, permissions: [] };

describe('Accommodation Normalizers', () => {
    it('normalizeCreateInput sets default visibility to PRIVATE if missing', () => {
        const input: z.infer<typeof CreateAccommodationSchema> = { name: 'Test' } as z.infer<
            typeof CreateAccommodationSchema
        >;
        const result = normalizeCreateInput(input, testActor);
        expect(result.visibility).toBe('PRIVATE');
    });

    it('normalizeCreateInput preserves provided visibility', () => {
        const input: z.infer<typeof CreateAccommodationSchema> = {
            name: 'Test',
            visibility: 'PUBLIC'
        } as z.infer<typeof CreateAccommodationSchema>;
        const result = normalizeCreateInput(input, testActor);
        expect(result.visibility).toBe('PUBLIC');
    });

    it('normalizeUpdateInput returns the same object', () => {
        const input: z.infer<typeof UpdateAccommodationSchema> = { name: 'Test' } as z.infer<
            typeof UpdateAccommodationSchema
        >;
        const result = normalizeUpdateInput(input, testActor);
        expect(result).toBe(input);
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
