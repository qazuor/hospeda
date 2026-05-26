import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationReviewService } from '../../src/services/accommodationReview/accommodationReview.service';
import { DestinationReviewService } from '../../src/services/destinationReview/destinationReview.service';
import { EventService } from '../../src/services/event/event.service';
import { PostService } from '../../src/services/post/post.service';
import type { Actor, ServiceConfig } from '../../src/types';

/**
 * Regression tests for WHERE-clause leak bug.
 *
 * Bug: `_executeSearch` and `_executeCount` were forwarding pagination (`page`,
 * `pageSize`) and sort (`sortBy`, `sortOrder`) keys to the model's WHERE clause,
 * which caused `buildWhereClause` in @repo/db to either warn (if other valid
 * columns existed) or throw `DbError` ("All N key(s) in where clause were
 * unknown columns"). This broke public endpoints: GET /api/v1/public/posts,
 * GET /api/v1/public/stats, and several review listings.
 *
 * These tests lock in that no pagination/sort key leaks into the first argument
 * of `model.findAll` or `model.count`.
 */

const FORBIDDEN_WHERE_KEYS = ['page', 'pageSize', 'sortBy', 'sortOrder'] as const;

function makeActor(): Actor {
    return {
        id: 'test-user',
        type: 'user',
        role: RoleEnum.USER,
        permissions: []
    } as unknown as Actor;
}

function emptyContext(): ServiceConfig {
    return {} as ServiceConfig;
}

function expectNoForbiddenKeys(whereArg: Record<string, unknown>): void {
    for (const key of FORBIDDEN_WHERE_KEYS) {
        expect(whereArg).not.toHaveProperty(key);
    }
}

class MockModel {
    findAll = vi.fn().mockResolvedValue({ items: [], total: 0 });
    // Post/Event _executeSearch load relations via findAllWithRelations.
    // Signature: (relations, where, pagination, additionalConditions).
    findAllWithRelations = vi.fn().mockResolvedValue({ items: [], total: 0 });
    count = vi.fn().mockResolvedValue([{ count: 0 }]);
}

/**
 * Overrides the internal `model` of a constructed service with the given mock,
 * regardless of whether the service accepts a model via constructor.
 */
function injectMockModel<T extends object>(service: T, model: MockModel): T {
    (service as unknown as { model: unknown }).model = model;
    return service;
}

