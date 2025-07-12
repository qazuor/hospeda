import { AttractionModel } from '@repo/db';
import type { AttractionId } from '@repo/types';
import { PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { AttractionService } from '../../../src/services/attraction/attraction.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AttractionFactoryBuilder } from '../../factories/attractionFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// --- TESTS ---
describe('AttractionService.create', () => {
    let service: AttractionService;
    let attractionModelMock: AttractionModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const input = {
        name: 'Test Attraction',
        slug: 'test-attraction',
        description: 'A test attraction',
        icon: '🎡',
        isBuiltin: false,
        isFeatured: false
    };
    const createdAttraction = AttractionFactoryBuilder.create({
        ...input,
        id: getMockId('feature', 'attr-1') as AttractionId
    });

    beforeEach(() => {
        attractionModelMock = createTypedModelMock(AttractionModel, ['create', 'findOne']);
        loggerMock = createLoggerMock();
        service = new AttractionService({ logger: loggerMock }, attractionModelMock);
        actor = createActor({ permissions: [PermissionEnum.DESTINATION_CREATE] });
    });

    it('should create an attraction (success)', async () => {
        asMock(attractionModelMock.findOne).mockResolvedValue(null); // uniqueness
        asMock(attractionModelMock.create).mockResolvedValue(createdAttraction);
        const result = await service.create(actor, input);
        expectSuccess(result);
        expect(result.data).toMatchObject(input);
    });

    it('should return FORBIDDEN if actor lacks DESTINATION_CREATE permission', async () => {
        actor = createActor({ permissions: [] });
        const result = await service.create(actor, input);
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        // name empty
        const result = await service.create(actor, { ...input, name: '' });
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        asMock(attractionModelMock.findOne).mockRejectedValue(new Error('DB error'));
        const result = await service.create(actor, input);
        expectInternalError(result);
    });

    it('should generate a unique slug if name is duplicated', async () => {
        asMock(attractionModelMock.findOne)
            .mockResolvedValueOnce(null) // first slug is unique
            .mockResolvedValueOnce({ ...createdAttraction, slug: 'test-attraction' }) // second slug exists
            .mockResolvedValueOnce(null); // unique after suffix
        asMock(attractionModelMock.create).mockResolvedValueOnce(createdAttraction);
        asMock(attractionModelMock.create).mockResolvedValueOnce({
            ...createdAttraction,
            slug: 'test-attraction-2'
        });
        // First creation
        const result1 = await service.create(actor, input);
        expectSuccess(result1);
        expect(result1.data?.slug).toBe('test-attraction');
        // Second creation with same name
        const result2 = await service.create(actor, input);
        expectSuccess(result2);
        expect(result2.data?.slug).toMatch(/^test-attraction(-\d+)?$/);
        expect(result2.data?.slug).not.toBe(result1.data?.slug);
    });
});
