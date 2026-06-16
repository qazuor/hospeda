/**
 * Unit tests for the GET downgrade-preview billing route (SPEC-203).
 *
 * Covers:
 * - Success: authenticated owner with a valid plan slug gets a DowngradePreview.
 * - Unknown plan slug → 422 (PlanCatalogMissError mapped to HTTPException).
 * - Unauthenticated (no actor in context) → 401 / 500 depending on actor middleware.
 * - Missing targetPlan query param → 422 defensive guard.
 * - Unexpected service error propagates as-is (not swallowed).
 *
 * Mocking strategy mirrors `plan-change-downgrade.test.ts`:
 * - `computeDowngradeExcess` and its deps are mocked at module level so the
 *   test stays unit-level without DB access.
 * - `getActorFromContext` is mocked to control the authenticated actor.
 * - `createCRUDRoute` / `createRouter` are mocked to expose the raw handler
 *   for direct invocation.
 *
 * @module test/routes/billing/downgrade-preview
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be declared BEFORE importing the route file).
// ---------------------------------------------------------------------------

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../../src/utils/route-factory', () => ({
    createCRUDRoute: vi.fn((config: { handler: unknown }) => config.handler),
    createSimpleRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

// Mock computeDowngradeExcess so route tests stay unit-level (no DB / billing catalog
// access). The service has its own dedicated test suite.
vi.mock('../../../src/services/subscription-downgrade-excess.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        computeDowngradeExcess: vi.fn(),
        defaultExcessDeps: {}
    };
});

// Mock getActorFromContext so we can control authentication state.
vi.mock('../../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import type { DowngradePreview } from '@repo/schemas';
import { RoleEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext } from '../../../src/middlewares/actor';
import { handleDowngradePreview } from '../../../src/routes/billing/downgrade-preview';
import {
    PlanCatalogMissError,
    computeDowngradeExcess
} from '../../../src/services/subscription-downgrade-excess.service';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ACTOR_ID = '00000000-0000-4000-8000-000000000099';
const TARGET_PLAN_SLUG = 'owner-basico';

const MOCK_ACTOR = {
    id: ACTOR_ID,
    role: RoleEnum.HOST,
    permissions: [],
    email: 'host@test.com',
    name: 'Test Host'
};

/**
 * Minimal DowngradePreview fixture representing a host with no excess.
 */
const PREVIEW_NO_EXCESS: DowngradePreview = {
    accommodations: { cap: 5, activeCount: 2, excessCount: 0, items: [] },
    promotions: { cap: 3, activeCount: 1, excessCount: 0, items: [] },
    photos: [],
    grandfatherFlags: [],
    hasExcess: false
};

/**
 * Minimal DowngradePreview fixture representing a host with accommodation excess.
 */
const PREVIEW_WITH_EXCESS: DowngradePreview = {
    accommodations: {
        cap: 1,
        activeCount: 3,
        excessCount: 2,
        items: [
            {
                id: 'accom-1',
                name: 'Casa del Lago',
                updatedAt: '2026-01-01T00:00:00.000Z',
                viewCount: 10,
                keepByDefault: true
            },
            {
                id: 'accom-2',
                name: 'Hostal Litoral',
                updatedAt: '2025-12-01T00:00:00.000Z',
                viewCount: 5,
                keepByDefault: false
            },
            {
                id: 'accom-3',
                name: 'Estancia Sur',
                updatedAt: '2025-11-01T00:00:00.000Z',
                viewCount: 2,
                keepByDefault: false
            }
        ]
    },
    promotions: { cap: 3, activeCount: 2, excessCount: 0, items: [] },
    photos: [],
    grandfatherFlags: [],
    hasExcess: true
};

/**
 * Build a minimal Hono context stub for direct handler invocation.
 */
function makeContext(actorOverride?: unknown) {
    const store = new Map<string, unknown>([['actor', actorOverride ?? MOCK_ACTOR]]);
    return {
        get: vi.fn((k: string) => store.get(k)),
        set: vi.fn((k: string, v: unknown) => store.set(k, v))
    };
}

/**
 * Build a minimal query object for the handler.
 */
