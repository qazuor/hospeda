/**
 * The accommodation cap REFUSES when it cannot count, asserted END-TO-END
 * (HOS-1078 part 2).
 *
 * ---
 * WHY THIS FILE IS A REQUEST TEST AND NOT A UNIT TEST
 *
 * HOS-973 R-2: *every key and every cap is asserted end to end against the real
 * route, NEVER by calling `checkLimit` with a hand-built context.* With a
 * fabricated context the guard always answers green — which is exactly how
 * `enforceAccommodationLimit` kept a `next()` on its count-failure branch while
 * the suite stayed green.
 *
 * So every case below goes through `app.request()` on one of the THREE routes
 * that mount `enforceAccommodationLimit()`:
 *
 *   - `POST /api/v1/protected/accommodations`        (create.ts)
 *   - `POST /api/v1/protected/accommodations/draft`  (createDraft.ts)
 *   - `POST /api/v1/protected/host-onboarding/start` (host-onboarding/start.ts)
 *
 * ## What is stubbed, and what stays real
 *
 * Only `AccommodationService` is replaced — `count()` because it is the
 * request-specific input a test has to control, and the two create methods so
 * the assertion "the accommodation was NOT created" is observable. Everything
 * else runs: the route factory, auth, the permission gate, the entitlement
 * middleware, `enforceAccommodationLimit`, `checkLimit`, and the error mapping.
 *
 * ## The decisive assertion is the create call, not the status
 *
 * A status-only assertion would pass for the wrong reason (the entitlement
 * middleware answers 503 too, on its own `billingLoadFailed` path). Each
 * refusal case therefore asserts that the create method was never reached —
 * which is the actual product statement: a listing is not handed out when the
 * cap could not be evaluated.
 *
 * @module test/middlewares/accommodation-limit-fail-closed.e2e
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — `count` lives on `BaseCrudService.prototype`, not on
// `AccommodationService.prototype`, so a prototype spy cannot see it. Replacing
// the class (the pattern `host-onboarding-protected-start.test.ts` already
// uses) gives the middleware and the handler the same three functions.
// ---------------------------------------------------------------------------
const { mockCount, mockCreate, mockCreateForOnboarding, mockGetPlanBySlug } = vi.hoisted(() => ({
    mockCount: vi.fn(),
    mockCreate: vi.fn(),
    mockCreateForOnboarding: vi.fn(),
    mockGetPlanBySlug: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                count: mockCount,
                create: mockCreate,
                createForOnboarding: mockCreateForOnboarding
            };
        }),
        // `entitlementMiddleware` resolves a HOST actor with no billing customer
        // through `planService.getBySlug('owner-basico')`. The DB is mocked
        // wholesale by `test/setup.ts`, so without this the lookup fails and the
        // actor degrades to tourist-free — which lacks PUBLISH_ACCOMMODATIONS, so
        // `requireEntitlement` would 403 the two accommodation routes BEFORE the
        // limit middleware ever ran. Returning the real owner-basico shape is
        // what puts these requests on the production path.
        PlanService: vi.fn().mockImplementation(function () {
            return { getBySlug: mockGetPlanBySlug };
        })
    };
});

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const DESTINATION_ID = '11111111-1111-4111-8111-111111111111';
const ACCOMMODATION_ID = '33333333-3333-4333-8333-333333333333';

const CREATE_PATH = '/api/v1/protected/accommodations';
const DRAFT_PATH = '/api/v1/protected/accommodations/draft';
const ONBOARDING_PATH = '/api/v1/protected/host-onboarding/start';

/** A host with the accommodation-create permission and nothing else. */
const hostHeaders = {
    'user-agent': 'vitest',
    'content-type': 'application/json',
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': RoleEnum.HOST,
    'x-mock-actor-permissions': JSON.stringify([PermissionEnum.ACCOMMODATION_CREATE])
};

/** A minimally valid draft/onboarding payload. */
const draftBody = JSON.stringify({
    name: 'Cabaña del Litoral',
    summary: 'A riverside cabin with room for four guests and a shaded deck.',
    type: 'CABIN',
    destinationId: DESTINATION_ID
});

/**
 * A minimally valid FULL create payload.
 *
 * Deliberately valid rather than reusing `draftBody`: an invalid body answers
 * 400 whether the middleware refused or waved the request through, so it would
 * make the refusal unobservable on this route.
 */
