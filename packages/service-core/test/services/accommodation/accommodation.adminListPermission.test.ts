/**
 * @fileoverview
 * Test suite for the AccommodationService._canAdminList() override.
 * Covers:
 * - Rejection of actors without admin access (from base class)
 * - Rejection of actors with admin access but without ACCOMMODATION_VIEW_ALL
 * - Acceptance of actors with both admin access and ACCOMMODATION_VIEW_ALL
 * - Correct call order (super._canAdminList before checkCanAdminList)
 * - checkCanAdminList NOT called when super._canAdminList rejects
 */
import type { AccommodationModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as accommodationPermissions from '../../../src/services/accommodation/accommodation.permissions';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { Actor } from '../../../src/types';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

type CanAdminListAccessor = { _canAdminList: (actor: Actor) => Promise<void> };

const mockLogger = createLoggerMock();

describe('AccommodationService._canAdminList()', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createModelMock>;

    beforeEach(() => {
        model = createModelMock();
        service = new AccommodationService(
            { logger: mockLogger },
            model as unknown as AccommodationModel
        );
        vi.restoreAllMocks();
    });

    it('rejects actor without admin access permissions', async () => {
        const actor = new ActorFactoryBuilder()
            .withId('no-admin-1')
            .withPermissions([PermissionEnum.ACCOMMODATION_VIEW_ALL])
            .build();

        await expect(
            (service as unknown as CanAdminListAccessor)._canAdminList(actor)
        ).rejects.toThrow(
            expect.objectContaining({
                code: ServiceErrorCode.FORBIDDEN,
                message: 'Admin access required for admin list operations'
            })
        );
    });

    it('rejects actor with admin access but without ACCOMMODATION_VIEW_ALL', async () => {
        const actor = new ActorFactoryBuilder()
            .withId('admin-no-entity-1')
            .withPermissions([PermissionEnum.ACCESS_PANEL_ADMIN])
            .build();

        await expect(
            (service as unknown as CanAdminListAccessor)._canAdminList(actor)
        ).rejects.toThrow(
            expect.objectContaining({
                code: ServiceErrorCode.FORBIDDEN,
                message: 'Permission denied: ACCOMMODATION_VIEW_ALL required for admin list'
            })
        );
    });

    it('allows actor with admin access AND ACCOMMODATION_VIEW_ALL', async () => {
        const actor = new ActorFactoryBuilder()
            .withId('admin-with-entity-1')
            .withPermissions([
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCOMMODATION_VIEW_ALL
            ])
            .build();

        await expect(
            (service as unknown as CanAdminListAccessor)._canAdminList(actor)
        ).resolves.toBeUndefined();
    });

    it('calls super._canAdminList() before checkCanAdminList()', async () => {
        const callOrder: string[] = [];

        const superSpy = vi
            .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), '_canAdminList')
            .mockImplementation(() => {
                callOrder.push('super._canAdminList');
            });

        const checkSpy = vi
            .spyOn(accommodationPermissions, 'checkCanAdminList')
            .mockImplementation(() => {
                callOrder.push('checkCanAdminList');
            });

        const actor = new ActorFactoryBuilder()
            .withId('admin-1')
            .withPermissions([
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCOMMODATION_VIEW_ALL
            ])
            .build();

        await (service as unknown as CanAdminListAccessor)._canAdminList(actor);

        expect(callOrder).toEqual(['super._canAdminList', 'checkCanAdminList']);

        superSpy.mockRestore();
        checkSpy.mockRestore();
    });

    it('does not call checkCanAdminList when super._canAdminList rejects', async () => {
        const checkSpy = vi.spyOn(accommodationPermissions, 'checkCanAdminList');

        const actorNoAdmin = new ActorFactoryBuilder()
            .withId('no-admin')
            .withPermissions([PermissionEnum.ACCOMMODATION_VIEW_ALL])
            .build();

        await expect(
            (service as unknown as CanAdminListAccessor)._canAdminList(actorNoAdmin)
        ).rejects.toThrow();

        expect(checkSpy).not.toHaveBeenCalled();
        checkSpy.mockRestore();
    });
});
