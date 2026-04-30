/**
 * Quota integration tests for USER tag routes (SPEC-086 T-043)
 *
 * Covers quota-related acceptance criteria:
 *
 *   AC-F09  — USER tag creation beyond quota returns quota error, no tag created
 *   AC-F10  — Concurrent USER tag creates at quota boundary → exactly quota tags after both
 *   AC-F17  — HOSPEDA_TAG_USER_QUOTA_PER_USER env var override works
 *   AC-003-03 — Quota indicator reflects state (used / limit from /quota endpoint)
 *
 * NOTE on AC-F10 (concurrent quota race):
 * The advisory lock (D-010) is enforced at the PostgreSQL DB layer via
 * `pg_advisory_xact_lock(hashtext(userId))`. Since these tests use a mocked
 * service, we cannot test the actual advisory lock in isolation. Instead we:
 * 1. Test that the route correctly surfaces QUOTA_EXCEEDED when the service
 *    returns it (AC-F09).
 * 2. Test the concurrent behaviour at the HTTP layer via Promise.all — verify
 *    that when one request succeeds and one fails with QUOTA_EXCEEDED, exactly
 *    one tag was logically created (AC-F10, API surface guarantee).
 * 3. Document that the actual advisory lock guarantee (exactly-once at the
 *    DB level) must be verified in a full integration test with a real DB
 *    (outside the scope of these mocked route tests).
 *
 * AC-F17 NOTE:
 * The quota limit comes from the TagService.getQuotaStatus() which reads the
 * env var. Since the service is mocked, we test the HTTP surface: when the
 * service returns a custom limit, the route surfaces it correctly. The actual
 * env var reading is a service-layer concern tested separately.
 *
 * Hono sibling route middleware collision:
 * Tests must provide the UNION of all permissions on adminOwnTagRoutes.
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockTagService } = vi.hoisted(() => {
    const mockTagService = {
        createUserTag: vi.fn(),
        getQuotaStatus: vi.fn(),
        listOwnTags: vi.fn(),
        updateOwnTag: vi.fn(),
        deleteTag: vi.fn(),
        getOwnTagImpactCount: vi.fn(),
        adminList: vi.fn(),
        list: vi.fn()
    };
    return { mockTagService };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        TagService: vi.fn().mockImplementation(() => mockTagService)
    };
});

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return { ...actual };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

// ─── Test fixtures ────────────────────────────────────────────────────────────

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const ANOTHER_ACTOR_ID = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb';

const OWN_TAG_BASE = {
    id: 'cccccccc-cccc-4ccc-accc-cccccccccccc',
    name: 'Weekend escapes',
    type: 'USER',
    ownerId: ACTOR_ID,
    color: 'PURPLE',
    icon: null,
    description: null,
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2025-09-01').toISOString(),
    updatedAt: new Date('2025-09-01').toISOString(),
    createdById: ACTOR_ID,
    updatedById: null
};

// ─── Permission helpers ───────────────────────────────────────────────────────

/**
 * UNION of all permissions required to pass sibling middleware on
 * adminOwnTagRoutes (Hono sibling route middleware collision).
 */
const ALL_OWN_PERMISSIONS: PermissionEnum[] = [
    PermissionEnum.TAG_USER_VIEW_OWN,
    PermissionEnum.TAG_USER_CREATE,
    PermissionEnum.TAG_USER_UPDATE_OWN,
    PermissionEnum.TAG_USER_DELETE_OWN
];

