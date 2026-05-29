/**
 * @fileoverview
 * Unit tests for EventLocationService.findOptions (SPEC-169 §5.5 / decision D4 / T-018).
 *
 * Event locations have NO `name` column — their display name is the NULLABLE `placeName`
 * (SPEC-169 §12 flag). Verifies:
 * - The { id, label, slug } payload shape with label = placeName.
 * - label falls back to slug when placeName is null.
 * - admin-panel-only gating + DRAFT-inclusivity.
 */
import type { EventLocationModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { ServiceConfig } from '@repo/service-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventLocationService } from '../../../src/services/eventLocation/eventLocation.service';
import { createActor } from '../../factories/actorFactory';
import type { StandardModelMock } from '../../utils/modelMockFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const rowWithPlaceName = {
    id: 'loc-draft-1',
    placeName: 'Teatro Municipal',
    slug: 'teatro-municipal',
    lifecycleState: 'DRAFT'
};

const rowWithoutPlaceName = {
    id: 'loc-2',
    placeName: null,
    slug: 'sala-sin-nombre',
    lifecycleState: 'ACTIVE'
};

describe('EventLocationService.findOptions (SPEC-169 §5.5)', () => {
    let service: EventLocationService;
    let model: ReturnType<typeof createModelMock>;

    const panelOnlyActor = createActor({
        role: RoleEnum.EDITOR,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
    });
    const noAccessActor = createActor({
        role: RoleEnum.USER,
        permissions: [PermissionEnum.EVENT_LOCATION_VIEW]
    });

    beforeEach(() => {
        model = createModelMock();
        asMock(model.findAll).mockResolvedValue({ items: [], total: 0 });
        service = new EventLocationService(
            { logger: createLoggerMock() } as unknown as ServiceConfig,
            model as StandardModelMock as unknown as EventLocationModel
        );
    });

    it('projects { id, label, slug } with label = placeName', async () => {
        asMock(model.findAll).mockResolvedValueOnce({ items: [rowWithPlaceName], total: 1 });
        const result = await service.findOptions(panelOnlyActor, {});
        expect(result.error).toBeUndefined();
        expect(result.data?.items).toEqual([
            { id: 'loc-draft-1', label: 'Teatro Municipal', slug: 'teatro-municipal' }
        ]);
    });

    it('falls back to slug for label when placeName is null', async () => {
        asMock(model.findAll).mockResolvedValueOnce({ items: [rowWithoutPlaceName], total: 1 });
        const result = await service.findOptions(panelOnlyActor, {});
        expect(result.data?.items[0]).toEqual({
            id: 'loc-2',
            label: 'sala-sin-nombre',
            slug: 'sala-sin-nombre'
        });
    });

    it('is DRAFT-inclusive: a DRAFT row is returned (no publication-state filter)', async () => {
        asMock(model.findAll).mockResolvedValueOnce({ items: [rowWithPlaceName], total: 1 });
        const result = await service.findOptions(panelOnlyActor, {});
        expect(result.data?.items.map((i) => i.id)).toContain('loc-draft-1');
    });

    it('defaults limit to 20 when not provided', async () => {
        await service.findOptions(panelOnlyActor, {});
        const [, options] = asMock(model.findAll).mock.calls[0] as [unknown, { pageSize?: number }];
        expect(options.pageSize).toBe(20);
    });

    it('is FORBIDDEN for an actor without admin-panel access', async () => {
        const result = await service.findOptions(noAccessActor, {});
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.findAll).not.toHaveBeenCalled();
    });
});
