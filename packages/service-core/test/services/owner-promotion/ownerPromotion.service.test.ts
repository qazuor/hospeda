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

import { LifecycleStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerPromotionService } from '../../../src/services/owner-promotion/ownerPromotion.service';
import type { Actor, ServiceConfig, ServiceContext } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import {
    createMockOwnerPromotion,
    createMockOwnerPromotionCreateInput
} from '../../factories/ownerPromotionFactory';

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

        // SPEC-167 T-004: plan-restricted promotions must not count toward the
        // MAX_ACTIVE_PROMOTIONS cap (a restricted promo is not active).
        it('always passes planRestricted=false so restricted promos do not count toward the cap', async () => {
            // Arrange
            mockModel.count.mockResolvedValue(2);

            // Act
            await (
                service as never as {
                    _executeCount: (
                        params: Record<string, unknown>,
                        actor: Actor,
                        ctx: ServiceContext
                    ) => Promise<{ count: number }>;
                }
            )._executeCount({ page: 1, pageSize: 20 }, actor, ctx);

            // Assert: planRestricted=false must be in the filter so restricted
            // promotions are never counted against the host's active-promo cap.
            expect(mockModel.count).toHaveBeenCalledOnce();
            const [filterParams] = mockModel.count.mock.calls[0] as [Record<string, unknown>];
            expect(filterParams.planRestricted).toBe(false);
        });
    });

    describe('_executeSearch — SPEC-167 T-004 plan-restricted exclusion', () => {
        it('always passes planRestricted=false so restricted promos are excluded from public reads', async () => {
            // Arrange
            mockModel.findAll.mockResolvedValue({
                items: [],
                total: 0
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
            )._executeSearch({ page: 1, pageSize: 20 }, actor, ctx);

            // Assert: plan-restricted items must be excluded from public search results.
            expect(mockModel.findAll).toHaveBeenCalledOnce();
            const [filterParams] = mockModel.findAll.mock.calls[0] as [Record<string, unknown>];
            expect(filterParams.planRestricted).toBe(false);
        });
    });
});

/**
 * Regression tests for bug #5 — slug generation via _beforeCreate hook.
 *
 * Before this fix, `slug` (NOT NULL, no DB default) was never populated on
 * create and every INSERT failed with a not-null constraint violation. The
 * `_beforeCreate` hook now derives a unique slug from `title` when the caller
 * does not supply one.
 */
describe('OwnerPromotionService — _beforeCreate slug generation (bug #5 regression)', () => {
    let service: OwnerPromotionService;
    let mockModel: MockOwnerPromotionModel;
    let actor: Actor;
    const ctx: ServiceContext = {} as ServiceContext;

    beforeEach(() => {
        mockModel = new MockOwnerPromotionModel();
        actor = createActor({ permissions: [PermissionEnum.OWNER_PROMOTION_CREATE] });
        service = new OwnerPromotionService({
            model: mockModel as never
        } as ServiceConfig & { model?: never });
    });

    it('derives a non-empty slug from the title when no slug is supplied', async () => {
        // Arrange — findOne returns null (slug does not exist yet), create returns the entity
        const input = createMockOwnerPromotionCreateInput({ title: 'Summer Deal' });
        // Remove slug so _beforeCreate must generate it
        const { slug: _slug, ...inputWithoutSlug } = input as typeof input & { slug?: string };
        const created = createMockOwnerPromotion({ title: 'Summer Deal', slug: 'summer-deal' });
        mockModel.findOne.mockResolvedValue(null); // slug uniqueness check → available
        mockModel.create.mockResolvedValue(created);

        // Act — call _beforeCreate directly to isolate the hook
        const processed = await (
            service as never as {
                _beforeCreate: (
                    data: Record<string, unknown>,
                    actor: Actor,
                    ctx: ServiceContext
                ) => Promise<Record<string, unknown>>;
            }
        )._beforeCreate(inputWithoutSlug as never, actor, ctx);

        // Assert — a slug was generated and is derived from the title
        expect(typeof processed.slug).toBe('string');
        expect((processed.slug as string).length).toBeGreaterThan(0);
        // "Summer Deal" → "summer-deal" (slugified)
        expect(processed.slug).toMatch(/summer[-_]?deal/i);
    });

    it('preserves an explicitly supplied slug unchanged', async () => {
        // Arrange — caller already provides a slug; hook must not overwrite it
        const input = createMockOwnerPromotionCreateInput({ title: 'Summer Deal' });
        const inputWithSlug = { ...input, slug: 'my-custom-slug' };
        // findOne would be called for uniqueness if we derived a new slug — it should NOT be
        // called at all when a slug is supplied
        mockModel.findOne.mockResolvedValue(null);

        // Act
        const processed = await (
            service as never as {
                _beforeCreate: (
                    data: Record<string, unknown>,
                    actor: Actor,
                    ctx: ServiceContext
                ) => Promise<Record<string, unknown>>;
            }
        )._beforeCreate(inputWithSlug as never, actor, ctx);

        // Assert — supplied slug is preserved as-is
        expect(processed.slug).toBe('my-custom-slug');
        // model.findOne should NOT have been called (no slug derivation needed)
        expect(mockModel.findOne).not.toHaveBeenCalled();
    });
});
