/**
 * Unit tests for OwnerPromotionService lifecycle enforcement.
 *
 * Scope: AC-005-01 strict enforcement — public search/count must always
 * filter by `lifecycleState = ACTIVE`, overriding any caller-supplied value
 * to prevent DRAFT/ARCHIVED leakage via query-param manipulation.
 *
 * Pattern: direct invocation of protected `_executeSearch`/`_executeCount`
 * via type-cast, bypassing permission/hook pipeline. The overridden filter
 * is captured through the mocked model so we can assert its exact shape.
 */

import { LifecycleStatusEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerPromotionService } from '../../../src/services/owner-promotion/ownerPromotion.service';
import type { Actor, ServiceConfig, ServiceContext } from '../../../src/types';

class MockOwnerPromotionModel {
    findAll = vi.fn();
    count = vi.fn();
    findById = vi.fn();
    findOne = vi.fn();
    create = vi.fn();
    update = vi.fn();
    softDelete = vi.fn();
    restore = vi.fn();
    hardDelete = vi.fn();
}

describe('OwnerPromotionService — AC-005-01 lifecycle enforcement', () => {
    let service: OwnerPromotionService;
    let mockModel: MockOwnerPromotionModel;
    let actor: Actor;
    const ctx: ServiceContext = {} as ServiceContext;

    beforeEach(() => {
        mockModel = new MockOwnerPromotionModel();
        actor = {
            id: 'test-actor',
            type: 'user',
            role: RoleEnum.USER,
            permissions: []
        } as Actor;
        service = new OwnerPromotionService({
            model: mockModel as never
        } as ServiceConfig & { model?: never });
    });

    describe('_executeSearch', () => {
        it('forces lifecycleState=ACTIVE when caller omits the filter', async () => {
            // Arrange
            mockModel.findAll.mockResolvedValue({
                data: [],
                pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
            });

            // Act
            await (
                service as never as {
                    _executeSearch: (
                        params: Record<string, unknown>,
                        actor: Actor,
                        ctx: ServiceContext
                    ) => Promise<unknown>;
                }
            )._executeSearch({ page: 1, limit: 20 }, actor, ctx);

            // Assert
            expect(mockModel.findAll).toHaveBeenCalledOnce();
            const [filterParams] = mockModel.findAll.mock.calls[0] as [Record<string, unknown>];
            expect(filterParams.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        });

        it('overrides caller-supplied lifecycleState=DRAFT to ACTIVE (security)', async () => {
            // Arrange
            mockModel.findAll.mockResolvedValue({
                data: [],
                pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
            });

            // Act — attacker injects DRAFT via query manipulation
            await (
                service as never as {
                    _executeSearch: (
                        params: Record<string, unknown>,
                        actor: Actor,
                        ctx: ServiceContext
                    ) => Promise<unknown>;
                }
            )._executeSearch(
                { page: 1, limit: 20, lifecycleState: LifecycleStatusEnum.DRAFT },
                actor,
                ctx
            );

            // Assert — service must force-override to ACTIVE
            expect(mockModel.findAll).toHaveBeenCalledOnce();
            const [filterParams] = mockModel.findAll.mock.calls[0] as [Record<string, unknown>];
            expect(filterParams.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        });

        it('overrides caller-supplied lifecycleState=ARCHIVED to ACTIVE (security)', async () => {
            // Arrange
            mockModel.findAll.mockResolvedValue({
                data: [],
                pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
            });

            // Act
            await (
                service as never as {
                    _executeSearch: (
                        params: Record<string, unknown>,
                        actor: Actor,
                        ctx: ServiceContext
                    ) => Promise<unknown>;
                }
            )._executeSearch(
                { page: 1, limit: 20, lifecycleState: LifecycleStatusEnum.ARCHIVED },
                actor,
                ctx
            );

            // Assert
            expect(mockModel.findAll).toHaveBeenCalledOnce();
            const [filterParams] = mockModel.findAll.mock.calls[0] as [Record<string, unknown>];
            expect(filterParams.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        });
    });

    describe('_executeCount', () => {
        it('forces lifecycleState=ACTIVE when caller omits the filter', async () => {
            // Arrange
            mockModel.count.mockResolvedValue(7);

            // Act
            const result = await (
                service as never as {
                    _executeCount: (
                        params: Record<string, unknown>,
                        actor: Actor,
                        ctx: ServiceContext
                    ) => Promise<{ count: number }>;
                }
            )._executeCount({ page: 1, limit: 20 }, actor, ctx);

            // Assert
            expect(result).toEqual({ count: 7 });
            expect(mockModel.count).toHaveBeenCalledOnce();
            const [filterParams] = mockModel.count.mock.calls[0] as [Record<string, unknown>];
            expect(filterParams.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        });

        it('overrides caller-supplied lifecycleState=DRAFT to ACTIVE (consistency)', async () => {
            // Arrange
            mockModel.count.mockResolvedValue(3);

            // Act — ensures pagination `total` matches _executeSearch items
            await (
                service as never as {
                    _executeCount: (
                        params: Record<string, unknown>,
                        actor: Actor,
                        ctx: ServiceContext
                    ) => Promise<{ count: number }>;
                }
            )._executeCount(
                { page: 1, limit: 20, lifecycleState: LifecycleStatusEnum.DRAFT },
                actor,
                ctx
            );

            // Assert
            expect(mockModel.count).toHaveBeenCalledOnce();
            const [filterParams] = mockModel.count.mock.calls[0] as [Record<string, unknown>];
            expect(filterParams.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        });
    });
});
