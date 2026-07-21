/**
 * Route tests for GET /api/v1/protected/host-onboarding/precheck (BETA-197).
 *
 * Mirrors the mocking strategy of `host-onboarding-protected-start.test.ts`
 * and `user-bookmark/toggleAtCap.test.ts`: mount the real app (`initApp()`)
 * so the actual route + handler + `deriveOnboardingDecision` composition is
 * exercised, mock `AccommodationService` so no DB is needed, and mock
 * `getRemainingLimit` so `checkLimit()` sees a deterministic MAX_ACCOMMODATIONS
 * cap without depending on the entitlement middleware's real plan lookup.
 *
 * Covers three representative cells of the decision matrix end-to-end
 * (create_direct, resume_or_create, pick_draft_delete_or_upgrade) plus the
 * response shape.
 *
 * @module test/routes/host-onboarding-protected-precheck
 */
import { LimitKey } from '@repo/billing';
import { type PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockCount, mockList } = vi.hoisted(() => ({
    mockCount: vi.fn(),
    mockList: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                count: mockCount,
                list: mockList
            };
        })
    };
});

/** MAX_ACCOMMODATIONS cap used across these tests. */
const MAX_ACCOMMODATIONS = 3;

vi.mock('../../src/middlewares/entitlement.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/middlewares/entitlement.js')>();
    return {
        ...actual,
        getRemainingLimit: (_c: unknown, limitKey: string) => {
            if (limitKey === LimitKey.MAX_ACCOMMODATIONS) {
                return MAX_ACCOMMODATIONS;
            }
            return -1;
        }
    };
});

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Import app AFTER mocks are set up
// ---------------------------------------------------------------------------
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const BASE_URL = '/api/v1/protected/host-onboarding/precheck';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function buildUserActor(id = ACTOR_ID): Actor {
    return {
        id,
        role: RoleEnum.USER,
        permissions: [] as PermissionEnum[]
    };
}

function actorHeaders(actor: Actor): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions)
    };
}

function makeDraft(overrides: Record<string, unknown> = {}) {
    return {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        slug: 'cabana-de-prueba',
        name: 'Cabaña de prueba',
        ...overrides
    };
}

describe('GET /api/v1/protected/host-onboarding/precheck (BETA-197)', () => {
    let app: AppOpenAPI;
    const actor = buildUserActor();

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
    });

    it('0 drafts + quota available -> create_direct', async () => {
        mockCount.mockResolvedValue({ data: { count: 0 }, error: undefined });
        mockList.mockResolvedValue({ data: { items: [], total: 0 }, error: undefined });

        const res = await app.request(BASE_URL, { method: 'GET', headers: actorHeaders(actor) });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data).toEqual({
            currentCount: 0,
            maxAllowed: MAX_ACCOMMODATIONS,
            hasQuota: true,
            draftCount: 0,
            drafts: [],
            decision: 'create_direct'
        });
    });

    it('1 draft + quota available -> resume_or_create, drafts array populated', async () => {
        const draft = makeDraft();
        mockCount.mockResolvedValue({ data: { count: 1 }, error: undefined });
        mockList.mockResolvedValue({
            data: { items: [draft], total: 1 },
            error: undefined
        });

        const res = await app.request(BASE_URL, { method: 'GET', headers: actorHeaders(actor) });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.decision).toBe('resume_or_create');
        expect(body.data.draftCount).toBe(1);
        expect(body.data.drafts).toEqual([{ id: draft.id, slug: draft.slug, name: draft.name }]);
        expect(body.data.hasQuota).toBe(true);
        expect(body.data.currentCount).toBe(1);
    });

    it('>1 drafts + limit reached -> pick_draft_delete_or_upgrade', async () => {
        const drafts = [
            makeDraft({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', slug: 'draft-1' }),
            makeDraft({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', slug: 'draft-2' })
        ];
        // Total accommodations already at the cap.
        mockCount.mockResolvedValue({ data: { count: MAX_ACCOMMODATIONS }, error: undefined });
        mockList.mockResolvedValue({
            data: { items: drafts, total: drafts.length },
            error: undefined
        });

        const res = await app.request(BASE_URL, { method: 'GET', headers: actorHeaders(actor) });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.decision).toBe('pick_draft_delete_or_upgrade');
        expect(body.data.draftCount).toBe(2);
        expect(body.data.hasQuota).toBe(false);
        expect(body.data.maxAllowed).toBe(MAX_ACCOMMODATIONS);
        expect(body.data.drafts).toHaveLength(2);
    });

    it('queries with the ownerId + DRAFT + not-deleted filter', async () => {
        mockCount.mockResolvedValue({ data: { count: 0 }, error: undefined });
        mockList.mockResolvedValue({ data: { items: [], total: 0 }, error: undefined });

        await app.request(BASE_URL, { method: 'GET', headers: actorHeaders(actor) });

        expect(mockList).toHaveBeenCalledWith(
            expect.objectContaining({ id: actor.id }),
            expect.objectContaining({
                where: expect.objectContaining({
                    ownerId: actor.id,
                    lifecycleState: 'DRAFT',
                    deletedAt: null
                })
            })
        );
    });
});
