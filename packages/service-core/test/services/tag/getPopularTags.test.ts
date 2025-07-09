import { REntityTagModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagService } from '../../../src/services/tag/tag.service';
import type { Actor } from '../../../src/types';
import { ServiceError } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import {
    expectForbiddenError,
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as import('vitest').Mock;

describe('TagService.getPopularTags', () => {
    let service: TagService;
    let modelMock: REntityTagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;

    beforeEach(() => {
        modelMock = createTypedModelMock(REntityTagModel, ['findPopularTags']);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, undefined, modelMock);
        actor = createActor();
    });

    it('should return the most used tags, ordered by usage count', async () => {
        // Arrange
        const tagA = TagFactoryBuilder.create({ name: 'A' });
        const tagB = TagFactoryBuilder.create({ name: 'B' });
        const tagC = TagFactoryBuilder.create({ name: 'C' });
        asMock(modelMock.findPopularTags).mockResolvedValue([
            { tag: tagA, usageCount: 3 },
            { tag: tagB, usageCount: 2 },
            { tag: tagC, usageCount: 1 }
        ]);
        // Act
        const result = await service.getPopularTags(actor, { limit: 10 });
        // Assert
        expectSuccess(result);
        expect(result.data?.tags).toEqual([tagA, tagB, tagC]);
    });

    it('should respect the limit parameter', async () => {
        // Arrange
        const tagA = TagFactoryBuilder.create({ name: 'A' });
        const tagB = TagFactoryBuilder.create({ name: 'B' });
        asMock(modelMock.findPopularTags).mockResolvedValue([
            { tag: tagA, usageCount: 3 },
            { tag: tagB, usageCount: 2 }
        ]);
        // Act
        const result = await service.getPopularTags(actor, { limit: 2 });
        // Assert
        expectSuccess(result);
        expect(result.data?.tags).toEqual([tagA, tagB]);
    });

    it('should return an empty array if there are no tags', async () => {
        // Arrange
        asMock(modelMock.findPopularTags).mockResolvedValue([]);
        // Act
        const result = await service.getPopularTags(actor, { limit: 10 });
        // Assert
        expectSuccess(result);
        expect(result.data?.tags).toEqual([]);
    });

    it('should return FORBIDDEN if actor cannot list', async () => {
        // Arrange
        (service as TagService & { _canList: () => void })._canList = () => {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'forbidden');
        };
        // Act
        const result = await service.getPopularTags(actor, { limit: 10 });
        // Assert
        expectForbiddenError(result);
    });

    it('should return VALIDATION_ERROR for invalid input', async () => {
        const result = await service.getPopularTags(
            actor,
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            { limit: -1 } as any
        );
        expectValidationError(result);
    });

    it('should return INTERNAL_ERROR if model throws', async () => {
        // Arrange
        asMock(modelMock.findPopularTags).mockRejectedValue(new Error('DB error'));
        // Act
        const result = await service.getPopularTags(actor, { limit: 10 });
        // Assert
        expectInternalError(result);
    });
});
