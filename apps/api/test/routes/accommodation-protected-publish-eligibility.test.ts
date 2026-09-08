/**
 * Tests for GET /api/v1/protected/accommodations/publish-eligibility (HOS-1183).
 *
 * The endpoint exists because the publish verdict had no reader: a client could
 * only learn it by POSTing `/publish` and taking the 403, which is why the
 * card's button gated on a plan-shaped boolean and hid itself from owners the
 * server would have published.
 *
 * Two things are worth more than the happy path here:
 *
 * - **Routing.** `publish-eligibility` is a single path segment, exactly like
 *   `GET /{id}`. If it were registered after that route, the request would be
 *   read as an accommodation id and never reach this handler. The tests assert
 *   which service method ran, not just the status code.
 * - **Pass-through.** The route must not re-derive anything. Whatever the
 *   service answers is what crosses the wire; a route that recomputed
 *   `canPublish` would be the second statement of the rule this whole change
 *   removes.
 *
 * @module test/routes/accommodation-protected-publish-eligibility
 */

import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockGetPublishEligibility, mockGetById } = vi.hoisted(() => ({
    mockGetPublishEligibility: vi.fn(),
    mockGetById: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                getPublishEligibility: mockGetPublishEligibility,
                getById: mockGetById
            };
        })
    };
});

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const mockActor = {
    id: ACTOR_ID,
    roles: ['HOST'],
    permissions: ['accommodation.update.own', 'access.panelProtected']
};
vi.mock('../../src/utils/actor.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/utils/actor.js')>();
    return {
        ...actual,
        getActorFromContext: () => mockActor
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

const URL = '/api/v1/protected/accommodations/publish-eligibility';
const AUTH_HEADERS = {
    Authorization: 'Bearer test-protected-token',
    'User-Agent': 'vitest'
};

describe('GET /api/v1/protected/accommodations/publish-eligibility (HOS-1183)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        mockGetPublishEligibility.mockResolvedValue({
            data: { eligibility: 'has_active_sub', canPublish: true, startsTrial: false },
            error: undefined
        });
    });

    describe('routing', () => {
        it('reaches getPublishEligibility, not getById', async () => {
            // The decisive registration guard. Registered after `GET /{id}`,
            // "publish-eligibility" would be captured as an accommodation id
            // and this request would resolve somewhere else entirely — with a
            // status code that looks nothing like a routing bug.
            await app.request(URL, { headers: AUTH_HEADERS });

            expect(mockGetPublishEligibility).toHaveBeenCalledTimes(1);
            expect(mockGetById).not.toHaveBeenCalled();
        });

        it('asks about the authenticated actor, with no id involved', async () => {
            await app.request(URL, { headers: AUTH_HEADERS });

            const [actorArg] = mockGetPublishEligibility.mock.calls[0] as [{ id: string }];
            expect(actorArg.id).toBe(ACTOR_ID);
        });
    });

    describe('the three verdicts', () => {
        it('answers 200 for a paying owner', async () => {
            const res = await app.request(URL, { headers: AUTH_HEADERS });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toEqual({
                eligibility: 'has_active_sub',
                canPublish: true,
                startsTrial: false
            });
        });

        it('answers 200 with canPublish for a trial-eligible owner — the HOS-1183 bug', async () => {
            // The verdict the card used to collapse into "no plan → hide the
            // button". It must cross the wire as publishable, and as starting
            // a trial so the dialog can say so.
            mockGetPublishEligibility.mockResolvedValue({
                data: { eligibility: 'first_publish', canPublish: true, startsTrial: true },
                error: undefined
            });

            const res = await app.request(URL, { headers: AUTH_HEADERS });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data).toEqual({
                eligibility: 'first_publish',
                canPublish: true,
                startsTrial: true
            });
        });

        it('answers 200 with canPublish false when the trial is spent', async () => {
            // Not a 403: the question "may I publish" was answered
            // successfully. Refusing to answer it is what forced the UI to
            // guess in the first place.
            mockGetPublishEligibility.mockResolvedValue({
                data: {
                    eligibility: 'subscription_required',
                    canPublish: false,
                    startsTrial: false
                },
                error: undefined
            });

            const res = await app.request(URL, { headers: AUTH_HEADERS });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data).toEqual({
                eligibility: 'subscription_required',
                canPublish: false,
                startsTrial: false
            });
        });
    });

    describe('the route re-derives nothing', () => {
        it('forwards a canPublish that disagrees with the verdict — the staff case', async () => {
            // Platform staff bypass billing, so they publish on a
            // subscription_required verdict. A route that recomputed
            // canPublish from eligibility would overwrite this to false and
            // hide the button from them — the same bug, narrower audience.
            mockGetPublishEligibility.mockResolvedValue({
                data: {
                    eligibility: 'subscription_required',
                    canPublish: true,
                    startsTrial: false
                },
                error: undefined
            });

            const res = await app.request(URL, { headers: AUTH_HEADERS });

            const body = await res.json();
            expect(body.data.eligibility).toBe('subscription_required');
            expect(body.data.canPublish).toBe(true);
        });
    });

    describe('errors', () => {
        it('requires authentication', async () => {
            const res = await app.request(URL);

            expect([400, 401, 403]).toContain(res.status);
            expect(mockGetPublishEligibility).not.toHaveBeenCalled();
        });

        it('surfaces a service failure rather than guessing an answer', async () => {
            // Billing not wired is a CONFIGURATION_ERROR, and answering
            // "sure, publish" through it would hand out unbounded free
            // listings. The route must not invent a fallback verdict.
            mockGetPublishEligibility.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.CONFIGURATION_ERROR,
                    message: 'Publish eligibility requires billing dependencies'
                }
            });

            const res = await app.request(URL, { headers: AUTH_HEADERS });

            expect(res.status).toBeGreaterThanOrEqual(500);
        });
    });
});
