import type { DestinationModel } from '@repo/db';
import {
    type Destination,
    type DestinationUpdateInput,
    DestinationUpdateInputSchema
} from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
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
    // Mock safeParseAsync for validation
    vi.spyOn(DestinationUpdateInputSchema, 'safeParseAsync').mockImplementation(
        async (input: unknown) => {
            const typedInput = input as unknown as import('zod').infer<
                typeof DestinationUpdateInputSchema
            >;
            if (
                typedInput &&
                Object.prototype.hasOwnProperty.call(typedInput, 'name') &&
                typedInput.name === undefined
            ) {
                return {
                    success: false,
                    error: new ZodError([
                        {
                            code: 'custom',
                            message: 'Invalid input',
                            path: ['name']
                        }
                    ])
                } as unknown as Awaited<
                    ReturnType<(typeof DestinationUpdateInputSchema)['safeParseAsync']>
                >;
            }
            return {
                success: true,
                data: typedInput
            } as unknown as Awaited<
                ReturnType<(typeof DestinationUpdateInputSchema)['safeParseAsync']>
            >;
        }
    );
});

describe('DestinationService.update', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createMockBaseModel>;
    beforeEach(() => {
        model = createMockBaseModel();
        service = new DestinationService({ logger: mockLogger }, model as DestinationModel);
        vi.clearAllMocks();
    });

    it('should update a destination when permissions and input are valid', async () => {
        const actor = createAdminActor({ permissions: [PermissionEnum.DESTINATION_UPDATE] });
        const id = getMockId('destination') as Destination['id'];
        const existing = {
            ...createDestination(),
            id,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as Destination['createdById'],
            updatedById: getMockId('user') as Destination['updatedById']
        };
        const updateInput = { name: 'Updated Name' } as unknown as import('zod').infer<
            typeof DestinationUpdateInputSchema
        >;
        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockResolvedValue({ ...existing, ...updateInput });
        const result = await service.update(
            actor,
            id,
            updateInput as unknown as Record<string, unknown>
        );
        expect(result.data).toBeDefined();
        expect(result.data?.name).toBe('Updated Name');
        expect(result.error).toBeUndefined();
        expect(model.findById).toHaveBeenCalledWith(id);
        expect(model.update).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const actor = createActor({ permissions: [] });
        const id = getMockId('destination') as Destination['id'];
        const existing = {
            ...createDestination(),
            id,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as Destination['createdById'],
            updatedById: getMockId('user') as Destination['updatedById']
        };
        (model.findById as Mock).mockResolvedValue(existing);
        const result = await service.update(actor, id, {
            name: 'Updated Name'
        } as unknown as import('zod').infer<typeof DestinationUpdateInputSchema>);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const actor = createAdminActor({ permissions: [PermissionEnum.DESTINATION_UPDATE] });
        const id = getMockId('destination') as Destination['id'];
        const existing = {
            ...createDestination(),
            id,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as Destination['createdById'],
            updatedById: getMockId('user') as Destination['updatedById']
        };
        (model.findById as Mock).mockResolvedValue(existing);
        const result = await service.update(actor, id, {
            name: undefined
        } as unknown as import('zod').infer<typeof DestinationUpdateInputSchema>);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        const actor = createAdminActor();
        const id = getMockId('destination') as Destination['id'];
        (model.findById as Mock).mockResolvedValue(null);
        const result = await service.update(actor, id, {
            name: 'Updated Name'
        } as unknown as import('zod').infer<typeof DestinationUpdateInputSchema>);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        const actor = createAdminActor({ permissions: [PermissionEnum.DESTINATION_UPDATE] });
        const id = getMockId('destination') as Destination['id'];
        const existing = {
            ...createDestination(),
            id,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as Destination['createdById'],
            updatedById: getMockId('user') as Destination['updatedById']
        };
        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.update(actor, id, {
            name: 'Updated Name'
        } as DestinationUpdateInput);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
