/**
 * @fileoverview
 * Test suite verifying the _canAdminList → _canList permission chain
 * for services that have permission-guarded _canList() implementations.
 *
 * These services require BOTH admin access AND entity-specific permissions
 * when calling adminList(). This test ensures the combined chain works.
 *
 * GAP-051-004: Tests for permission-guarded _canList through _canAdminList
 */
import type { BaseModel as BaseModelDB } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor, ServiceConfig } from '../../../src/types';
import { ServiceError } from '../../../src/types';
import { hasPermission } from '../../../src/utils/permission';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { createBaseModelMock } from '../../utils/modelMockFactory';
import { type TestEntity, TestService } from '../base/base.service.test.setup';

type CanAdminListAccessor = { _canAdminList: (actor: Actor) => Promise<void> | void };

/**
 * TestService with a permission-guarded _canList that requires a specific permission.
 */
class PermissionGuardedTestService extends TestService {
    private readonly requiredListPermission: PermissionEnum;

    constructor(
        ctx: ServiceConfig,
        model: BaseModelDB<TestEntity>,
        requiredPermission: PermissionEnum
    ) {
        super(ctx, model);
        this.requiredListPermission = requiredPermission;
    }

    protected _canList(actor: Actor): void {
        if (!hasPermission(actor, this.requiredListPermission)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                `Permission denied: ${this.requiredListPermission} required for list`
            );
        }
    }
}

describe('_canAdminList → _canList permission chain', () => {
    let modelMock: BaseModelDB<TestEntity>;

    beforeEach(() => {
        modelMock = createBaseModelMock<TestEntity>();
        vi.restoreAllMocks();
    });

    const testCases = [
        { name: 'SponsorshipLevel-like', permission: PermissionEnum.SPONSORSHIP_VIEW },
        { name: 'User-like', permission: PermissionEnum.USER_READ_ALL },
        { name: 'ExchangeRate-like', permission: PermissionEnum.EXCHANGE_RATE_VIEW }
    ];

    for (const tc of testCases) {
        describe(`${tc.name} service (requires ${tc.permission})`, () => {
            let service: PermissionGuardedTestService;

            beforeEach(() => {
                service = new PermissionGuardedTestService(
                    { logger: undefined },
                    modelMock,
                    tc.permission
                );
            });

            it('rejects admin WITHOUT entity-specific permission', () => {
                const actor = new ActorFactoryBuilder()
                    .withId('admin-no-entity-perm')
                    .withPermissions([PermissionEnum.ACCESS_PANEL_ADMIN])
                    .build();

                expect(() => {
                    (service as unknown as CanAdminListAccessor)._canAdminList(actor);
                }).toThrow(
                    expect.objectContaining({
                        code: ServiceErrorCode.FORBIDDEN
                    })
                );
            });

            it('rejects entity permission WITHOUT admin access', () => {
                const actor = new ActorFactoryBuilder()
                    .withId('entity-no-admin')
                    .withPermissions([tc.permission])
                    .build();

                expect(() => {
                    (service as unknown as CanAdminListAccessor)._canAdminList(actor);
                }).toThrow(
                    expect.objectContaining({
                        code: ServiceErrorCode.FORBIDDEN,
                        message: 'Admin access required for admin list operations'
                    })
                );
            });

            it('allows admin WITH entity-specific permission', () => {
                const actor = new ActorFactoryBuilder()
                    .withId('admin-with-entity-perm')
                    .withPermissions([PermissionEnum.ACCESS_PANEL_ADMIN, tc.permission])
                    .build();

                expect(() => {
                    (service as unknown as CanAdminListAccessor)._canAdminList(actor);
                }).not.toThrow();
            });
        });
    }
});