const createBody = JSON.stringify({
    name: 'Cabaña del Litoral',
    summary: 'A riverside cabin with room for four guests and a shaded deck.',
    description:
        'A riverside cabin with room for four guests, a shaded deck and a short walk to the pier.',
    type: 'CABIN',
    address: 'Costanera 1200',
    latitude: -32.48,
    longitude: -58.23,
    maxGuests: 4,
    bedrooms: 2,
    bathrooms: 1,
    basePrice: 45000,
    destinationId: DESTINATION_ID,
    ownerId: OWNER_ID
});

/** The three routes that mount `enforceAccommodationLimit()`, with their bodies. */
const ALL_PATHS: ReadonlyArray<readonly [string, string, string]> = [
    ['POST /accommodations', CREATE_PATH, createBody],
    ['POST /accommodations/draft', DRAFT_PATH, draftBody],
    ['POST /host-onboarding/start', ONBOARDING_PATH, draftBody]
];

/** Asserts neither create path ran. */
function expectNothingCreated(): void {
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockCreateForOnboarding).not.toHaveBeenCalled();
}

describe('accommodation cap fails CLOSED on a count failure (HOS-1078)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();

        const created = {
            id: ACCOMMODATION_ID,
            slug: 'cabana-del-litoral',
            name: 'Cabaña del Litoral'
        };
        mockCreate.mockResolvedValue({ data: created, error: undefined });
        mockCreateForOnboarding.mockResolvedValue({
            data: { status: 'created', accommodation: created },
            error: undefined
        });
        // owner-basico, as the DB carries it: one accommodation, publish granted.
        mockGetPlanBySlug.mockResolvedValue({
            success: true,
            data: {
                slug: 'owner-basico',
                entitlements: ['publish_accommodations'],
                limits: { max_accommodations: 1 }
            }
        });
    });

    it.each(
        ALL_PATHS
    )('%s answers 503 and creates nothing when the count fails', async (_label, path, body) => {
        // The `Result`-shaped failure — `limit-enforcement.ts` used to log
        // this one and call `next()` anyway.
        mockCount.mockResolvedValue({
            data: undefined,
            error: { code: 'INTERNAL_ERROR', message: 'connection terminated unexpectedly' }
        });

        const res = await app.request(path, {
            method: 'POST',
            headers: hostHeaders,
            body
        });

        // Asserted FIRST because it is the product statement, and the one
        // the old `next()` cannot satisfy: no accommodation came out of an
        // unevaluated cap. The status alone would be ambiguous — the
        // entitlement middleware answers 503 on its own failure path too.
        expectNothingCreated();
        expect(res.status).toBe(503);
    });

    it.each(
        ALL_PATHS
    )('%s answers 503 and creates nothing when the count THROWS', async (_label, path, body) => {
        // The unexpected-error branch, which used to log and `next()` too.
        mockCount.mockRejectedValue(new Error('connection terminated unexpectedly'));

        const res = await app.request(path, {
            method: 'POST',
            headers: hostHeaders,
            body
        });

        expectNothingCreated();
        expect(res.status).toBe(503);
    });

    it.each(ALL_PATHS)('%s still lets an under-cap create through', async (_label, path, body) => {
        // Non-vacuity: proves the gate reads the count rather than refusing
        // every request that reaches it.
        mockCount.mockResolvedValue({ data: { count: 0 }, error: undefined });

        const res = await app.request(path, {
            method: 'POST',
            headers: hostHeaders,
            body
        });

        expect(res.status).not.toBe(503);
        expect(mockCreate.mock.calls.length + mockCreateForOnboarding.mock.calls.length).toBe(1);
    });

    it.each(
        ALL_PATHS
    )('%s still answers 403 LIMIT_REACHED at the cap, not 503', async (_label, path, body) => {
        // The cap that DID work keeps working, and keeps its own status: a
        // refusal that answered 503 everywhere would be the same bug wearing
        // the other mask, and would tell the web to retry instead of to
        // upgrade.
        mockCount.mockResolvedValue({ data: { count: 1 }, error: undefined });

        const res = await app.request(path, {
            method: 'POST',
            headers: hostHeaders,
            body
        });

        expect(res.status).toBe(403);
        const errorBody = (await res.json()) as { error?: { code?: string } };
        expect(errorBody.error?.code).toBe('LIMIT_REACHED');
        expectNothingCreated();
    });
});
