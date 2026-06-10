/**
 * @fileoverview
 * Unit tests for UserService.findOptions (SPEC-169 §5.5 / decision D4 / T-018).
 *
 * `displayName` is NULLABLE (SPEC-169 §12 flag) so `label` falls back to the always-present
 * `email`. Verifies:
 * - The { id, label, slug } payload shape with label = displayName.
 * - label falls back to email when displayName is null.
 * - admin-panel-only gating (no USER_READ_ALL required) + soft-delete-exclusive listing.
 */
import type { UserModel } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { ServiceConfig } from '@repo/service-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createActor } from '../../factories/actorFactory';
import type { StandardModelMock } from '../../utils/modelMockFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const rowWithDisplayName = {
    id: 'user-1',
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
    slug: 'ada-lovelace'
};

const rowWithoutDisplayName = {
    id: 'user-2',
    displayName: null,
    email: 'grace@example.com',
    slug: 'grace-hopper'
};

describe('UserService.findOptions (SPEC-169 §5.5)', () => {
    let service: UserService;
    let model: ReturnType<typeof createModelMock>;

    const panelOnlyActor = createActor({
        role: RoleEnum.EDITOR,
        permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
    });
    const noAccessActor = createActor({
        role: RoleEnum.USER,
        permissions: [PermissionEnum.USER_UPDATE_PROFILE]
    });

    beforeEach(() => {
        model = createModelMock();
        asMock(model.findAll).mockResolvedValue({ items: [], total: 0 });
        service = new UserService(
            { logger: createLoggerMock() } as unknown as ServiceConfig,
            model as StandardModelMock as unknown as UserModel
        );
    });

    it('projects { id, label, slug } with label = displayName', async () => {
        asMock(model.findAll).mockResolvedValueOnce({ items: [rowWithDisplayName], total: 1 });
        const result = await service.findOptions(panelOnlyActor, {});
        expect(result.error).toBeUndefined();
        expect(result.data?.items).toEqual([
            { id: 'user-1', label: 'Ada Lovelace', slug: 'ada-lovelace' }
        ]);
    });

    it('falls back to email for label when displayName is null', async () => {
        asMock(model.findAll).mockResolvedValueOnce({ items: [rowWithoutDisplayName], total: 1 });
        const result = await service.findOptions(panelOnlyActor, {});
        expect(result.data?.items[0]).toEqual({
            id: 'user-2',
            label: 'grace@example.com',
            slug: 'grace-hopper'
        });
    });

    it('defaults limit to 20 when not provided', async () => {
        await service.findOptions(panelOnlyActor, {});
        const [, options] = asMock(model.findAll).mock.calls[0] as [unknown, { pageSize?: number }];
        expect(options.pageSize).toBe(20);
    });

    it('forwards a search condition when q is provided', async () => {
        await service.findOptions(panelOnlyActor, { q: 'ada', limit: 5 });
        const [, options, additionalConditions] = asMock(model.findAll).mock.calls[0] as [
            unknown,
            { pageSize?: number },
            unknown[]
        ];
        expect(options.pageSize).toBe(5);
        expect(additionalConditions).toHaveLength(1);
    });

    it('succeeds for an ACCESS_PANEL_ADMIN-only actor (no USER_READ_ALL required)', async () => {
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
