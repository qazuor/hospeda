import type { DestinationModel } from '@repo/db';
import type { NewDestinationInput } from '@repo/schemas/entities/destination/destination.schema';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import * as helpers from '../../../src/services/destination/destination.helpers';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { createActor, createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
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
        const params: NewDestinationInput = {
            name: 'Villa Elisa',
            summary: 'A beautiful destination with enough length for the summary field.',
            description:
                'A detailed description of Villa Elisa with enough length to pass the minimum required by Zod schema for description field.',
            location: {
                state: 'Entre Ríos',
                zipCode: '3265',
                country: 'AR',
                street: 'Av. Urquiza',
                number: '123',
                city: 'Villa Elisa'
            },
            media: {
                featuredImage: {
                    moderationState: ModerationStatusEnum.APPROVED,
                    url: 'https://example.com/image.jpg'
                }
            },
            isFeatured: false,
            attractions: [
                {
                    name: 'Attraction 1',
                    slug: 'attraction-1',
                    description: 'A valid description for attraction 1',
                    icon: 'icon1',
                    destinationId: getMockId('destination')
                },
                {
                    name: 'Attraction 2',
                    slug: 'attraction-2',
                    description: 'A valid description for attraction 2',
                    icon: 'icon2',
                    destinationId: getMockId('destination')
                },
                {
                    name: 'Attraction 3',
                    slug: 'attraction-3',
                    description: 'A valid description for attraction 3',
                    icon: 'icon3',
                    destinationId: getMockId('destination')
                }
            ],
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            visibility: VisibilityEnum.PUBLIC,
            reviewsCount: 0
        };
        const created = { ...params, id: 'mock-id', slug: 'mock-slug' };
        (model.create as Mock).mockResolvedValue(created);
        const result = await service.create(actor, params);
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe('mock-id');
        expect(result.error).toBeUndefined();
        expect(model.create).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const actor = createActor({ permissions: [] });
        const params: NewDestinationInput = {
            name: 'Villa Elisa',
            summary: 'A beautiful destination with enough length for the summary field.',
            description:
                'A detailed description of Villa Elisa with enough length to pass the minimum required by Zod schema for description field.',
            location: {
                state: 'Entre Ríos',
                zipCode: '3265',
                country: 'AR',
                street: 'Av. Urquiza',
                number: '123',
                city: 'Villa Elisa'
            },
            media: {
                featuredImage: {
                    moderationState: ModerationStatusEnum.APPROVED,
                    url: 'https://example.com/image.jpg'
                }
            },
            isFeatured: false,
            attractions: [
                {
                    name: 'Attraction 1',
                    slug: 'attraction-1',
                    description: 'A valid description for attraction 1',
                    icon: 'icon1',
                    destinationId: getMockId('destination')
                },
                {
                    name: 'Attraction 2',
                    slug: 'attraction-2',
                    description: 'A valid description for attraction 2',
                    icon: 'icon2',
                    destinationId: getMockId('destination')
                },
                {
                    name: 'Attraction 3',
                    slug: 'attraction-3',
                    description: 'A valid description for attraction 3',
                    icon: 'icon3',
                    destinationId: getMockId('destination')
                }
            ],
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            visibility: VisibilityEnum.PUBLIC,
            reviewsCount: 0
        };
        const result = await service.create(actor, params);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const actor = createAdminActor();
        const params: NewDestinationInput = {
            name: undefined as unknown as string,
            summary: 'A beautiful destination with enough length for the summary field.',
            description:
                'A detailed description of Villa Elisa with enough length to pass the minimum required by Zod schema for description field.',
            location: {
                state: 'Entre Ríos',
                zipCode: '3265',
                country: 'AR',
                street: 'Av. Urquiza',
                number: '123',
                city: 'Villa Elisa'
            },
            media: {
                featuredImage: {
                    moderationState: ModerationStatusEnum.APPROVED,
                    url: 'https://example.com/image.jpg'
                }
            },
            isFeatured: false,
            attractions: [
                {
                    name: 'Attraction 1',
                    slug: 'attraction-1',
                    description: 'A valid description for attraction 1',
                    icon: 'icon1',
                    destinationId: getMockId('destination')
                },
                {
                    name: 'Attraction 2',
                    slug: 'attraction-2',
                    description: 'A valid description for attraction 2',
                    icon: 'icon2',
                    destinationId: getMockId('destination')
                },
                {
                    name: 'Attraction 3',
                    slug: 'attraction-3',
                    description: 'A valid description for attraction 3',
                    icon: 'icon3',
                    destinationId: getMockId('destination')
                }
            ],
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            visibility: VisibilityEnum.PUBLIC,
            reviewsCount: 0
        };
        const result = await service.create(actor, params);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        const actor = createAdminActor();
        const params: NewDestinationInput = {
            name: 'Villa Elisa',
            summary: 'A beautiful destination with enough length for the summary field.',
            description:
                'A detailed description of Villa Elisa with enough length to pass the minimum required by Zod schema for description field.',
            location: {
                state: 'Entre Ríos',
                zipCode: '3265',
                country: 'AR',
                street: 'Av. Urquiza',
                number: '123',
                city: 'Villa Elisa'
            },
            media: {
                featuredImage: {
                    moderationState: ModerationStatusEnum.APPROVED,
                    url: 'https://example.com/image.jpg'
                }
            },
            isFeatured: false,
            attractions: [
                {
                    name: 'Attraction 1',
                    slug: 'attraction-1',
                    description: 'A valid description for attraction 1',
                    icon: 'icon1',
                    destinationId: getMockId('destination')
                },
                {
                    name: 'Attraction 2',
                    slug: 'attraction-2',
                    description: 'A valid description for attraction 2',
                    icon: 'icon2',
                    destinationId: getMockId('destination')
                },
                {
                    name: 'Attraction 3',
                    slug: 'attraction-3',
                    description: 'A valid description for attraction 3',
                    icon: 'icon3',
                    destinationId: getMockId('destination')
                }
            ],
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            visibility: VisibilityEnum.PUBLIC,
            reviewsCount: 0
        };
        (model.create as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.create(actor, params);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
