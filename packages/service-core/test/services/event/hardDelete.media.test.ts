/**
 * @fileoverview
 * Tests for EventService `_afterHardDelete` media cleanup wiring.
 *
 * Scope (SPEC-078-GAPS T-065, gaps GAP-078-094 + GAP-078-095):
 * - Verifies that the injected `ImageProvider` (InMemoryImageProvider from
 *   `@repo/media/test-utils`) has `deleteByPrefix` invoked with the canonical
 *   `hospeda/{env}/events/{entityId}/` prefix after a confirmed hard delete.
 * - Verifies hookState propagation: `ctx.hookState.deletedEntityId` is
 *   captured in `_beforeHardDelete` and consumed in `_afterHardDelete`.
 * - Verifies resilience: when the provider throws, hardDelete still succeeds
 *   at the DB level and the error does not propagate.
 * - Verifies short-circuit when either the provider is null or the DB
 *   reported zero deleted rows.
 */
import { EventModel } from '@repo/db';
import { resolveEnvironment } from '@repo/media/server';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { PermissionEnum, VisibilityEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import { createMockEvent } from '../../factories/eventFactory';
import { createUser } from '../../factories/userFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

describe('EventService.hardDelete — media cleanup (T-065)', () => {
    let service: EventService;
    let modelMock: EventModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let provider: InMemoryImageProvider;
    const actor = createUser({ permissions: [PermissionEnum.EVENT_HARD_DELETE] });
    const existingEvent = createMockEvent({ visibility: VisibilityEnum.PUBLIC });
    const eventId = existingEvent.id;

    const expectedPrefix = (id: string) => `hospeda/${resolveEnvironment()}/events/${id}/`;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(EventModel, ['findById', 'hardDelete']);
        loggerMock = createLoggerMock();
        provider = new InMemoryImageProvider();
        service = new EventService({ model: modelMock, logger: loggerMock }, provider);
        (modelMock.findById as Mock).mockResolvedValue(existingEvent);
        (modelMock.hardDelete as Mock).mockResolvedValue(1);
    });

    it('calls deleteByPrefix with hospeda/{env}/events/{id}/ after a confirmed hard delete', async () => {
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        const result = await service.hardDelete(actor, eventId);

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        expect(deleteSpy).toHaveBeenCalledTimes(1);
        expect(deleteSpy).toHaveBeenCalledWith({ prefix: expectedPrefix(eventId) });
    });

    it('captures deletedEntityId on hookState during _beforeHardDelete and consumes it in _afterHardDelete', async () => {
        const afterSpy = vi.spyOn(
            service as unknown as {
                _afterHardDelete: EventService['_afterHardDelete' extends never ? never : never];
            },
            '_afterHardDelete' as never
        );
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        const result = await service.hardDelete(actor, eventId);

        expect(result.error).toBeUndefined();
        const callArgs = afterSpy.mock.calls[0];
        const ctxArg = callArgs?.[2] as {
            hookState?: { deletedEntityId?: string };
        };
        expect(ctxArg?.hookState?.deletedEntityId).toBe(eventId);
        expect(deleteSpy).toHaveBeenCalledWith({ prefix: expectedPrefix(eventId) });
    });

    it('does NOT call the provider when no mediaProvider is injected', async () => {
        const serviceNoProvider = new EventService({ model: modelMock, logger: loggerMock });
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        const result = await serviceNoProvider.hardDelete(actor, eventId);

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('does NOT call the provider when the DB reports zero deleted rows', async () => {
        (modelMock.hardDelete as Mock).mockResolvedValue(0);
        const deleteSpy = vi.spyOn(provider, 'deleteByPrefix');

        const result = await service.hardDelete(actor, eventId);

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(0);
        expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('swallows provider errors: hardDelete still succeeds even when deleteByPrefix rejects', async () => {
        const providerError = new Error('Cloudinary is down');
        vi.spyOn(provider, 'deleteByPrefix').mockRejectedValueOnce(providerError);

        const result = await service.hardDelete(actor, eventId);

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(1);
    });
});
