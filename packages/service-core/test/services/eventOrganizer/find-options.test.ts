/**
 * @fileoverview
 * Unit tests for EventOrganizerService.findOptions (SPEC-169 §5.5 / decision D4 / T-018).
 *
 * Verifies the { id, label, slug } payload shape (label = organizer name), admin-panel-only
 * gating, DRAFT-inclusivity, and that the search term is forwarded to the model.
 */
import type { EventOrganizerModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { ServiceConfig } from '@repo/service-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventOrganizerService } from '../../../src/services/eventOrganizer/eventOrganizer.service';
import { createActor } from '../../factories/actorFactory';
import type { StandardModelMock } from '../../utils/modelMockFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const draftRow = {
    id: 'org-draft-1',
    name: 'Municipalidad de C. del Uruguay',
    slug: 'municipalidad-cdu',
    lifecycleState: 'DRAFT'
};

describe('EventOrganizerService.findOptions (SPEC-169 §5.5)', () => {
    let service: EventOrganizerService;
    let model: ReturnType<typeof createModelMock>;

    const panelOnlyActor = createActor({
        role: RoleEnum.EDITOR,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
    });
    const noAccessActor = createActor({
        role: RoleEnum.USER,
        permissions: [PermissionEnum.EVENT_ORGANIZER_VIEW]
    });

    beforeEach(() => {
        model = createModelMock();
        asMock(model.findAll).mockResolvedValue({ items: [], total: 0 });
        service = new EventOrganizerService(
            { logger: createLoggerMock() } as unknown as ServiceConfig,
            model as StandardModelMock as unknown as EventOrganizerModel
        );
    });

    it('projects { id, label, slug } for a matched row', async () => {
        asMock(model.findAll).mockResolvedValueOnce({ items: [draftRow], total: 1 });
        const result = await service.findOptions(panelOnlyActor, {});
        expect(result.error).toBeUndefined();
        expect(result.data?.items).toEqual([
            {
                id: 'org-draft-1',
                label: 'Municipalidad de C. del Uruguay',
                slug: 'municipalidad-cdu'
            }
        ]);
    });

    it('is DRAFT-inclusive: a DRAFT row is returned (no publication-state filter)', async () => {
        asMock(model.findAll).mockResolvedValueOnce({ items: [draftRow], total: 1 });
        const result = await service.findOptions(panelOnlyActor, {});
        expect(result.data?.items.map((i) => i.id)).toContain('org-draft-1');
    });

    it('defaults limit to 20 when not provided', async () => {
        await service.findOptions(panelOnlyActor, {});
        const [, options] = asMock(model.findAll).mock.calls[0] as [unknown, { pageSize?: number }];
        expect(options.pageSize).toBe(20);
    });

    it('forwards a search condition when q is provided', async () => {
        await service.findOptions(panelOnlyActor, { q: 'municipalidad', limit: 5 });
        const [, options, additionalConditions] = asMock(model.findAll).mock.calls[0] as [
            unknown,
            { pageSize?: number },
            unknown[]
        ];
        expect(options.pageSize).toBe(5);
        expect(additionalConditions).toHaveLength(1);
    });

    it('is FORBIDDEN for an actor without admin-panel access', async () => {
        const result = await service.findOptions(noAccessActor, {});
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.findAll).not.toHaveBeenCalled();
    });
});