describe('Service-layer WHERE-clause leak regression', () => {
    let actor: Actor;

    beforeEach(() => {
        actor = makeActor();
    });

    describe('PostService', () => {
        let service: PostService;
        let model: MockModel;

        beforeEach(() => {
            model = new MockModel();
            service = injectMockModel(new PostService(emptyContext()), model);
        });

        it('_executeSearch does not leak page/pageSize/sortBy/sortOrder into WHERE', async () => {
            // SPEC-088 stripped pagination from the search params and republishes
            // it via ctx.pagination. The hook reads from ctx, not from params,
            // so we set both: params still contain the leaked keys (proving the
            // hook strips them), and ctx carries the caller-provided pagination.
            await (
                service as unknown as {
                    _executeSearch: (p: unknown, a: Actor, c: unknown) => Promise<unknown>;
                }
            )._executeSearch(
                { page: 1, pageSize: 4, sortBy: 'publishedAt', sortOrder: 'desc' },
                actor,
                { pagination: { page: 1, pageSize: 4, sortBy: 'publishedAt', sortOrder: 'desc' } }
            );

            // PostService loads relations: findAllWithRelations(relations, where, pagination, ...)
            expect(model.findAllWithRelations).toHaveBeenCalledOnce();
            const call = model.findAllWithRelations.mock.calls[0] ?? [];
            expectNoForbiddenKeys(call[1] as Record<string, unknown>);
            expect(call[2]).toMatchObject({ page: 1, pageSize: 4 });
        });

        it('_executeCount does not leak page/pageSize/sortBy/sortOrder into WHERE', async () => {
            await (
                service as unknown as {
                    _executeCount: (p: unknown, a: Actor, c: unknown) => Promise<unknown>;
                }
            )._executeCount(
                { page: 1, pageSize: 1, sortBy: 'publishedAt', sortOrder: 'asc' },
                actor,
                {}
            );

            expect(model.count).toHaveBeenCalledOnce();
            const [whereArg] = model.count.mock.calls[0] ?? [];
            expectNoForbiddenKeys(whereArg as Record<string, unknown>);
        });
    });

    describe('EventService', () => {
        let service: EventService;
        let model: MockModel;

        beforeEach(() => {
            model = new MockModel();
            service = injectMockModel(new EventService(emptyContext()), model);
        });

        it('_executeSearch does not leak page/pageSize/sortBy/sortOrder into WHERE', async () => {
            await (
                service as unknown as {
                    _executeSearch: (p: unknown, a: Actor, c: unknown) => Promise<unknown>;
                }
            )._executeSearch(
                { page: 1, pageSize: 6, sortBy: 'createdAt', sortOrder: 'desc' },
                actor,
                { pagination: { page: 1, pageSize: 6, sortBy: 'createdAt', sortOrder: 'desc' } }
            );

            // EventService loads relations: findAllWithRelations(relations, where, pagination, ...)
            expect(model.findAllWithRelations).toHaveBeenCalledOnce();
            const call = model.findAllWithRelations.mock.calls[0] ?? [];
            expectNoForbiddenKeys(call[1] as Record<string, unknown>);
            expect(call[2]).toMatchObject({ page: 1, pageSize: 6 });
        });

        it('_executeCount does not leak page/pageSize/sortBy/sortOrder into WHERE', async () => {
            await (
                service as unknown as {
                    _executeCount: (p: unknown, a: Actor, c: unknown) => Promise<unknown>;
                }
            )._executeCount({ page: 1, pageSize: 1, sortOrder: 'asc' }, actor, {});

            expect(model.count).toHaveBeenCalledOnce();
            const [whereArg] = model.count.mock.calls[0] ?? [];
            expectNoForbiddenKeys(whereArg as Record<string, unknown>);
        });
    });

    describe('AccommodationReviewService', () => {
        let service: AccommodationReviewService;
        let model: MockModel;

        beforeEach(() => {
            model = new MockModel();
            service = injectMockModel(new AccommodationReviewService(emptyContext()), model);
        });

        it('_executeSearch does not leak sortBy/sortOrder into WHERE', async () => {
            await (
                service as unknown as {
                    _executeSearch: (p: unknown, a: Actor, c: unknown) => Promise<unknown>;
                }
            )._executeSearch(
                { page: 1, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' },
                actor,
                {}
            );

            expect(model.findAll).toHaveBeenCalledOnce();
            const [whereArg] = model.findAll.mock.calls[0] ?? [];
            expectNoForbiddenKeys(whereArg as Record<string, unknown>);
            expect((whereArg as Record<string, unknown>).deletedAt).toBeNull();
        });

        it('_executeCount does not leak sortBy/sortOrder into WHERE', async () => {
            await (
                service as unknown as {
                    _executeCount: (p: unknown, a: Actor, c: unknown) => Promise<unknown>;
                }
            )._executeCount({ page: 1, pageSize: 1, sortOrder: 'asc' }, actor, {});

            expect(model.count).toHaveBeenCalledOnce();
            const [whereArg] = model.count.mock.calls[0] ?? [];
            expectNoForbiddenKeys(whereArg as Record<string, unknown>);
            expect((whereArg as Record<string, unknown>).deletedAt).toBeNull();
        });
    });

    describe('DestinationReviewService', () => {
        let service: DestinationReviewService;
        let model: MockModel;

        beforeEach(() => {
            model = new MockModel();
            service = injectMockModel(new DestinationReviewService(emptyContext()), model);
        });

        it('_executeSearch does not leak sortBy/sortOrder into WHERE', async () => {
            await (
                service as unknown as {
                    _executeSearch: (p: unknown, a: Actor, c: unknown) => Promise<unknown>;
                }
            )._executeSearch(
                { page: 1, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' },
                actor,
                {}
            );

            expect(model.findAll).toHaveBeenCalledOnce();
            const [whereArg] = model.findAll.mock.calls[0] ?? [];
            expectNoForbiddenKeys(whereArg as Record<string, unknown>);
            expect((whereArg as Record<string, unknown>).deletedAt).toBeNull();
        });

        it('_executeCount does not leak sortBy/sortOrder into WHERE', async () => {
            await (
                service as unknown as {
                    _executeCount: (p: unknown, a: Actor, c: unknown) => Promise<unknown>;
                }
            )._executeCount({ page: 1, pageSize: 1, sortOrder: 'asc' }, actor, {});

            expect(model.count).toHaveBeenCalledOnce();
            const [whereArg] = model.count.mock.calls[0] ?? [];
            expectNoForbiddenKeys(whereArg as Record<string, unknown>);
            expect((whereArg as Record<string, unknown>).deletedAt).toBeNull();
        });
    });
});
