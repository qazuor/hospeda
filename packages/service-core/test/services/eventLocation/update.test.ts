import { EventLocationModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventLocationService } from '../../../src/services/eventLocation/eventLocation.service';
import { createActor } from '../../factories/actorFactory';
import { EventLocationFactoryBuilder } from '../../factories/eventLocationFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

const updateInput = { city: 'New City', street: 'Main St' };
const fullEntity = EventLocationFactoryBuilder.create();
const actorWithPerm = createActor({ permissions: [PermissionEnum.EVENT_LOCATION_UPDATE] });
const actorWithoutPerm = createActor({ permissions: [] });

let loggerMock: ReturnType<typeof createLoggerMock>;

describe('EventLocationService.update', () => {
    let service: EventLocationService;
    let model: EventLocationModel;

    beforeEach(() => {
        model = new EventLocationModel();
        loggerMock = createLoggerMock();
        service = new EventLocationService({ logger: loggerMock }, model);
        vi.clearAllMocks();
    });

    it('updates event location if actor has permission', async () => {
        vi.spyOn(model, 'update').mockResolvedValue({ ...fullEntity, ...updateInput });
        vi.spyOn(model, 'findById').mockResolvedValue(fullEntity);
        const result = await service.update(actorWithPerm, fullEntity.id, updateInput);
        expect(result.data).toBeTruthy();
        expect(result.data?.city).toBe('New City');
    });

    it('returns error if actor lacks permission', async () => {
        vi.spyOn(model, 'findById').mockResolvedValue(fullEntity);
        const updateSpy = vi.spyOn(model, 'update');
        const result = await service.update(actorWithoutPerm, fullEntity.id, updateInput);
        expect(result.error).toBeTruthy();
        expect(result.error?.code).toBe('FORBIDDEN');
        expect(updateSpy).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND if model returns null', async () => {
        vi.spyOn(model, 'findById').mockResolvedValue(null);
        const result = await service.update(actorWithPerm, fullEntity.id, updateInput);
        expect(result.error).toBeTruthy();
        expect(result.data).toBeUndefined();
    });

    it('returns INTERNAL_ERROR if model throws error', async () => {
        vi.spyOn(model, 'findById').mockResolvedValue(fullEntity);
        vi.spyOn(model, 'update').mockRejectedValue(new Error('DB error'));
        const result = await service.update(actorWithPerm, fullEntity.id, updateInput);
        expect(result.error).toBeTruthy();
        expect(result.data).toBeUndefined();
    });

    it('returns VALIDATION_ERROR for invalid input (city empty)', async () => {
        vi.spyOn(model, 'findById').mockResolvedValue(fullEntity);
        const invalidInput = { ...updateInput, city: '' };
        vi.spyOn(model, 'update').mockResolvedValue({ ...fullEntity, ...invalidInput });
        const result = await service.update(actorWithPerm, fullEntity.id, invalidInput);
        expect(result.error).toBeTruthy();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('ignores coordinates if invalid', async () => {
        vi.spyOn(model, 'findById').mockResolvedValue(fullEntity);
        const input = { ...updateInput, coordinates: { lat: '', long: '' } };
        vi.spyOn(model, 'update').mockResolvedValue({ ...fullEntity, coordinates: undefined });
        const result = await service.update(actorWithPerm, fullEntity.id, input);
        expect(result.data?.coordinates).toBeUndefined();
    });

    it('handles adminInfo undefined', async () => {
        vi.spyOn(model, 'findById').mockResolvedValue(fullEntity);
        const input = { ...updateInput, adminInfo: undefined };
        vi.spyOn(model, 'update').mockResolvedValue({ ...fullEntity, ...input });
        const result = await service.update(actorWithPerm, fullEntity.id, input);
        expect(result.data?.adminInfo).toBeUndefined();
    });

    it('ignores unexpected fields in input', async () => {
        vi.spyOn(model, 'findById').mockResolvedValue(fullEntity);
        const input = { ...updateInput, unexpectedField: 'foo' } as typeof updateInput & {
            unexpectedField: string;
        };
        vi.spyOn(model, 'update').mockResolvedValue({ ...fullEntity, ...updateInput });
        const result = await service.update(actorWithPerm, fullEntity.id, input);
        expect(
            (result.data as typeof updateInput & { unexpectedField?: string })?.unexpectedField
        ).toBeUndefined();
    });

    it('returns unchanged object if model returns same entity', async () => {
        vi.spyOn(model, 'findById').mockResolvedValue(fullEntity);
        vi.spyOn(model, 'update').mockResolvedValue(fullEntity);
        const result = await service.update(actorWithPerm, fullEntity.id, {});
        expect(result.data).toEqual(fullEntity);
    });

    it('handles all optional fields as undefined', async () => {
        vi.spyOn(model, 'findById').mockResolvedValue(fullEntity);
        const input = { city: updateInput.city };
        vi.spyOn(model, 'update').mockResolvedValue({ ...fullEntity, ...input });
        const result = await service.update(actorWithPerm, fullEntity.id, input);
        expect(result.data?.city).toBe(updateInput.city);
    });
});
