/**
 * @fileoverview
 * Tests for DestinationService `_afterHardDelete` media cleanup wiring.
 *
 * Scope (SPEC-078-GAPS T-065, gaps GAP-078-094 + GAP-078-095):
 * - Verifies that the injected `ImageProvider` (InMemoryImageProvider from
 *   `@repo/media/test-utils`) has `deleteByPrefix` invoked with the canonical
 *   `hospeda/{env}/destinations/{entityId}/` prefix after a confirmed hard
 *   delete.
 * - Verifies hookState propagation: `ctx.hookState.deletedEntityId` is
 *   captured in `_beforeHardDelete` and consumed in `_afterHardDelete`.
 * - Verifies resilience: when the provider throws, hardDelete still succeeds
 *   at the DB level (the warn goes through the class-level revalidation
 *   logger, not `this.logger`, so we do not spy on the logger here — the
 *   critical contract is that the error does not bubble up).
 * - Verifies short-circuit when either the provider is null or the DB
 *   reported zero deleted rows.
 */
import type { DestinationModel } from '@repo/db';
import { resolveEnvironment } from '@repo/media/server';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { PermissionEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { createActor } from '../../factories/actorFactory';
import { createDestination } from '../../factories/destinationFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const createHardDeleteActor = () =>
    createActor({ permissions: [PermissionEnum.DESTINATION_HARD_DELETE] });

const createEntity = () => {
    const id = getMockId('destination');
    return { ...createDestination(), id };
};

describe('DestinationService.hardDelete — media cleanup (T-065)', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;
    let provider: InMemoryImageProvider;
    let entity: ReturnType<typeof createEntity>;
    let actor: ReturnType<typeof createHardDeleteActor>;

    const expectedPrefix = (id: string) => `hospeda/${resolveEnvironment()}/destinations/${id}/`;

    beforeEach(() => {
        vi.clearAllMocks();
        model = createModelMock();
        provider = new InMemoryImageProvider();
        service = new DestinationService(
            { logger: mockLogger },
            model as unknown as DestinationModel,
            provider
        );
        entity = createEntity();
        actor = createHardDeleteActor();
        (model.findById as Mock).mockResolvedValue(entity);
        (model.hardDelete as Mock).mockResolvedValue(1);
    });

    it('calls deleteByPrefix with hospeda/{env}/destinations/{id}/ after a confirmed hard delete', async () => {
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        const result = await service.hardDelete(actor, entity.id);

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        expect(deleteSpy).toHaveBeenCalledTimes(1);
        expect(deleteSpy).toHaveBeenCalledWith({ prefix: expectedPrefix(entity.id) });
    });

    it('captures deletedEntityId on hookState during _beforeHardDelete and consumes it in _afterHardDelete', async () => {
        const afterSpy = vi.spyOn(
            service as unknown as {
                _afterHardDelete: DestinationService['_afterHardDelete' extends never
                    ? never
                    : never];
            },
            '_afterHardDelete' as never
        );
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        const result = await service.hardDelete(actor, entity.id);

        expect(result.error).toBeUndefined();
        const callArgs = afterSpy.mock.calls[0];
        const ctxArg = callArgs?.[2] as {
            hookState?: { deletedEntityId?: string };
        };
        expect(ctxArg?.hookState?.deletedEntityId).toBe(entity.id);
        expect(deleteSpy).toHaveBeenCalledWith({ prefix: expectedPrefix(entity.id) });
    });

    it('does NOT call the provider when no mediaProvider is injected', async () => {
        const serviceNoProvider = new DestinationService(
            { logger: mockLogger },
            model as unknown as DestinationModel
        );
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        const result = await serviceNoProvider.hardDelete(actor, entity.id);

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('does NOT call the provider when the DB reports zero deleted rows', async () => {
        (model.hardDelete as Mock).mockResolvedValue(0);
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        const result = await service.hardDelete(actor, entity.id);

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(0);
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('swallows provider errors: hardDelete still succeeds even when deleteByPrefix rejects', async () => {
        const providerError = new Error('Cloudinary is down');
        vi.spyOn(provider, 'deleteByPrefix').mockRejectedValueOnce(providerError);

        const result = await service.hardDelete(actor, entity.id);

        // DB delete succeeded and the provider error did not propagate.
        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
    });
});
