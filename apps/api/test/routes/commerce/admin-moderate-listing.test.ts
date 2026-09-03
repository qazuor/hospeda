/**
 * Unit tests for the admin moderate-LISTING routes — HOS-686 (AC-10).
 *
 * Both verticals in one file on purpose: the point of AC-10 is that gastronomy
 * and experience behave identically, and a per-vertical file makes the pair easy
 * to let drift.
 *
 * What is asserted here that nothing else covers:
 *  - the declared permission is `COMMERCE_MODERATION_CHANGE`, not
 *    `COMMERCE_MODERATE_REVIEW` (which moderates reviews) and not
 *    `COMMERCE_EDIT_ALL` (which would let any staff editor clear a rejection);
 *  - the handler delegates to `service.moderate`, not to `update` — routing the
 *    verdict through the generic update would put it back behind the edit
 *    permission and would be invisible from the caller's side;
 *  - a service error is re-thrown rather than returned as a 200 body.
 *
 * Pattern: mock `createAdminRoute` to capture the raw config, then invoke the
 * handler directly — no Hono app, no middleware chain.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs
// ---------------------------------------------------------------------------

type CapturedRoute = {
    path: string;
    summary: string;
    requiredPermissions?: readonly unknown[];
    anyOfPermissions?: readonly (readonly unknown[])[];
    handler: (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>;
};

const { capturedRoutes } = vi.hoisted(() => ({
    capturedRoutes: [] as CapturedRoute[]
}));

const {
    mockGastronomyModerate,
    mockExperienceModerate,
    mockGastronomyUpdate,
    mockExperienceUpdate
} = vi.hoisted(() => ({
    mockGastronomyModerate: vi.fn(),
    mockExperienceModerate: vi.fn(),
    mockGastronomyUpdate: vi.fn(),
    mockExperienceUpdate: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn((config: CapturedRoute) => {
        capturedRoutes.push(config);
        return config.handler;
    })
}));

vi.mock('../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    GastronomyService: vi.fn(function () {
        return { moderate: mockGastronomyModerate, update: mockGastronomyUpdate };
    }),
    ExperienceService: vi.fn(function () {
        return { moderate: mockExperienceModerate, update: mockExperienceUpdate };
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ModerationStatusEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../src/utils/actor';

await import('../../../src/routes/gastronomy/admin/moderate');
await import('../../../src/routes/experience/admin/moderate');

const mockGetActorFromContext = vi.mocked(getActorFromContext);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_ACTOR: Actor = {
    id: 'admin-actor-id',
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.COMMERCE_MODERATION_CHANGE]
};

const LISTING_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const VERTICALS = [
    {
        name: 'gastronomy',
        summary: 'Moderate a gastronomy listing (admin)',
        moderationChange: PermissionEnum.GASTRONOMY_MODERATION_CHANGE,
        moderate: mockGastronomyModerate,
        update: mockGastronomyUpdate
    },
    {
        name: 'experience',
        summary: 'Moderate an experience listing (admin)',
        moderationChange: PermissionEnum.EXPERIENCE_MODERATION_CHANGE,
        moderate: mockExperienceModerate,
        update: mockExperienceUpdate
    }
] as const;

function buildMockContext(): Context {
    return { get: vi.fn(), set: vi.fn(), json: vi.fn() } as unknown as Context;
}

function getRoute(summary: string): CapturedRoute {
    const route = capturedRoutes.find((candidate) => candidate.summary === summary);
    if (!route) {
        throw new Error(`No route captured with summary: ${summary}`);
    }
    return route;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Registration + gate
// ---------------------------------------------------------------------------

describe('both verticals expose a listing-moderate route (AC-10)', () => {
    it('registers exactly two of them', () => {
        expect(capturedRoutes).toHaveLength(2);
    });

    for (const { name, summary, moderationChange } of VERTICALS) {
        it(`${name}: is mounted at /{id}/moderate`, () => {
            expect(getRoute(summary).path).toBe('/{id}/moderate');
        });

        it(`${name}: is gated by moderationChange and nothing else`, () => {
            // Exact equality, still. `COMMERCE_MODERATE_REVIEW` here would gate
            // the listing verdict behind the review authority;
            // `COMMERCE_EDIT_ALL` would let any staff editor clear a rejection.
            // Both read as "an admin-only route" at a glance.
            //
            // HOS-1077 turned the AND list into ONE or-group: the vertical's own
            // moderationChange, or the legacy commerce one. The AND list must be
            // gone — leaving a permission there would AND it with the group and
            // silently tighten the gate.
            expect(getRoute(summary).requiredPermissions).toBeUndefined();
            expect(getRoute(summary).anyOfPermissions).toEqual([
                [moderationChange, PermissionEnum.COMMERCE_MODERATION_CHANGE]
            ]);
        });

        it(`${name}: does NOT accept the OTHER vertical's moderationChange`, () => {
            // The whole point of the split, asserted on the route's own
            // declaration: a gastronomy moderator must not be able to take an
            // experience listing down.
            const other = VERTICALS.find((v) => v.name !== name);
            const declared = (getRoute(summary).anyOfPermissions ?? []).flat();
            expect(declared).not.toContain(other?.moderationChange);
        });
    }
});

// ---------------------------------------------------------------------------
// Delegation
// ---------------------------------------------------------------------------

describe('the handler delegates to moderate(), not to the generic update (AC-10)', () => {
    for (const { name, summary, moderate, update } of VERTICALS) {
        it(`${name}: calls moderate with the actor, the id and the state`, async () => {
            const moderated = { id: LISTING_ID, moderationState: ModerationStatusEnum.REJECTED };
            moderate.mockResolvedValue({ data: moderated });

            const result = await getRoute(summary).handler(
                buildMockContext(),
                { id: LISTING_ID },
                { moderationState: ModerationStatusEnum.REJECTED }
            );

            expect(moderate).toHaveBeenCalledTimes(1);
            expect(moderate).toHaveBeenCalledWith({
                actor: ADMIN_ACTOR,
                id: LISTING_ID,
                moderationState: ModerationStatusEnum.REJECTED
            });
            expect(update).not.toHaveBeenCalled();
            expect(result).toEqual(moderated);
        });

        it(`${name}: rejects a body that is not a moderation state`, async () => {
            await expect(
                getRoute(summary).handler(
                    buildMockContext(),
                    { id: LISTING_ID },
                    { moderationState: 'BANNED' }
                )
            ).rejects.toThrow();

            expect(moderate).not.toHaveBeenCalled();
        });

        it(`${name}: rejects an empty body`, async () => {
            await expect(
                getRoute(summary).handler(buildMockContext(), { id: LISTING_ID }, {})
            ).rejects.toThrow();

            expect(moderate).not.toHaveBeenCalled();
        });
    }
});

// ---------------------------------------------------------------------------
// Error propagation
// ---------------------------------------------------------------------------

describe('a service error becomes a thrown ServiceError, never a 200 (AC-10)', () => {
    for (const { name, summary, moderate } of VERTICALS) {
        it(`${name}: re-throws FORBIDDEN — a non-admin actor cannot moderate`, async () => {
            moderate.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message:
                        'Permission denied: Insufficient permissions to moderate commerce listing'
                }
            });

            await expect(
                getRoute(summary).handler(
                    buildMockContext(),
                    { id: LISTING_ID },
                    { moderationState: ModerationStatusEnum.REJECTED }
                )
            ).rejects.toThrow(/moderate commerce listing/);
        });

        it(`${name}: re-throws NOT_FOUND`, async () => {
            moderate.mockResolvedValue({
                error: {
                    code: ServiceErrorCode.NOT_FOUND,
                    message: `gastronomy ${LISTING_ID} not found`
                }
            });

            await expect(
                getRoute(summary).handler(
                    buildMockContext(),
                    { id: LISTING_ID },
                    { moderationState: ModerationStatusEnum.REJECTED }
                )
            ).rejects.toThrow(/not found/i);
        });
    }
});
