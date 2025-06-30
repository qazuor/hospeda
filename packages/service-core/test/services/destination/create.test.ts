import type { DestinationModel } from '@repo/db';
import type { NewDestinationInput } from '@repo/schemas/entities/destination/destination.schema';
import type { AttractionId, DestinationId } from '@repo/types';
import { ServiceErrorCode } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as helpers from '../../../src/services/destination/destination.helpers';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { createActor, createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createDestination } from '../../factories/destinationFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

beforeEach(() => {
    vi.spyOn(helpers, 'generateDestinationSlug').mockResolvedValue('mock-slug');
});

describe('DestinationService.create', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createMockBaseModel>;
    beforeEach(() => {
        model = createMockBaseModel();
        service = new DestinationService({ logger: mockLogger }, model as DestinationModel);
        vi.clearAllMocks();
    });

    it('should create a destination when permissions and input are valid', async () => {
        const actor = createAdminActor();
        // Input válido según el schema: summary y description largos, 3 attractions
        const full = createDestination({
            reviewsCount: 0,
            accommodationsCount: 0,
            summary: 'A beautiful destination with enough length for the summary field.',
            description:
                'A detailed description of Villa Elisa with enough length to pass the minimum required by Zod schema for description field.',
            attractions: [
                {
                    id: getMockId('feature', 'a1') as AttractionId,
                    attractionId: getMockId('feature', 'a1') as AttractionId,
                    name: 'Attraction 1',
                    slug: 'attraction-1',
                    icon: 'icon1',
                    description: 'Description 1',
                    destinationId: getMockId('destination', 'd1') as DestinationId
                },
                {
                    id: getMockId('feature', 'a2') as AttractionId,
                    attractionId: getMockId('feature', 'a2') as AttractionId,
                    name: 'Attraction 2',
                    slug: 'attraction-2',
                    icon: 'icon2',
                    description: 'Description 2',
                    destinationId: getMockId('destination', 'd1') as DestinationId
                },
                {
                    id: getMockId('feature', 'a3') as AttractionId,
                    attractionId: getMockId('feature', 'a3') as AttractionId,
                    name: 'Attraction 3',
                    slug: 'attraction-3',
                    icon: 'icon3',
                    description: 'Description 3',
                    destinationId: getMockId('destination', 'd1') as DestinationId
                }
            ]
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
            id,
            slug,
            createdAt,
            updatedAt,
            createdById,
            updatedById,
            deletedAt,
            deletedById,
            ...inputRest
        } = full;
        const input: NewDestinationInput = { ...inputRest };
        const created = { ...full, id: 'mock-id', slug: 'mock-slug' };
        (model.create as Mock).mockResolvedValue(created);
        const result = await service.create(
            actor,
            input as unknown as Parameters<DestinationService['create']>[1]
        );
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe('mock-id');
        expect(result.error).toBeUndefined();
        expect(model.create).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const actor = createActor({ permissions: [] });
        // Input válido según el schema
        const full = createDestination({
            reviewsCount: 0,
            accommodationsCount: 0,
            summary: 'A beautiful destination with enough length for the summary field.',
            description:
                'A detailed description of Villa Elisa with enough length to pass the minimum required by Zod schema for description field.',
            attractions: [
                {
                    id: getMockId('feature', 'a1') as AttractionId,
                    attractionId: getMockId('feature', 'a1') as AttractionId,
                    name: 'Attraction 1',
                    slug: 'attraction-1',
                    icon: 'icon1',
                    description: 'Description 1',
                    destinationId: getMockId('destination', 'd1') as DestinationId
                },
                {
                    id: getMockId('feature', 'a2') as AttractionId,
                    attractionId: getMockId('feature', 'a2') as AttractionId,
                    name: 'Attraction 2',
                    slug: 'attraction-2',
                    icon: 'icon2',
                    description: 'Description 2',
                    destinationId: getMockId('destination', 'd1') as DestinationId
                },
                {
                    id: getMockId('feature', 'a3') as AttractionId,
                    attractionId: getMockId('feature', 'a3') as AttractionId,
                    name: 'Attraction 3',
                    slug: 'attraction-3',
                    icon: 'icon3',
                    description: 'Description 3',
                    destinationId: getMockId('destination', 'd1') as DestinationId
                }
            ]
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
            id,
            slug,
            createdAt,
            updatedAt,
            createdById,
            updatedById,
            deletedAt,
            deletedById,
            ...inputRest
        } = full;
        const input: NewDestinationInput = { ...inputRest };
        const result = await service.create(
            actor,
            input as unknown as Parameters<DestinationService['create']>[1]
        );
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const actor = createAdminActor();
        // Input inválido: name undefined
        const full = createDestination({
            reviewsCount: 0,
            accommodationsCount: 0,
            summary: 'A beautiful destination with enough length for the summary field.',
            description:
                'A detailed description of Villa Elisa with enough length to pass the minimum required by Zod schema for description field.',
            attractions: [
                {
                    id: getMockId('feature', 'a1') as AttractionId,
                    attractionId: getMockId('feature', 'a1') as AttractionId,
                    name: 'Attraction 1',
                    slug: 'attraction-1',
                    icon: 'icon1',
                    description: 'Description 1',
                    destinationId: getMockId('destination', 'd1') as DestinationId
                },
                {
                    id: getMockId('feature', 'a2') as AttractionId,
                    attractionId: getMockId('feature', 'a2') as AttractionId,
                    name: 'Attraction 2',
                    slug: 'attraction-2',
                    icon: 'icon2',
                    description: 'Description 2',
                    destinationId: getMockId('destination', 'd1') as DestinationId
                },
                {
                    id: getMockId('feature', 'a3') as AttractionId,
                    attractionId: getMockId('feature', 'a3') as AttractionId,
                    name: 'Attraction 3',
                    slug: 'attraction-3',
                    icon: 'icon3',
                    description: 'Description 3',
                    destinationId: getMockId('destination', 'd1') as DestinationId
                }
            ]
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
            id,
            slug,
            createdAt,
            updatedAt,
            createdById,
            updatedById,
            deletedAt,
            deletedById,
            ...inputRest
        } = full;
        const input: NewDestinationInput = {
            ...inputRest,
            name: undefined as unknown as string
        };
        const result = await service.create(
            actor,
            input as unknown as Parameters<DestinationService['create']>[1]
        );
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        const actor = createAdminActor();
        // Input válido según el schema
        const full = createDestination({
            reviewsCount: 0,
            accommodationsCount: 0,
            summary: 'A beautiful destination with enough length for the summary field.',
            description:
                'A detailed description of Villa Elisa with enough length to pass the minimum required by Zod schema for description field.',
            attractions: [
                {
                    id: getMockId('feature', 'a1') as AttractionId,
                    attractionId: getMockId('feature', 'a1') as AttractionId,
                    name: 'Attraction 1',
                    slug: 'attraction-1',
                    icon: 'icon1',
                    description: 'Description 1',
                    destinationId: getMockId('destination', 'd1') as DestinationId
                },
                {
                    id: getMockId('feature', 'a2') as AttractionId,
                    attractionId: getMockId('feature', 'a2') as AttractionId,
                    name: 'Attraction 2',
                    slug: 'attraction-2',
                    icon: 'icon2',
                    description: 'Description 2',
                    destinationId: getMockId('destination', 'd1') as DestinationId
                },
                {
                    id: getMockId('feature', 'a3') as AttractionId,
                    attractionId: getMockId('feature', 'a3') as AttractionId,
                    name: 'Attraction 3',
                    slug: 'attraction-3',
                    icon: 'icon3',
                    description: 'Description 3',
                    destinationId: getMockId('destination', 'd1') as DestinationId
                }
            ]
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
            id,
            slug,
            createdAt,
            updatedAt,
            createdById,
            updatedById,
            deletedAt,
            deletedById,
            ...inputRest
        } = full;
        const input: NewDestinationInput = { ...inputRest };
        (model.create as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.create(
            actor,
            input as unknown as Parameters<DestinationService['create']>[1]
        );
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
