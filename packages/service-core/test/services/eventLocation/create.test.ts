import { EventLocationModel } from '@repo/db';
import { PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventLocationService } from '../../../src/services/eventLocation/eventLocation.service';
import { createActor } from '../../factories/actorFactory';
import { EventLocationFactoryBuilder } from '../../factories/eventLocationFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

// Create valid input for creation (without auto-generated fields)
const fullEntity = EventLocationFactoryBuilder.create();
const {
    id,
    createdAt,
    updatedAt,
    createdById,
    updatedById,
    deletedAt,
    deletedById,
    ...validInput
} = fullEntity;
const actorWithPerm = createActor({ permissions: [PermissionEnum.EVENT_LOCATION_UPDATE] });
const actorWithoutPerm = createActor({ permissions: [] });

let loggerMock: ReturnType<typeof createLoggerMock>;

describe('EventLocationService.create', () => {
    let service: EventLocationService;
    let model: EventLocationModel;

    beforeEach(() => {
        model = new EventLocationModel();
        loggerMock = createLoggerMock();
        service = new EventLocationService({ logger: loggerMock }, model);
        vi.clearAllMocks();
    });

    it('creates event location if actor has permission', async () => {
        vi.spyOn(model, 'create').mockResolvedValue(fullEntity);
        const result = await service.create(actorWithPerm, validInput);
        expect(result.data).toBeTruthy();
        expect(result.data?.street).toBe(validInput.street);
    });

    it('returns error if actor lacks permission', async () => {
        const result = await service.create(actorWithoutPerm, validInput);
        expect(result.error).toBeTruthy();
        expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('fails if required field city is missing', async () => {
        vi.spyOn(model, 'create').mockImplementation(() => {
            throw new Error('Validation error');
        });
        let input = { ...validInput };
        input = { ...input, city: '' };
        const result = await service.create(actorWithPerm, input);
        expect(result.error).toBeTruthy();
        expect(result.data).toBeUndefined();
    });

    it('trims fields with only spaces', async () => {
        const input = { ...validInput, street: '   ', city: '   ' };
        vi.spyOn(model, 'create').mockResolvedValue({ ...fullEntity, street: '', city: '' });
        const result = await service.create(actorWithPerm, input);
        expect(result.data?.street).toBe('');
        expect(result.data?.city).toBe('');
    });

    it('fails if model throws error', async () => {
        vi.spyOn(model, 'create').mockRejectedValue(new Error('DB error'));
        const result = await service.create(actorWithPerm, validInput);
        expect(result.error).toBeTruthy();
        expect(result.data).toBeUndefined();
    });

    it('fails if model returns undefined', async () => {
        vi.spyOn(model, 'create').mockResolvedValue(null as unknown as typeof fullEntity);
        const result = await service.create(actorWithPerm, validInput);
        expect(result.error).toBeTruthy();
        expect(result.data).toBeUndefined();
    });

    it('ignores coordinates if invalid', async () => {
        const input = { ...validInput, coordinates: { lat: '', long: '' } };
        vi.spyOn(model, 'create').mockResolvedValue({ ...fullEntity, coordinates: undefined });
        const result = await service.create(actorWithPerm, input);
        expect(result.data?.coordinates).toBeUndefined();
    });

    it('handles adminInfo undefined', async () => {
        const input = { ...validInput, adminInfo: undefined };
        vi.spyOn(model, 'create').mockResolvedValue({ ...fullEntity, adminInfo: undefined });
        const result = await service.create(actorWithPerm, input);
        expect(result.data?.adminInfo).toBeUndefined();
    });

    it('rejects unexpected fields in input', async () => {
        const input = { ...validInput, unexpectedField: 'foo' } as unknown;
        const result = await service.create(actorWithPerm, input as typeof validInput);
        expect(result.error).toBeTruthy();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.data).toBeUndefined();
    });
});
