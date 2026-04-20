/**
 * @fileoverview
 * Tests for UserService `_afterHardDelete` avatar cleanup wiring.
 *
 * Scope (SPEC-078-GAPS T-065, gaps GAP-078-094 + GAP-078-095):
 * - Unlike accommodation/destination/event/post (which call
 *   `provider.deleteByPrefix`), user avatars live at a single known publicId,
 *   so `_afterHardDelete` calls `provider.delete({ publicId })`.
 * - Verifies that the satellite `imagePublicId` column captured in
 *   `_beforeHardDelete` is preferred over the legacy
 *   `hospeda/{env}/avatars/{entityId}` fallback.
 * - Verifies hookState propagation: `deletedEntityId` and
 *   `deletedImagePublicId` are both captured and consumed in the afterHook.
 * - Verifies resilience: when the provider throws, hardDelete still succeeds
 *   at the DB level and a warning is logged.
 * - Verifies short-circuit when either the provider is null or the DB
 *   reported zero deleted rows.
 */
import { UserModel } from '@repo/db';
import { resolveEnvironment } from '@repo/media/server';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createSuperAdminActor } from '../../factories/actorFactory';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

describe('UserService.hardDelete — avatar cleanup (T-065)', () => {
    let service: UserService;
    let userModelMock: UserModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let provider: InMemoryImageProvider;
    const userId = getMockId('user', 'user-1') as string;
    const actor = createSuperAdminActor();

    const legacyPublicId = (id: string) => `hospeda/${resolveEnvironment()}/avatars/${id}`;

    beforeEach(() => {
        vi.clearAllMocks();
        userModelMock = createTypedModelMock(UserModel, ['findById', 'hardDelete']);
        loggerMock = createLoggerMock();
        provider = new InMemoryImageProvider();
        service = new UserService({ logger: loggerMock }, userModelMock, provider);
    });

    it('calls provider.delete with the satellite imagePublicId captured in _beforeHardDelete', async () => {
        // Arrange — user row already has `imagePublicId` populated.
        const satelliteId = 'hospeda/test/avatars/custom-user-avatar';
        const entity = createUser({ id: userId, imagePublicId: satelliteId });
        (userModelMock.findById as Mock).mockResolvedValue(entity);
        (userModelMock.hardDelete as Mock).mockResolvedValue(1);
        const deleteSpy = vi.spyOn(provider, 'delete');

        // Act
        const result = await service.hardDelete(actor, userId);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        expect(deleteSpy).toHaveBeenCalledTimes(1);
        expect(deleteSpy).toHaveBeenCalledWith({ publicId: satelliteId });
    });

    it('falls back to the legacy hospeda/{env}/avatars/{id} publicId when the satellite column is null', async () => {
        // Arrange — legacy row: no `imagePublicId`.
        const entity = createUser({ id: userId, imagePublicId: null });
        (userModelMock.findById as Mock).mockResolvedValue(entity);
        (userModelMock.hardDelete as Mock).mockResolvedValue(1);
        const deleteSpy = vi.spyOn(provider, 'delete');

        // Act
        const result = await service.hardDelete(actor, userId);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        expect(deleteSpy).toHaveBeenCalledWith({ publicId: legacyPublicId(userId) });
    });

    it('captures deletedEntityId and deletedImagePublicId on hookState and consumes both in _afterHardDelete', async () => {
        const satelliteId = 'hospeda/test/avatars/another-custom-avatar';
        const entity = createUser({ id: userId, imagePublicId: satelliteId });
        (userModelMock.findById as Mock).mockResolvedValue(entity);
        (userModelMock.hardDelete as Mock).mockResolvedValue(1);

        const afterSpy = vi.spyOn(
            service as unknown as {
                _afterHardDelete: UserService['_afterHardDelete' extends never ? never : never];
            },
            '_afterHardDelete' as never
        );
        const deleteSpy = vi.spyOn(provider, 'delete');

        const result = await service.hardDelete(actor, userId);

        expect(result.error).toBeUndefined();
        const callArgs = afterSpy.mock.calls[0];
        const ctxArg = callArgs?.[2] as {
            hookState?: { deletedEntityId?: string; deletedImagePublicId?: string | null };
        };
        expect(ctxArg?.hookState?.deletedEntityId).toBe(userId);
        expect(ctxArg?.hookState?.deletedImagePublicId).toBe(satelliteId);
        expect(deleteSpy).toHaveBeenCalledWith({ publicId: satelliteId });
    });

    it('does NOT call the provider when no mediaProvider is injected', async () => {
        const entity = createUser({ id: userId, imagePublicId: 'hospeda/test/avatars/x' });
        (userModelMock.findById as Mock).mockResolvedValue(entity);
        (userModelMock.hardDelete as Mock).mockResolvedValue(1);
        const serviceNoProvider = new UserService({ logger: loggerMock }, userModelMock);
        const deleteSpy = vi.spyOn(provider, 'delete');

        const result = await serviceNoProvider.hardDelete(actor, userId);

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('does NOT call the provider when the DB reports zero deleted rows', async () => {
        const entity = createUser({ id: userId, imagePublicId: 'hospeda/test/avatars/x' });
        (userModelMock.findById as Mock).mockResolvedValue(entity);
        (userModelMock.hardDelete as Mock).mockResolvedValue(0);
        const deleteSpy = vi.spyOn(provider, 'delete');

        const result = await service.hardDelete(actor, userId);

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(0);
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('swallows provider errors: hardDelete still succeeds and logs a warning', async () => {
        const satelliteId = 'hospeda/test/avatars/failing';
        const entity = createUser({ id: userId, imagePublicId: satelliteId });
        (userModelMock.findById as Mock).mockResolvedValue(entity);
        (userModelMock.hardDelete as Mock).mockResolvedValue(1);
        const providerError = new Error('Cloudinary is down');
        vi.spyOn(provider, 'delete').mockRejectedValueOnce(providerError);

        const result = await service.hardDelete(actor, userId);

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        expect(loggerMock.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                error: providerError,
                publicId: satelliteId
            }),
            expect.stringContaining('Failed to clean up Cloudinary avatar for user')
        );
    });
});
