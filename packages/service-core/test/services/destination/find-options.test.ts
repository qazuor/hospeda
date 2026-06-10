/**
 * @fileoverview
 * Unit tests for DestinationService.findOptions (SPEC-169 §5.5 / decision D4 / T-018).
 *
 * Verifies:
 * - The payload shape: { id, label, slug } where label = the destination name.
 * - Gating: admin-panel access ONLY. An ACCESS_PANEL_ADMIN actor with NO _VIEW_ALL/_VIEW_OWN
 *   succeeds; an actor without admin access is FORBIDDEN.
 * - DRAFT-inclusivity: the method delegates to the model's findAll, which only excludes
 *   soft-deleted rows (never publication state), so DRAFT entities are returned.
 */
import type { DestinationModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { ServiceConfig } from '@repo/service-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { createActor } from '../../factories/actorFactory';
import type { StandardModelMock } from '../../utils/modelMockFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const draftRow = {
    id: 'dest-draft-1',
    name: 'Concepcion del Uruguay',
    slug: 'concepcion-del-uruguay',
    lifecycleState: 'DRAFT'
};

describe('DestinationService.findOptions (SPEC-169 §5.5)', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createModelMock>;

    const panelOnlyActor = createActor({
        role: RoleEnum.EDITOR,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
    });
    const noAccessActor = createActor({
        role: RoleEnum.USER,
        permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE]
    });

    beforeEach(() => {
        model = createModelMock();
        asMock(model.findAll).mockResolvedValue({ items: [], total: 0 });
        service = new DestinationService(
            { logger: createLoggerMock() } as unknown as ServiceConfig,
            model as StandardModelMock as unknown as DestinationModel
        );
    });

    it('projects { id, label, slug } for a matched row', async () => {
        asMock(model.findAll).mockResolvedValueOnce({ items: [draftRow], total: 1 });
        const result = await service.findOptions(panelOnlyActor, {});
        expect(result.error).toBeUndefined();
        expect(result.data?.items).toEqual([
            { id: 'dest-draft-1', label: 'Concepcion del Uruguay', slug: 'concepcion-del-uruguay' }
        ]);
    });

    it('is DRAFT-inclusive: a DRAFT row is returned (no publication-state filter)', async () => {
        asMock(model.findAll).mockResolvedValueOnce({ items: [draftRow], total: 1 });
        const result = await service.findOptions(panelOnlyActor, {});
        expect(result.data?.items.map((i) => i.id)).toContain('dest-draft-1');
    });

    it('defaults limit to 20 when not provided', async () => {
        await service.findOptions(panelOnlyActor, {});
        const [, options] = asMock(model.findAll).mock.calls[0] as [unknown, { pageSize?: number }];
        expect(options.pageSize).toBe(20);
    });

    it('passes limit through to the model search', async () => {
        await service.findOptions(panelOnlyActor, { limit: 5 });
        const [, options] = asMock(model.findAll).mock.calls[0] as [unknown, { pageSize?: number }];
        expect(options.pageSize).toBe(5);
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
