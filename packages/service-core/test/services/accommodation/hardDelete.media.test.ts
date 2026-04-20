/**
 * @fileoverview
 * Tests for AccommodationService `_afterHardDelete` media cleanup wiring.
 *
 * Scope (SPEC-078-GAPS T-065, gaps GAP-078-094 + GAP-078-095):
 * - Verifies that the injected `ImageProvider` (InMemoryImageProvider from
 *   `@repo/media/test-utils`) has `deleteByPrefix` invoked with the canonical
 *   `hospeda/{env}/accommodations/{entityId}/` prefix after a confirmed hard
 *   delete.
 * - Verifies hookState propagation: `ctx.hookState.deletedEntityId` is captured
 *   in `_beforeHardDelete` and consumed in `_afterHardDelete`.
 * - Verifies resilience: when the provider throws, hardDelete still succeeds
 *   at the DB level and a warning is logged.
 * - Verifies short-circuit when either the provider is null or the DB
 *   reported zero deleted rows.
 */
import type { AccommodationModel } from '@repo/db';
import { resolveEnvironment } from '@repo/media/server';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { PermissionEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createAccommodationWithMockIds } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const mockLogger = createLoggerMock();

const createHardDeleteActor = () =>
    createActor({ permissions: [PermissionEnum.ACCOMMODATION_HARD_DELETE] });

const createEntity = () => createAccommodationWithMockIds({ deletedAt: undefined });

describe('AccommodationService.hardDelete — media cleanup (T-065)', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock>;
    let provider: InMemoryImageProvider;
    let entity: ReturnType<typeof createEntity>;
    let actor: ReturnType<typeof createHardDeleteActor>;

    const expectedPrefix = (id: string) => `hospeda/${resolveEnvironment()}/accommodations/${id}/`;

    beforeEach(() => {
        vi.clearAllMocks();
        model = createModelMock();
        provider = new InMemoryImageProvider();
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel,
            provider
        );
        // Override destinationService and _destinationModel to avoid hitting the real DB
        // from the _afterHardDelete revalidation branch.
        // @ts-expect-error: private field override for test isolation
        service.destinationService = {
            updateAccommodationsCount: vi.fn().mockResolvedValue(undefined)
        };
        // @ts-expect-error: private field override for test isolation
        service._destinationModel = {
            findById: vi.fn().mockResolvedValue({ slug: 'mock-destination' })
        };
        entity = createEntity();
        actor = createHardDeleteActor();
        (model.findById as Mock).mockResolvedValue(entity);
        (model.hardDelete as Mock).mockResolvedValue(1);
    });

    it('calls deleteByPrefix with hospeda/{env}/accommodations/{id}/ after a confirmed hard delete', async () => {
        // Arrange
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        // Act
        const result = await service.hardDelete(actor, entity.id);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        expect(deleteSpy).toHaveBeenCalledTimes(1);
        expect(deleteSpy).toHaveBeenCalledWith({ prefix: expectedPrefix(entity.id) });
    });

    it('captures deletedEntityId on hookState during _beforeHardDelete and consumes it in _afterHardDelete', async () => {
        // Arrange — spy on the concrete `_afterHardDelete` to inspect the ctx it received.
        const afterSpy = vi.spyOn(
            service as unknown as {
                _afterHardDelete: AccommodationService['_afterHardDelete' extends never
                    ? never
                    : never];
            },
            '_afterHardDelete' as never
        );
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        // Act
        const result = await service.hardDelete(actor, entity.id);

        // Assert
        expect(result.error).toBeUndefined();
        // The spy is called with (result, actor, ctx) — inspect ctx.hookState.deletedEntityId.
        const callArgs = afterSpy.mock.calls[0];
        const ctxArg = callArgs?.[2] as {
            hookState?: { deletedEntityId?: string };
        };
        expect(ctxArg?.hookState?.deletedEntityId).toBe(entity.id);
        // And that deleteByPrefix used that same id in the prefix.
        expect(deleteSpy).toHaveBeenCalledWith({ prefix: expectedPrefix(entity.id) });
    });

    it('does NOT call the provider when no mediaProvider is injected', async () => {
        // Arrange — rebuild the service without a provider.
        const serviceNoProvider = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel
        );
        // @ts-expect-error: private field override for test isolation
        serviceNoProvider.destinationService = {
            updateAccommodationsCount: vi.fn().mockResolvedValue(undefined)
        };
        // @ts-expect-error: private field override for test isolation
        serviceNoProvider._destinationModel = {
            findById: vi.fn().mockResolvedValue({ slug: 'mock-destination' })
        };
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        // Act
        const result = await serviceNoProvider.hardDelete(actor, entity.id);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('does NOT call the provider when the DB reports zero deleted rows', async () => {
        // Arrange
        (model.hardDelete as Mock).mockResolvedValue(0);
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        // Act
        const result = await service.hardDelete(actor, entity.id);

        // Assert — short-circuit: no media cleanup attempted when result.count === 0.
        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(0);
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('swallows provider errors: hardDelete still succeeds and logs a warning', async () => {
        // Arrange — force the provider to reject.
        const providerError = new Error('Cloudinary is down');
        vi.spyOn(provider, 'deleteByPrefix').mockRejectedValueOnce(providerError);

        // Act
        const result = await service.hardDelete(actor, entity.id);

        // Assert — DB delete succeeded, error did not propagate.
        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        // Logger.warn invoked with the error + prefix metadata.
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                error: providerError,
                prefix: expectedPrefix(entity.id)
            }),
            expect.stringContaining('Failed to clean up Cloudinary assets for accommodation')
        );
    });
});
