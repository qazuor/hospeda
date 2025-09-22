import { AttractionModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { AttractionService } from '../../../src/services/attraction/attraction.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AttractionFactoryBuilder } from '../../factories/attractionFactory';

import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AttractionService.update', () => {
    let service: AttractionService;
    let attractionModelMock: AttractionModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const attraction = AttractionFactoryBuilder.create({ name: 'Test Attraction' });
    const updateInput = { name: 'Updated Attraction' };

    beforeEach(() => {
        attractionModelMock = createTypedModelMock(AttractionModel, ['findById', 'update']);
        loggerMock = createLoggerMock();
        service = new AttractionService({ logger: loggerMock }, attractionModelMock);
        actor = createActor({ permissions: [PermissionEnum.DESTINATION_UPDATE] });
    });

    it('should update an attraction (success)', async () => {
        asMock(attractionModelMock.findById).mockResolvedValue(attraction);
        asMock(attractionModelMock.update).mockResolvedValue({ ...attraction, ...updateInput });
        const result = await service.update(actor, attraction.id, updateInput);
        expectSuccess(result);
        expect(result.data).toMatchObject(updateInput);
    });

    it('should return FORBIDDEN if actor lacks DESTINATION_UPDATE permission', async () => {
        actor = createActor({ permissions: [] });
        asMock(attractionModelMock.findById).mockResolvedValue(attraction);
        const result = await service.update(actor, attraction.id, updateInput);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // name empty
        const result = await service.update(actor, attraction.id, { ...updateInput, name: '' });
        expectValidationError(result);
    });

    it('should return NOT_FOUND if attraction does not exist', async () => {
        asMock(attractionModelMock.findById).mockResolvedValue(null);
        const result = await service.update(actor, 'nonexistent-id', updateInput);
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(attractionModelMock.findById).mockResolvedValue(attraction);
        asMock(attractionModelMock.update).mockRejectedValue(new Error('DB error'));
        const result = await service.update(actor, attraction.id, updateInput);
        expectInternalError(result);
    });

    it('should allow partial update (only description)', async () => {
        asMock(attractionModelMock.findById).mockResolvedValue(attraction);
        asMock(attractionModelMock.update).mockResolvedValue({
            ...attraction,
            description: 'Descripción válida de la atracción.'
        });
        const result = await service.update(actor, attraction.id, {
            description: 'Descripción válida de la atracción.'
        });
        expectSuccess(result);
        expect(result.data?.description).toBe('Descripción válida de la atracción.');
        expect(result.data?.name).toBe(attraction.name);
    });

    it('should reject null for required fields', async () => {
        asMock(attractionModelMock.findById).mockResolvedValue(attraction);
        // @ts-expect-error
        const result = await service.update(actor, attraction.id, { name: null });
        expectValidationError(result);
    });

    it('should allow omitting optional fields in update', async () => {
        asMock(attractionModelMock.findById).mockResolvedValue(attraction);
        asMock(attractionModelMock.update).mockResolvedValue({ ...attraction });
        const result = await service.update(actor, attraction.id, {});
        expectSuccess(result);
        expect(result.data?.name).toBe(attraction.name);
    });
});
