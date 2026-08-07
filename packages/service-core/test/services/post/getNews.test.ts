import { PostModel } from '@repo/db';
import type { PostIdType } from '@repo/schemas';
import { RoleEnum, VisibilityEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock } from 'vitest';
import { PUBLIC_READ_FLOOR } from '../../../src/services/moderation/public-read-floor';
import { PostService } from '../../../src/services/post/post.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createMockPost } from '../../factories/postFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import {
    createLoggerMock,
    createTypedModelMock,
    makePostMediaModelStub
} from '../../utils/modelMockFactory';

describe('PostService.getNews', () => {
    let service: PostService;
    let modelMock: PostModel;
    let loggerMock: ServiceLogger;
    const actor = {
        id: 'ee11cbb1-7080-4727-9ed2-fa4cd82060da',
        roles: [RoleEnum.USER],
        permissions: []
    };

    beforeEach(() => {
        modelMock = createTypedModelMock(PostModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new PostService(
            { logger: loggerMock },
            modelMock,
            null,
            undefined,
            makePostMediaModelStub() as never
        );
    });

    it('should return news posts (success)', async () => {
        const posts = [
            createMockPost(),
            createMockPost({ id: getMockId('post', '2') as PostIdType })
        ];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 2 });
        const params = {};
        const result = await service.getNews(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(2);
        expect(modelMock.findAll).toHaveBeenCalledWith({ isNews: true, ...PUBLIC_READ_FLOOR });
    });

    it('should override a caller-supplied visibility with the public read floor', async () => {
        // HOS-374 §7.6.5: the public read floor is applied last on public read
        // paths, so a caller-supplied `visibility` (even PRIVATE) is overridden
        // rather than honored.
        const posts = [createMockPost({ visibility: VisibilityEnum.PUBLIC })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const params = { visibility: VisibilityEnum.PRIVATE };
        const result = await service.getNews(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            isNews: true,
            ...PUBLIC_READ_FLOOR
        });
    });

    it('should filter by fromDate and toDate', async () => {
        const posts = [createMockPost({ expiresAt: new Date('2024-07-01') })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const params = { fromDate: new Date('2024-07-01'), toDate: new Date('2024-07-31') };
        const result = await service.getNews(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            isNews: true,
            expiresAt: { gte: params.fromDate, lte: params.toDate },
            ...PUBLIC_READ_FLOOR
        });
    });

    it('should return empty list if no news found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const params = {};
        const result = await service.getNews(actor, params);
        expectSuccess(result);
        expect(result.data).toHaveLength(0);
    });

    it('should return forbidden if actor is missing', async () => {
        // purposely invalid
        const result = await service.getNews(null as any, {} as any);
        expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return validation error if input is invalid', async () => {
        // purposely invalid input: invalid date and extra field
        const result = await service.getNews(actor, { fromDate: 'not-a-date', foo: 'bar' } as any);
        expectValidationError(result);
    });

    it('should return internal error if model fails', async () => {
        (modelMock.findAll as Mock).mockRejectedValue(new Error('DB error'));
        const params = {};
        const result = await service.getNews(actor, params);
        expectInternalError(result);
    });
});
