import type { DestinationSchema } from '@repo/schemas/entities/destination/destination.schema';
import type { AttractionId, DestinationId } from '@repo/types';
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
import { getMockId } from '../../factories/utilsFactory';

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
            .withAttractions([
                {
                    id: getMockId('feature') as AttractionId,
                    attractionId: getMockId('feature') as AttractionId,
                    name: 'Attraction 1',
                    slug: 'attraction-1',
                    icon: 'icon1',
                    description: 'desc',
                    isBuiltin: false,
                    isFeatured: false,
                    destinationId: getMockId('destination') as DestinationId,
                    adminInfo: { favorite: false }
                }
            ])
            .build();
        // Cast for test compatibility: builder uses entity type, schema expects more fields
        const result = normalizeCreateInput(
            input as unknown as z.infer<typeof DestinationSchema>,
            testActor
        );
        expect(result.visibility).toBe(VisibilityEnum.PRIVATE);
    });

    it('normalizeCreateInput preserves provided visibility', () => {
        const input = new DestinationFactoryBuilder()
            .with({ visibility: VisibilityEnum.PUBLIC, location: validLocation })
            .withAttractions([
                {
                    id: getMockId('feature') as AttractionId,
                    attractionId: getMockId('feature') as AttractionId,
                    name: 'Attraction 1',
                    slug: 'attraction-1',
                    icon: 'icon1',
                    description: 'desc',
                    isBuiltin: false,
                    isFeatured: false,
                    destinationId: getMockId('destination') as DestinationId,
                    adminInfo: { favorite: false }
                }
            ])
            .build();
        // Cast for test compatibility
        const result = normalizeCreateInput(
            input as unknown as z.infer<typeof DestinationSchema>,
            testActor
        );
        expect(result.visibility).toBe(VisibilityEnum.PUBLIC);
    });

    it('normalizeUpdateInput returns the same object', () => {
        const input = new DestinationFactoryBuilder()
            .with({ location: validLocation })
            .withAttractions([
                {
                    id: getMockId('feature') as AttractionId,
                    attractionId: getMockId('feature') as AttractionId,
                    name: 'Attraction 1',
                    slug: 'attraction-1',
                    icon: 'icon1',
                    description: 'desc',
                    isBuiltin: false,
                    isFeatured: false,
                    destinationId: getMockId('destination') as DestinationId,
                    adminInfo: { favorite: false }
                }
            ])
            .build();
        // Cast for test compatibility
        const result = normalizeUpdateInput(
            input as unknown as z.infer<typeof DestinationSchema>,
            testActor
        );
        expect(result).toStrictEqual(input);
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
