import { AttractionModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/attraction/attraction.permissions';
import { AttractionService } from '../../../src/services/attraction/attraction.service';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AttractionFactoryBuilder } from '../../factories/attractionFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

describe('AttractionService.getBySlug', () => {
    let service: AttractionService;
    let model: AttractionModel;
    let entity: ReturnType<typeof AttractionFactoryBuilder.create>;
    let actor: ReturnType<typeof createActor>;

    beforeEach(() => {
        model = createTypedModelMock(AttractionModel, ['findOne']);
        service = new AttractionService({ logger: createLoggerMock() }, model);
        entity = AttractionFactoryBuilder.create({ slug: 'test-attraction' });
        actor = createActor({ permissions: [] });
        vi.clearAllMocks();
    });

    it('should return an attraction by slug', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanViewAttraction').mockReturnValue();
        const testSlug = entity.slug ?? 'test-attraction';
        const result = await service.getBySlug(actor, testSlug);
        expect(result.data).toBeDefined();
        expect(result.data?.slug).toBe(entity.slug);
        expect(result.error).toBeUndefined();
    });

    it('should return a "not found" error if the entity does not exist', async () => {
        (model.findOne as Mock).mockResolvedValue(null);
        vi.spyOn(permissionHelpers, 'checkCanViewAttraction').mockReturnValue();
        const result = await service.getBySlug(actor, 'non-existent-slug');
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.data).toBeUndefined();
    });

    it('should return forbidden error if actor lacks permission', async () => {
        (model.findOne as Mock).mockResolvedValue(entity);
        vi.spyOn(permissionHelpers, 'checkCanViewAttraction').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const testSlug = entity.slug ?? 'test-attraction';
        const result = await service.getBySlug(actor, testSlug);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });
});
