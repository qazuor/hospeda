/**
 * @fileoverview
 * Test suite for the `_canAdminList` permission hook in BaseCrudPermissions.
 * Covers:
 * - Rejection of actors without admin access permissions
 * - Acceptance of actors with ACCESS_PANEL_ADMIN
 * - Acceptance of actors with ACCESS_API_ADMIN
 * - Acceptance of actors with both admin permissions
 * - Delegation to _canList() after admin check passes
 * - Error propagation when _canList() throws
 */
import type { BaseModel as BaseModelDB } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../../src/types';
import { ServiceError } from '../../../src/types';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createBaseModelMock } from '../../utils/modelMockFactory';
import { type TestEntity, TestService } from '../base/base.service.test.setup';

type CanAdminListAccessor = { _canAdminList: (actor: Actor) => Promise<void> | void };

describe('BaseCrudPermissions._canAdminList()', () => {
    let service: TestService;
    let modelMock: BaseModelDB<TestEntity>;

    beforeEach(() => {
        modelMock = createBaseModelMock<TestEntity>();
        service = createServiceTestInstance(TestService, modelMock);
        vi.restoreAllMocks();
    });

    it('rejects actor without admin access permissions', () => {
        const actor = new ActorFactoryBuilder()
            .withId('non-admin-1')
            .withPermissions([PermissionEnum.ACCOMMODATION_VIEW_ALL])
            .build();

        expect(() => {
            (service as unknown as CanAdminListAccessor)._canAdminList(actor);
        }).toThrow(ServiceError);

        try {
            (service as unknown as CanAdminListAccessor)._canAdminList(actor);
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                expect(err.message).toMatch('Admin access required for admin list operations');
            }
        }
    });

    it('allows actor with ACCESS_PANEL_ADMIN', () => {
        const actor = new ActorFactoryBuilder()
            .withId('panel-admin-1')
            .withPermissions([PermissionEnum.ACCESS_PANEL_ADMIN])
            .build();

        expect(() => {
            (service as unknown as CanAdminListAccessor)._canAdminList(actor);
        }).not.toThrow();
    });

    it('allows actor with ACCESS_API_ADMIN', () => {
        const actor = new ActorFactoryBuilder()
            .withId('api-admin-1')
            .withPermissions([PermissionEnum.ACCESS_API_ADMIN])
            .build();

        expect(() => {
            (service as unknown as CanAdminListAccessor)._canAdminList(actor);
        }).not.toThrow();
    });

    it('allows actor with BOTH admin permissions', () => {
        const actor = new ActorFactoryBuilder()
            .withId('full-admin-1')
            .withPermissions([PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.ACCESS_API_ADMIN])
            .build();

        expect(() => {
            (service as unknown as CanAdminListAccessor)._canAdminList(actor);
        }).not.toThrow();
    });

    it('delegates to _canList() after admin check passes', () => {
        const actor = new ActorFactoryBuilder()
            .withId('panel-admin-1')
            .withPermissions([PermissionEnum.ACCESS_PANEL_ADMIN])
            .build();

        const canListSpy = vi.spyOn(Object.getPrototypeOf(service), '_canList');

        (service as unknown as CanAdminListAccessor)._canAdminList(actor);

        expect(canListSpy).toHaveBeenCalledWith(actor);
        canListSpy.mockRestore();
    });

    it('propagates error when _canList() throws after admin check passes', () => {
        const actor = new ActorFactoryBuilder()
            .withId('panel-admin-1')
            .withPermissions([PermissionEnum.ACCESS_PANEL_ADMIN])
            .build();

        const canListSpy = vi
            .spyOn(Object.getPrototypeOf(service), '_canList')
            .mockImplementation(() => {
                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'Entity-specific list check failed'
                );
            });

        expect(() => {
            (service as unknown as CanAdminListAccessor)._canAdminList(actor);
        }).toThrow(ServiceError);

        try {
            (service as unknown as CanAdminListAccessor)._canAdminList(actor);
        } catch (err) {
            expect(err).toBeInstanceOf(ServiceError);
            if (err instanceof ServiceError) {
                expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
                expect(err.message).toMatch('Entity-specific list check failed');
            }
        }

        canListSpy.mockRestore();
    });
});
