import type { DestinationModel } from '@repo/db';
import { type DestinationCreateInput, DestinationCreateInputSchema } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import * as helpers from '../../../src/services/destination/destination.helpers';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { createActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
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

        // Temporarily disable mock to see real validation errors
        // vi.spyOn(DestinationCreateInputSchema, 'safeParseAsync').mockImplementation(
        //     async (input: unknown) =>
        //         ({
        //             success: true,
        //             data: input
        //         }) as any
        // );
    });

    it('should create a destination when permissions and input are valid', async () => {
        const actor = createActor({ permissions: [PermissionEnum.DESTINATION_CREATE] });

        // Create minimal valid data manually
        const params: DestinationCreateInput = {
            slug: 'villa-elisa',
            name: 'Villa Elisa',
            summary: 'A beautiful destination in Entre Ríos',
            description:
                'Villa Elisa is a charming town located in Entre Ríos province, known for its natural beauty and peaceful atmosphere.',
            moderationState: 'APPROVED',
            visibility: 'PUBLIC',
            location: {
                state: 'Entre Ríos',
                country: 'Argentina',
                zipCode: '3265'
            }
        } as DestinationCreateInput;

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

        // Use same valid data
        const params: DestinationCreateInput = {
            slug: 'villa-elisa',
            name: 'Villa Elisa',
            summary: 'A beautiful destination in Entre Ríos',
            description:
                'Villa Elisa is a charming town located in Entre Ríos province, known for its natural beauty and peaceful atmosphere.',
            moderationState: 'APPROVED',
            visibility: 'PUBLIC',
            location: {
                state: 'Entre Ríos',
                country: 'Argentina',
                zipCode: '3265'
            }
        } as DestinationCreateInput;

        const result = await service.create(actor, params);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const actor = createActor({ permissions: [PermissionEnum.DESTINATION_CREATE] });

        // Mock validation to fail
        vi.spyOn(DestinationCreateInputSchema, 'safeParseAsync').mockResolvedValueOnce({
            success: false,
            error: new ZodError([
                {
                    code: 'custom',
                    message: 'Invalid input',
                    path: ['name']
                }
            ])
        } as any);

        const params: DestinationCreateInput = {
            slug: 'villa-elisa',
            name: undefined as unknown as string, // Make it invalid
            summary: 'A beautiful destination in Entre Ríos',
            description:
                'Villa Elisa is a charming town located in Entre Ríos province, known for its natural beauty and peaceful atmosphere.',
            moderationState: 'APPROVED',
            visibility: 'PUBLIC',
            location: {
                state: 'Entre Ríos',
                country: 'Argentina',
                zipCode: '3265'
            }
        } as DestinationCreateInput;

        const result = await service.create(actor, params);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        const actor = createActor({ permissions: [PermissionEnum.DESTINATION_CREATE] });

        // Use same valid data
        const params: DestinationCreateInput = {
            slug: 'villa-elisa',
            name: 'Villa Elisa',
            summary: 'A beautiful destination in Entre Ríos',
            description:
                'Villa Elisa is a charming town located in Entre Ríos province, known for its natural beauty and peaceful atmosphere.',
            moderationState: 'APPROVED',
            visibility: 'PUBLIC',
            location: {
                state: 'Entre Ríos',
                country: 'Argentina',
                zipCode: '3265'
            }
        } as DestinationCreateInput;

        (model.create as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.create(actor, params);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
