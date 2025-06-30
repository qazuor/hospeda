import type { DestinationModel } from '@repo/db';
import type { UpdateDestinationInput } from '@repo/schemas/entities/destination/destination.schema';
import * as schemas from '@repo/schemas/entities/destination/destination.schema';
import { type DestinationType, PermissionEnum, ServiceErrorCode } from '@repo/types';
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
    vi.spyOn(schemas.UpdateDestinationSchema, 'safeParseAsync').mockImplementation(
        async (input: unknown) => {
            const typedInput = input as UpdateDestinationInput;
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
                };
            }
            return { success: true, data: typedInput };
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
        const id = getMockId('destination') as DestinationType['id'];
        const existing = {
            ...createDestination(),
            id,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as DestinationType['createdById'],
            updatedById: getMockId('user') as DestinationType['updatedById']
        };
        const updateInput: UpdateDestinationInput = { name: 'Updated Name' };
        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockResolvedValue({ ...existing, ...updateInput });
        const result = await service.update(actor, id, updateInput);
        expect(result.data).toBeDefined();
        expect(result.data?.name).toBe('Updated Name');
        expect(result.error).toBeUndefined();
        expect(model.findById).toHaveBeenCalledWith(id);
        expect(model.update).toHaveBeenCalled();
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        const actor = createActor({ permissions: [] });
        const id = getMockId('destination') as DestinationType['id'];
        const existing = {
            ...createDestination(),
            id,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as DestinationType['createdById'],
            updatedById: getMockId('user') as DestinationType['updatedById']
        };
        (model.findById as Mock).mockResolvedValue(existing);
        const result = await service.update(actor, id, {
            name: 'Updated Name'
        } as UpdateDestinationInput);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const actor = createAdminActor();
        const id = getMockId('destination') as DestinationType['id'];
        const existing = {
            ...createDestination(),
            id,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as DestinationType['createdById'],
            updatedById: getMockId('user') as DestinationType['updatedById']
        };
        (model.findById as Mock).mockResolvedValue(existing);
        const result = await service.update(actor, id, {
            name: undefined
        } as UpdateDestinationInput);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.data).toBeUndefined();
    });

    it('should return NOT_FOUND if destination does not exist', async () => {
        const actor = createAdminActor();
        const id = getMockId('destination') as DestinationType['id'];
        (model.findById as Mock).mockResolvedValue(null);
        const result = await service.update(actor, id, {
            name: 'Updated Name'
        } as UpdateDestinationInput);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        const actor = createAdminActor({ permissions: [PermissionEnum.DESTINATION_UPDATE] });
        const id = getMockId('destination') as DestinationType['id'];
        const existing = {
            ...createDestination(),
            id,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as DestinationType['createdById'],
            updatedById: getMockId('user') as DestinationType['updatedById']
        };
        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockRejectedValue(new Error('DB error'));
        const result = await service.update(actor, id, {
            name: 'Updated Name'
        } as UpdateDestinationInput);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.data).toBeUndefined();
    });
});
