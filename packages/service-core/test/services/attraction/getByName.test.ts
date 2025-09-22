import { AttractionModel } from '@repo/db';
import type { AttractionIdType } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as permissionHelpers from '../../../src/services/attraction/attraction.permissions';
import { AttractionService } from '../../../src/services/attraction/attraction.service';
import type { Actor } from '../../../src/types';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { AttractionFactoryBuilder } from '../../factories/attractionFactory';

import { getMockId } from '../../factories/utilsFactory';
import { expectForbiddenError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('AttractionService.getByName', () => {
    let service: AttractionService;
    let attractionModelMock: AttractionModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;
    const attraction = AttractionFactoryBuilder.create({
        id: getMockId('feature', 'attr-1') as AttractionIdType,
        name: 'Test Attraction'
    });

    beforeEach(() => {
        attractionModelMock = createTypedModelMock(AttractionModel, ['findOne']);
        loggerMock = createLoggerMock();
        service = new AttractionService({ logger: loggerMock }, attractionModelMock);
        actor = createActor({ permissions: [] });
    });

    it('should return an attraction by name (success)', async () => {
        asMock(attractionModelMock.findOne).mockResolvedValue(attraction);
        vi.spyOn(permissionHelpers, 'checkCanViewAttraction').mockReturnValue();
        const result = await service.getByName(actor, attraction.name);
        expectSuccess(result);
        expect(result.data).toBeDefined();
        expect(result.data?.name).toBe(attraction.name);
    });

    it('should return NOT_FOUND error if attraction does not exist', async () => {
        asMock(attractionModelMock.findOne).mockResolvedValue(null);
        const result = await service.getByName(actor, attraction.name);
        expectNotFoundError(result);
    });

    it('should return FORBIDDEN if actor lacks permission', async () => {
        asMock(attractionModelMock.findOne).mockResolvedValue(attraction);
        vi.spyOn(permissionHelpers, 'checkCanViewAttraction').mockImplementation(() => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        });
        const result = await service.getByName(actor, attraction.name);
        expectForbiddenError(result);
    });
});
