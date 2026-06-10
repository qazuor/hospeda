/**
 * @fileoverview
 * Unit tests for EventService.findOptions (SPEC-169 §5.5 / decision D4 / T-018).
 *
 * Verifies the { id, label, slug } payload shape (label = event name), admin-panel-only
 * gating, and DRAFT-inclusivity (delegates to model.findAll which only excludes soft-deleted
 * rows).
 */
import type { EventModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { ServiceConfig } from '@repo/service-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import { createActor } from '../../factories/actorFactory';
import type { StandardModelMock } from '../../utils/modelMockFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const draftRow = {
    id: 'event-draft-1',
    name: 'Festival de la Cerveza',
    slug: 'festival-de-la-cerveza',
    lifecycleState: 'DRAFT'
};

describe('EventService.findOptions (SPEC-169 §5.5)', () => {
    let service: EventService;
    let model: ReturnType<typeof createModelMock>;

    const panelOnlyActor = createActor({
        role: RoleEnum.EDITOR,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
    });
    const noAccessActor = createActor({
        role: RoleEnum.USER,
        permissions: [PermissionEnum.EVENT_VIEW_PRIVATE]
    });

    beforeEach(() => {
        model = createModelMock();
        asMock(model.findAll).mockResolvedValue({ items: [], total: 0 });
        service = new EventService({
            logger: createLoggerMock(),
            model: model as StandardModelMock as unknown as EventModel
        } as unknown as ServiceConfig & { model?: EventModel });
    });

    it('projects { id, label, slug } for a matched row', async () => {
        asMock(model.findAll).mockResolvedValueOnce({ items: [draftRow], total: 1 });
        const result = await service.findOptions(panelOnlyActor, {});
        expect(result.error).toBeUndefined();
        expect(result.data?.items).toEqual([
            { id: 'event-draft-1', label: 'Festival de la Cerveza', slug: 'festival-de-la-cerveza' }
        ]);
    });

    it('is DRAFT-inclusive: a DRAFT row is returned (no publication-state filter)', async () => {
        asMock(model.findAll).mockResolvedValueOnce({ items: [draftRow], total: 1 });
        const result = await service.findOptions(panelOnlyActor, {});
        expect(result.data?.items.map((i) => i.id)).toContain('event-draft-1');
    });

    it('defaults limit to 20 when not provided', async () => {
        await service.findOptions(panelOnlyActor, {});
        const [, options] = asMock(model.findAll).mock.calls[0] as [unknown, { pageSize?: number }];
        expect(options.pageSize).toBe(20);
    });

    it('succeeds for an ACCESS_PANEL_ADMIN-only actor (no _VIEW_ALL required)', async () => {
        const result = await service.findOptions(panelOnlyActor, {});
        expect(result.error).toBeUndefined();
        expect(result.data?.items).toEqual([]);
    });

    it('is FORBIDDEN for an actor without admin-panel access', async () => {
        const result = await service.findOptions(noAccessActor, {});
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.findAll).not.toHaveBeenCalled();
    });
});