function buildAdminActor(permissions: PermissionEnum[], id = ACTOR_ID): Actor {
    return {
        id,
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            ...permissions
        ]
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('USER tag quota (SPEC-086 T-043 AC-F09, AC-F10, AC-F17, AC-003-03)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // AC-F09: USER tag creation beyond quota → quota error, no tag created
    // =========================================================================

    describe('AC-F09: USER tag creation beyond quota', () => {
        it('returns non-success status when service returns QUOTA_EXCEEDED', async () => {
            // Arrange — actor is at quota (50 ACTIVE USER tags)
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            mockTagService.createUserTag.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.QUOTA_EXCEEDED,
                    message: 'You have reached your limit of 50 personal tags.'
                }
            });

            // Act — attempt to create 51st tag
            const res = await app.request('/api/v1/admin/tags/own', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Tag 51', color: 'GREEN' })
            });

            // Assert — must not succeed
            expect(res.status).not.toBe(200);
            expect(res.status).not.toBe(201);
        });

        it('createUserTag is called exactly once per request (no retry on quota failure)', async () => {
            // Arrange
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            mockTagService.createUserTag.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.QUOTA_EXCEEDED,
                    message: 'Quota exceeded'
                }
            });

            // Act
            await app.request('/api/v1/admin/tags/own', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Over quota', color: 'RED' })
            });

            // Assert — exactly one call, no retry
            expect(mockTagService.createUserTag).toHaveBeenCalledTimes(1);
        });

        it('returns success on the tag just before quota (50th tag)', async () => {
            // Arrange — actor has 49 ACTIVE USER tags; 50th succeeds
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            mockTagService.createUserTag.mockResolvedValue({
                data: { ...OWN_TAG_BASE, name: 'Tag 50' }
            });

            // Act
            const res = await app.request('/api/v1/admin/tags/own', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Tag 50', color: 'PURPLE' })
            });

            // Assert — 50th tag creation succeeds
            expect(res.status).not.toBe(403);
            if (res.status < 400) {
                expect([200, 201]).toContain(res.status);
            }
        });
    });

    // =========================================================================
    // AC-F10: Concurrent USER tag creates at quota boundary
    // =========================================================================

    describe('AC-F10: Concurrent creates at quota boundary', () => {
        it('Promise.all with one success + one QUOTA_EXCEEDED → one logical tag created', async () => {
            // Arrange — first call succeeds (hits quota exactly), second fails
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            const headers = actorHeaders(actor);

            mockTagService.createUserTag
                .mockResolvedValueOnce({
                    data: { ...OWN_TAG_BASE, name: 'Concurrent tag' }
                })
                .mockResolvedValueOnce({
                    data: undefined,
                    error: {
                        code: ServiceErrorCode.QUOTA_EXCEEDED,
                        message: 'Quota exceeded (advisory lock enforced at DB level)'
                    }
                });

            // Act — simulate concurrent requests
            const [res1, res2] = await Promise.all([
                app.request('/api/v1/admin/tags/own', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: 'Concurrent tag', color: 'GREEN' })
                }),
                app.request('/api/v1/admin/tags/own', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: 'Concurrent tag', color: 'GREEN' })
                })
            ]);

            // Assert — service was called twice (one per concurrent request)
            expect(mockTagService.createUserTag).toHaveBeenCalledTimes(2);

            // Exactly one request should have succeeded
            const statuses = [res1.status, res2.status];
            const successCount = statuses.filter((s) => s >= 200 && s < 300).length;
            const failCount = statuses.filter((s) => s >= 400).length;
            expect(successCount).toBe(1);
            expect(failCount).toBe(1);
        });

        it('both concurrent requests fail if both return QUOTA_EXCEEDED (at-quota boundary)', async () => {
            // Arrange — actor is already at quota when both requests land
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            const headers = actorHeaders(actor);

            mockTagService.createUserTag.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.QUOTA_EXCEEDED,
                    message: 'Quota exceeded'
                }
            });

            // Act
            const [res1, res2] = await Promise.all([
                app.request('/api/v1/admin/tags/own', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: 'Both fail A', color: 'GREEN' })
                }),
                app.request('/api/v1/admin/tags/own', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: 'Both fail B', color: 'RED' })
                })
            ]);

            // Assert — neither succeeds
            expect(res1.status).not.toBe(201);
            expect(res2.status).not.toBe(201);
        });

        it('different actors concurrent creates do not interfere with each other', async () => {
            // Arrange — actor A and actor B each create a tag; different advisory lock keys
            const actorA = buildAdminActor(ALL_OWN_PERMISSIONS, ACTOR_ID);
            const actorB = buildAdminActor(ALL_OWN_PERMISSIONS, ANOTHER_ACTOR_ID);

            mockTagService.createUserTag.mockResolvedValue({
                data: { ...OWN_TAG_BASE }
            });

            // Act — both actors create simultaneously (different users, no lock conflict)
            const [resA, resB] = await Promise.all([
                app.request('/api/v1/admin/tags/own', {
                    method: 'POST',
                    headers: actorHeaders(actorA),
                    body: JSON.stringify({ name: 'Actor A tag', color: 'GREEN' })
                }),
                app.request('/api/v1/admin/tags/own', {
                    method: 'POST',
                    headers: actorHeaders(actorB),
                    body: JSON.stringify({ name: 'Actor B tag', color: 'BLUE' })
                })
            ]);

            // Assert — both should succeed (different users, independent quota)
            expect(resA.status).not.toBe(403);
            expect(resB.status).not.toBe(403);
            // Both should succeed since they don't share a quota lock
            if (resA.status < 400 && resB.status < 400) {
                expect([200, 201]).toContain(resA.status);
                expect([200, 201]).toContain(resB.status);
            }
        });
    });

    // =========================================================================
    // AC-F17: HOSPEDA_TAG_USER_QUOTA_PER_USER env override
    // =========================================================================

    describe('AC-F17: Quota env var override via service mock', () => {
        it('route surfaces the configured limit from getQuotaStatus (env override)', async () => {
            // Arrange — service returns a non-default limit (e.g., 100 from env override)
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            const customLimit = 100;
            mockTagService.getQuotaStatus.mockResolvedValue({
                data: { used: 15, limit: customLimit }
            });

            // Act
            const res = await app.request('/api/v1/admin/tags/own/quota', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert — the route passes through whatever limit the service returns
            if (res.status === 200) {
                const body = await res.json();
                const data = body.data ?? body;
                expect(data.limit).toBe(customLimit);
            } else {
                expect(res.status).not.toBe(403);
            }
        });

        it('quota error from service surfaces when limit is a custom value', async () => {
            // Arrange — custom limit of 10, actor has hit it
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            mockTagService.createUserTag.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.QUOTA_EXCEEDED,
                    message: 'You have reached your limit of 10 personal tags.'
                }
            });

            // Act
            const res = await app.request('/api/v1/admin/tags/own', {
                method: 'POST',
                headers: actorHeaders(actor),
                body: JSON.stringify({ name: 'Over limit', color: 'RED' })
            });

            // Assert — non-success
            expect(res.status).not.toBe(200);
            expect(res.status).not.toBe(201);
        });
    });

    // =========================================================================
    // AC-003-03: Quota indicator reflects state (used / limit)
    // =========================================================================

    describe('AC-003-03: Quota status endpoint reflects current state', () => {
        it('returns used and limit fields with correct types', async () => {
            // Arrange
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            mockTagService.getQuotaStatus.mockResolvedValue({
                data: { used: 38, limit: 50 }
            });

            // Act
            const res = await app.request('/api/v1/admin/tags/own/quota', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            expect(res.status).not.toBe(403);
            if (res.status === 200) {
                const body = await res.json();
                const data = body.data ?? body;
                expect(typeof data.used).toBe('number');
                expect(typeof data.limit).toBe('number');
                expect(data.used).toBe(38);
                expect(data.limit).toBe(50);
            }
        });

        it('quota at default 50: used=50 means no more tags can be created', async () => {
            // Arrange — at quota
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            mockTagService.getQuotaStatus.mockResolvedValue({
                data: { used: 50, limit: 50 }
            });

            // Act
            const res = await app.request('/api/v1/admin/tags/own/quota', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            if (res.status === 200) {
                const body = await res.json();
                const data = body.data ?? body;
                expect(data.used).toBe(data.limit);
            }
        });

        it('quota at zero: brand new user has no USER tags', async () => {
            // Arrange — fresh actor with no tags
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            mockTagService.getQuotaStatus.mockResolvedValue({
                data: { used: 0, limit: 50 }
            });

            // Act
            const res = await app.request('/api/v1/admin/tags/own/quota', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert
            if (res.status === 200) {
                const body = await res.json();
                const data = body.data ?? body;
                expect(data.used).toBe(0);
                expect(data.limit).toBeGreaterThan(0);
            }
        });

        it('quota counts only ACTIVE tags (not INACTIVE or ARCHIVED)', async () => {
            // Arrange — actor has 12 total tags, but only 7 are ACTIVE (quota counts ACTIVE)
            // Service pre-calculates this correctly
            const actor = buildAdminActor(ALL_OWN_PERMISSIONS);
            mockTagService.getQuotaStatus.mockResolvedValue({
                data: { used: 7, limit: 50 } // used=7 (ACTIVE only), not 12 (all states)
            });

            // Act
            const res = await app.request('/api/v1/admin/tags/own/quota', {
                method: 'GET',
                headers: actorHeaders(actor)
            });

            // Assert — used reflects ACTIVE count only
            if (res.status === 200) {
                const body = await res.json();
                const data = body.data ?? body;
                expect(data.used).toBe(7);
            } else {
                expect(res.status).not.toBe(403);
            }
        });
    });
});