function makeQuery(targetPlan?: string): Record<string, unknown> {
    return targetPlan !== undefined ? { targetPlan } : {};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleDowngradePreview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: authenticated actor is present.
        vi.mocked(getActorFromContext).mockReturnValue(MOCK_ACTOR);
    });

    // ── Happy paths ──────────────────────────────────────────────────────────

    describe('success — valid plan slug', () => {
        it('returns DowngradePreview from computeDowngradeExcess (no excess)', async () => {
            vi.mocked(computeDowngradeExcess).mockResolvedValue(PREVIEW_NO_EXCESS);

            const ctx = makeContext();
            const result = await handleDowngradePreview(
                ctx as never,
                {},
                {},
                makeQuery(TARGET_PLAN_SLUG)
            );

            expect(result).toEqual(PREVIEW_NO_EXCESS);
        });

        it('returns DowngradePreview with excess when host has too many accommodations', async () => {
            vi.mocked(computeDowngradeExcess).mockResolvedValue(PREVIEW_WITH_EXCESS);

            const ctx = makeContext();
            const result = await handleDowngradePreview(
                ctx as never,
                {},
                {},
                makeQuery(TARGET_PLAN_SLUG)
            );

            expect(result).toEqual(PREVIEW_WITH_EXCESS);
            expect(result.hasExcess).toBe(true);
            expect(result.accommodations.excessCount).toBe(2);
        });

        it('calls computeDowngradeExcess with actor.id and targetPlanSlug from query', async () => {
            vi.mocked(computeDowngradeExcess).mockResolvedValue(PREVIEW_NO_EXCESS);

            const ctx = makeContext();
            await handleDowngradePreview(ctx as never, {}, {}, makeQuery(TARGET_PLAN_SLUG));

            expect(computeDowngradeExcess).toHaveBeenCalledOnce();
            expect(computeDowngradeExcess).toHaveBeenCalledWith(
                { userId: ACTOR_ID, targetPlanSlug: TARGET_PLAN_SLUG },
                {} // defaultExcessDeps mock
            );
        });
    });

    // ── Error paths ──────────────────────────────────────────────────────────

    describe('unauthenticated — no actor', () => {
        it('propagates the exception thrown by getActorFromContext', async () => {
            // Simulate the actor middleware not having run / guest actor.
            vi.mocked(getActorFromContext).mockImplementation(() => {
                throw new HTTPException(401, { message: 'Authentication required' });
            });

            const ctx = makeContext(undefined);
            await expect(
                handleDowngradePreview(ctx as never, {}, {}, makeQuery(TARGET_PLAN_SLUG))
            ).rejects.toMatchObject({ status: 401 });
        });
    });

    describe('unknown plan slug → 422', () => {
        it('maps PlanCatalogMissError to HTTPException 422', async () => {
            vi.mocked(computeDowngradeExcess).mockRejectedValue(
                new PlanCatalogMissError('not-a-real-plan')
            );

            const ctx = makeContext();
            await expect(
                handleDowngradePreview(ctx as never, {}, {}, makeQuery('not-a-real-plan'))
            ).rejects.toMatchObject({ status: 422 });
        });

        it('includes the unknown slug in the 422 message', async () => {
            vi.mocked(computeDowngradeExcess).mockRejectedValue(
                new PlanCatalogMissError('ghost-plan')
            );

            const ctx = makeContext();
            let caught: HTTPException | undefined;
            try {
                await handleDowngradePreview(ctx as never, {}, {}, makeQuery('ghost-plan'));
            } catch (e) {
                caught = e as HTTPException;
            }
            expect(caught).toBeDefined();
            expect(caught?.message).toContain('ghost-plan');
        });
    });

    describe('missing targetPlan → 422', () => {
        it('throws 422 when targetPlan is absent from query', async () => {
            const ctx = makeContext();
            await expect(
                handleDowngradePreview(ctx as never, {}, {}, makeQuery(undefined))
            ).rejects.toMatchObject({ status: 422 });
        });

        it('throws 422 when targetPlan is an empty string', async () => {
            const ctx = makeContext();
            await expect(
                handleDowngradePreview(ctx as never, {}, {}, makeQuery(''))
            ).rejects.toMatchObject({ status: 422 });
        });
    });

    describe('unexpected service error', () => {
        it('propagates non-PlanCatalogMissError errors as-is', async () => {
            const dbError = new Error('DB connection refused');
            vi.mocked(computeDowngradeExcess).mockRejectedValue(dbError);

            const ctx = makeContext();
            await expect(
                handleDowngradePreview(ctx as never, {}, {}, makeQuery(TARGET_PLAN_SLUG))
            ).rejects.toThrow('DB connection refused');
        });
    });
});
