import type { AccommodationCreateInputSchema, AccommodationUpdateInputSchema } from '@repo/schemas';
import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeViewInput
} from '../../../src/services/accommodation/accommodation.normalizers';

const testActor = { id: 'test', roles: [RoleEnum.ADMIN], permissions: [] };

describe('Accommodation Normalizers', () => {
    it('normalizeCreateInput injects no visibility default (born DRAFT by the model, HOS-1641)', () => {
        const input: z.infer<typeof AccommodationCreateInputSchema> = { name: 'Test' } as z.infer<
            typeof AccommodationCreateInputSchema
        >;
        const result = normalizeCreateInput(input, testActor);
        expect(result).toStrictEqual(input);
    });

    it('normalizeUpdateInput returns the same object', () => {
        const input: z.infer<typeof AccommodationUpdateInputSchema> = { name: 'Test' } as z.infer<
            typeof AccommodationUpdateInputSchema
        >;
        const result = normalizeUpdateInput(input, testActor);
        expect(result).toStrictEqual(input);
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
