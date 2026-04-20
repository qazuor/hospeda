/**
 * @fileoverview
 * Tests for PostService `_afterHardDelete` media cleanup wiring.
 *
 * Scope (SPEC-078-GAPS T-065, gaps GAP-078-094 + GAP-078-095):
 * - Verifies that the injected `ImageProvider` (InMemoryImageProvider from
 *   `@repo/media/test-utils`) has `deleteByPrefix` invoked with the canonical
 *   `hospeda/{env}/posts/{entityId}/` prefix after a confirmed hard delete.
 * - Verifies hookState propagation: `ctx.hookState.deletedEntityId` is
 *   captured in `_beforeHardDelete` and consumed in `_afterHardDelete`.
 * - Verifies resilience: when the provider throws, hardDelete still succeeds
 *   at the DB level and the error does not propagate.
 * - Verifies short-circuit when either the provider is null or the DB
 *   reported zero deleted rows.
 */
import { PostModel } from '@repo/db';
import { resolveEnvironment } from '@repo/media/server';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { PermissionEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import { createActor } from '../../factories/actorFactory';
import { createMockPost } from '../../factories/postFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

describe('PostService.hardDelete — media cleanup (T-065)', () => {
    let service: PostService;
    let modelMock: PostModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let provider: InMemoryImageProvider;
    let post: ReturnType<typeof createMockPost>;
    let actor: ReturnType<typeof createActor>;
    let postId: string;

    const expectedPrefix = (id: string) => `hospeda/${resolveEnvironment()}/posts/${id}/`;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostModel, ['findById', 'hardDelete']);
        loggerMock = createLoggerMock();
        provider = new InMemoryImageProvider();
        service = new PostService({ logger: loggerMock }, modelMock, provider);
        post = createMockPost();
        postId = post.id;
        actor = createActor({ permissions: [PermissionEnum.POST_HARD_DELETE] });
        (modelMock.findById as Mock).mockResolvedValue(post);
        (modelMock.hardDelete as Mock).mockResolvedValue(1);
    });

    it('calls deleteByPrefix with hospeda/{env}/posts/{id}/ after a confirmed hard delete', async () => {
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        const result = await service.hardDelete(actor, postId);

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        expect(deleteSpy).toHaveBeenCalledTimes(1);
        expect(deleteSpy).toHaveBeenCalledWith({ prefix: expectedPrefix(postId) });
    });

    it('captures deletedEntityId on hookState during _beforeHardDelete and consumes it in _afterHardDelete', async () => {
        const afterSpy = vi.spyOn(
            service as unknown as {
                _afterHardDelete: PostService['_afterHardDelete' extends never ? never : never];
            },
            '_afterHardDelete' as never
        );
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        const result = await service.hardDelete(actor, postId);

        expect(result.error).toBeUndefined();
        const callArgs = afterSpy.mock.calls[0];
        const ctxArg = callArgs?.[2] as {
            hookState?: { deletedEntityId?: string };
        };
        expect(ctxArg?.hookState?.deletedEntityId).toBe(postId);
        expect(deleteSpy).toHaveBeenCalledWith({ prefix: expectedPrefix(postId) });
    });

    it('does NOT call the provider when no mediaProvider is injected', async () => {
        const serviceNoProvider = new PostService({ logger: loggerMock }, modelMock);
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        const result = await serviceNoProvider.hardDelete(actor, postId);

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('does NOT call the provider when the DB reports zero deleted rows', async () => {
        (modelMock.hardDelete as Mock).mockResolvedValue(0);
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        const result = await service.hardDelete(actor, postId);

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(0);
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('swallows provider errors: hardDelete still succeeds even when deleteByPrefix rejects', async () => {
        const providerError = new Error('Cloudinary is down');
        vi.spyOn(provider, 'deleteByPrefix').mockRejectedValueOnce(providerError);

        const result = await service.hardDelete(actor, postId);

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
    });
});
