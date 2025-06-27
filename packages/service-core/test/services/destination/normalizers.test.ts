import type { DestinationSchema } from '@repo/schemas/entities/destination/destination.schema';
import { RoleEnum, VisibilityEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeViewInput
} from '../../../src/services/destination/destination.normalizers';
import { DestinationFactoryBuilder } from '../../factories/destinationFactory';

/**
 * @fileoverview
 * Unit tests for destination normalizers and slug generation logic.
 * Ensures robust, type-safe, and homogeneous handling of input normalization and slug uniqueness.
 */
const testActor = { id: 'test', role: RoleEnum.ADMIN, permissions: [] };

const validLocation = {
    state: 'Entre Ríos',
    zipCode: '3265',
    country: 'AR',
    street: 'Av. Mitre',
    number: '123',
    city: 'Colón',
    coordinates: { lat: '-30.9500', long: '-57.9333' },
    floor: '1',
    apartment: 'A',
    neighborhood: 'Centro',
    department: 'Departamento X'
};

describe('Destination Normalizers', () => {
    it('normalizeCreateInput sets default visibility to PRIVATE if missing', () => {
        const input = new DestinationFactoryBuilder()
            .with({ visibility: undefined, location: validLocation })
            .build();
        // Cast for test compatibility: builder uses entity type, schema expects more fields
        const result = normalizeCreateInput(input as z.infer<typeof DestinationSchema>, testActor);
        expect(result.visibility).toBe(VisibilityEnum.PRIVATE);
    });

    it('normalizeCreateInput preserves provided visibility', () => {
        const input = new DestinationFactoryBuilder()
            .with({ visibility: VisibilityEnum.PUBLIC, location: validLocation })
            .build();
        // Cast for test compatibility
        const result = normalizeCreateInput(input as z.infer<typeof DestinationSchema>, testActor);
        expect(result.visibility).toBe(VisibilityEnum.PUBLIC);
    });

    it('normalizeUpdateInput returns the same object', () => {
        const input = new DestinationFactoryBuilder().with({ location: validLocation }).build();
        // Cast for test compatibility
        const result = normalizeUpdateInput(input as z.infer<typeof DestinationSchema>, testActor);
        expect(result).toBe(input);
    });

    it('normalizeListInput returns the same object', () => {
        const input = { page: 2, pageSize: 10 };
        const result = normalizeListInput(input, testActor);
        expect(result).toBe(input);
    });

    it('normalizeViewInput returns the same field and value', () => {
        const result = normalizeViewInput('slug', 'test-slug', testActor);
        expect(result).toEqual({ field: 'slug', value: 'test-slug' });
    });
});
