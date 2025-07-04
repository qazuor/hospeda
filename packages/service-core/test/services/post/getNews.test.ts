import { PostModel } from '@repo/db';
import type { PostId } from '@repo/types';
import { VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
// TODO: Implement createMockPost en factories/postFactory.ts
import { createActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import { getMockId } from '../../factories/utilsFactory';
import {
    expectInternalError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

describe('PostService.getNews', () => {
    let service: PostService;
    let modelMock: PostModel;
    let loggerMock: ServiceLogger;
    const actor = createActor({ id: getMockId('user') });

    beforeEach(() => {
        modelMock = createTypedModelMock(PostModel, ['findAll']);
        loggerMock = createLoggerMock();
        service = new PostService({ logger: loggerMock }, modelMock);
    });

    it('should return news posts (success)', async () => {
        const posts = [createMockPost(), createMockPost({ id: getMockId('post', '2') as PostId })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 2 });
        const input = { actor };
        // LOG: Verificar input y actor
        // biome-ignore lint/suspicious/noConsoleLog: debug only
        console.log('TEST: input for success', JSON.stringify(input));
        // biome-ignore lint/suspicious/noConsoleLog: debug only
        console.log('TEST: actor for success', JSON.stringify(actor));
        const result = await service.getNews(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(2);
        expect(modelMock.findAll).toHaveBeenCalledWith({ isNews: true });
    });

    it('should filter by visibility', async () => {
        const posts = [createMockPost({ visibility: VisibilityEnum.PRIVATE })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const input = { actor, visibility: VisibilityEnum.PRIVATE };
        // LOG: Verificar input y actor
        // biome-ignore lint/suspicious/noConsoleLog: debug only
        console.log('TEST: input for visibility', JSON.stringify(input));
        // biome-ignore lint/suspicious/noConsoleLog: debug only
        console.log('TEST: actor for visibility', JSON.stringify(actor));
        const result = await service.getNews(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            isNews: true,
            visibility: VisibilityEnum.PRIVATE
        });
    });

    it('should filter by fromDate and toDate', async () => {
        const posts = [createMockPost({ expiresAt: new Date('2024-07-01') })];
        (modelMock.findAll as Mock).mockResolvedValue({ items: posts, total: 1 });
        const input = { actor, fromDate: new Date('2024-07-01'), toDate: new Date('2024-07-31') };
        // LOG: Verificar input y actor
        // biome-ignore lint/suspicious/noConsoleLog: debug only
        console.log('TEST: input for fromDate/toDate', JSON.stringify(input));
        // biome-ignore lint/suspicious/noConsoleLog: debug only
        console.log('TEST: actor for fromDate/toDate', JSON.stringify(actor));
        const result = await service.getNews(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(modelMock.findAll).toHaveBeenCalledWith({
            isNews: true,
            expiresAt: { gte: input.fromDate, lte: input.toDate }
        });
    });

    it('should return empty list if no news found', async () => {
        (modelMock.findAll as Mock).mockResolvedValue({ items: [], total: 0 });
        const input = { actor };
        // LOG: Verificar input y actor
        // biome-ignore lint/suspicious/noConsoleLog: debug only
        console.log('TEST: input for empty', JSON.stringify(input));
        // biome-ignore lint/suspicious/noConsoleLog: debug only
        console.log('TEST: actor for empty', JSON.stringify(actor));
        const result = await service.getNews(input);
        expectSuccess(result);
        expect(result.data).toHaveLength(0);
    });

    it('should return forbidden if actor is missing', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getNews({});
        expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return validation error if input is invalid', async () => {
        // @ts-expect-error purposely invalid
        const result = await service.getNews({ actor: 123 });
        expectValidationError(result);
    });

    it('should return internal error if model fails', async () => {
        (modelMock.findAll as Mock).mockRejectedValue(new Error('DB error'));
        const input = { actor };
        const result = await service.getNews(input);
        expectInternalError(result);
    });
});
