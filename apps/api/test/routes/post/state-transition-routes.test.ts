/**
 * Unit tests for the dedicated post state-transition routes — HOS-374 §7.6.4.
 *
 * Two things are checked, and the second is the one that matters:
 *  1. Each handler forwards exactly the parsed body field to its service method.
 *  2. Each route DECLARES the same permission its service method checks. A route
 *     whose `requiredPermissions` drifts from the service gate is the failure
 *     shape SPEC-166 warns about: it reads as protected while admitting actors
 *     the service then has to refuse (or worse, does not).
 *
 * Pattern (copied from the SPEC-166 review-moderation route test): mock the
 * route factories to capture the raw config, then invoke the handler directly —
 * no Hono app, no middleware chain.
 *
 * @module test/routes/post/state-transition-routes
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CapturedConfig = {
    path: string;
    requiredPermissions?: unknown[];
    handler: (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>;
};

const { capturedConfigs } = vi.hoisted(() => ({
    capturedConfigs: new Map<string, CapturedConfig>()
}));

const { mockModerate, mockSetPublishState, mockSetLifecycleState } = vi.hoisted(() => ({
    mockModerate: vi.fn(),
    mockSetPublishState: vi.fn(),
    mockSetLifecycleState: vi.fn()
}));

vi.mock('../../../src/utils/route-factory', () => {
    const capture = (prefix: string) => (config: CapturedConfig) => {
        capturedConfigs.set(`${prefix} ${config.path}`, config);
        return config.handler;
    };
    return {
        createAdminRoute: vi.fn(capture('admin')),
        createProtectedRoute: vi.fn(capture('protected'))
    };
});

vi.mock('../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    PostService: vi.fn(function () {
        return {
            moderate: mockModerate,
            setPublishState: mockSetPublishState,
            setLifecycleState: mockSetLifecycleState
        };
    }),
    ServiceError: class ServiceError extends Error {
        constructor(
            public readonly code: string,
            message: string
        ) {
            super(message);
            this.name = 'ServiceError';
        }
    }
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../src/utils/actor';

await import('../../../src/routes/post/admin/moderate');
await import('../../../src/routes/post/admin/publishState');
await import('../../../src/routes/post/admin/lifecycleState');
await import('../../../src/routes/post/protected/publishState');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

const POST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const ACTOR: Actor = {
    id: 'actor-id',
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.POST_MODERATION_CHANGE]
};

const buildMockContext = (): Context =>
    ({ get: vi.fn(), set: vi.fn(), json: vi.fn() }) as unknown as Context;

const getConfig = (key: string): CapturedConfig => {
    const config = capturedConfigs.get(key);
    if (!config) {
        throw new Error(`No route captured for: ${key}`);
    }
    return config;
};

describe('post state-transition routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('the declared permission matches the service gate', () => {
        it('admin moderate declares POST_MODERATION_CHANGE', () => {
            expect(getConfig('admin /{id}/moderate').requiredPermissions).toEqual([
                PermissionEnum.POST_MODERATION_CHANGE
            ]);
        });

        it('admin publish-state declares POST_PUBLISH_TOGGLE', () => {
            expect(getConfig('admin /{id}/publish-state').requiredPermissions).toEqual([
                PermissionEnum.POST_PUBLISH_TOGGLE
            ]);
        });

        it('admin lifecycle-state declares POST_LIFECYCLE_CHANGE', () => {
            expect(getConfig('admin /{id}/lifecycle-state').requiredPermissions).toEqual([
                PermissionEnum.POST_LIFECYCLE_CHANGE
            ]);
        });

        it('protected publish-state declares no route permission — the author rule needs the post', () => {
            // POST_PUBLISH_OWN only authorizes on a post the actor authored, which
            // the middleware cannot know. Declaring it here would let any holder
            // through on ANY post if the service check were ever relaxed.
            expect(getConfig('protected /{id}/publish-state').requiredPermissions).toBeUndefined();
        });
    });

    describe('admin moderate', () => {
        it('forwards the moderation state to the service', async () => {
            mockModerate.mockResolvedValue({ data: { id: POST_ID } });

            await getConfig('admin /{id}/moderate').handler(
                buildMockContext(),
                { id: POST_ID },
                { moderationState: ModerationStatusEnum.APPROVED }
            );

            expect(mockModerate).toHaveBeenCalledOnce();
            expect(mockModerate.mock.calls[0]?.[0]).toEqual({
                actor: ACTOR,
                id: POST_ID,
                moderationState: ModerationStatusEnum.APPROVED
            });
        });

        it('rejects a body carrying a second state field', async () => {
            // The whole reason these routes exist: no transition may smuggle a
            // sibling state change. Zod strips the extra key, so the service is
            // called with the moderation field alone.
            mockModerate.mockResolvedValue({ data: { id: POST_ID } });

            await getConfig('admin /{id}/moderate').handler(
                buildMockContext(),
                { id: POST_ID },
                {
                    moderationState: ModerationStatusEnum.APPROVED,
                    visibility: VisibilityEnum.PUBLIC
                }
            );

            expect(mockModerate.mock.calls[0]?.[0]).not.toHaveProperty('visibility');
        });

        it('throws when moderationState is missing', async () => {
            await expect(
                getConfig('admin /{id}/moderate').handler(buildMockContext(), { id: POST_ID }, {})
            ).rejects.toThrow();
        });

        it('surfaces a service FORBIDDEN as a thrown ServiceError', async () => {
            mockModerate.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Forbidden: missing post.moderation.change'
                }
            });

            await expect(
                getConfig('admin /{id}/moderate').handler(
                    buildMockContext(),
                    { id: POST_ID },
                    { moderationState: ModerationStatusEnum.APPROVED }
                )
            ).rejects.toThrow(/moderation/);
        });
    });

    describe('admin publish-state', () => {
        it('forwards the visibility to the service', async () => {
            mockSetPublishState.mockResolvedValue({ data: { id: POST_ID } });

            await getConfig('admin /{id}/publish-state').handler(
                buildMockContext(),
                { id: POST_ID },
                { visibility: VisibilityEnum.PRIVATE }
            );

            expect(mockSetPublishState.mock.calls[0]?.[0]).toEqual({
                actor: ACTOR,
                id: POST_ID,
                visibility: VisibilityEnum.PRIVATE
            });
        });

        it('throws on an unknown visibility value', async () => {
            await expect(
                getConfig('admin /{id}/publish-state').handler(
                    buildMockContext(),
                    { id: POST_ID },
                    { visibility: 'SEMI_PUBLIC' }
                )
            ).rejects.toThrow();
        });
    });

    describe('admin lifecycle-state', () => {
        it('forwards the lifecycle state to the service', async () => {
            mockSetLifecycleState.mockResolvedValue({ data: { id: POST_ID } });

            await getConfig('admin /{id}/lifecycle-state').handler(
                buildMockContext(),
                { id: POST_ID },
                { lifecycleState: LifecycleStatusEnum.ARCHIVED }
            );

            expect(mockSetLifecycleState.mock.calls[0]?.[0]).toEqual({
                actor: ACTOR,
                id: POST_ID,
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            });
        });
    });

    describe('protected publish-state', () => {
        it('forwards the visibility and the acting author to the service', async () => {
            mockSetPublishState.mockResolvedValue({ data: { id: POST_ID } });

            await getConfig('protected /{id}/publish-state').handler(
                buildMockContext(),
                { id: POST_ID },
                { visibility: VisibilityEnum.PRIVATE }
            );

            expect(mockSetPublishState.mock.calls[0]?.[0]).toEqual({
                actor: ACTOR,
                id: POST_ID,
                visibility: VisibilityEnum.PRIVATE
            });
        });

        it('surfaces the service FORBIDDEN for a non-author', async () => {
            mockSetPublishState.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message: 'Forbidden: cannot change post publication state'
                }
            });

            await expect(
                getConfig('protected /{id}/publish-state').handler(
                    buildMockContext(),
                    { id: POST_ID },
                    { visibility: VisibilityEnum.PUBLIC }
                )
            ).rejects.toThrow(/publication state/);
        });
    });
});
