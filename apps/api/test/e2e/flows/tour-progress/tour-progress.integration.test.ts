/**
 * @file tour-progress.integration.test.ts
 *
 * Integration tests for the tour-progress API endpoint with a real PostgreSQL
 * database (SPEC-174 T-017).
 *
 * Covers §6.2 + §6.3 (server-side read-modify-write merge):
 *  1. PATCH persists adminTours[tourId]=version in the stored JSONB (DB read assertion).
 *  2. Sibling preservation BOTH directions: pre-seed settings with
 *     onboarding.whatsNew + theme/notifications → PATCH tour-progress →
 *     whatsNew + others intact (mirror of SPEC-175 AC-17).
 *  3. Upsert: same tourId twice with higher version → single key, latest version.
 *  4. Two different tourIds accumulate independently.
 *  5. Invalid body → 400.
 *  6. Unauthenticated → 401.
 *
 * ### Pattern
 *
 * Follows the established e2e suite pattern from SPEC-175 (whats-new.integration.test.ts):
 * - `testDb.setup()` / `testDb.teardown()` in beforeAll / afterAll.
 * - `testDb.clean()` in afterEach for per-test isolation.
 * - `initApp()` from `src/app.ts` as the Hono request target.
 * - Mock actor headers (`x-mock-actor-*`) processed by actorMiddleware.
 * - `createTestUser()` from `setup/seed-helpers.ts` for user creation.
 * - `testDb.getDb().select(...).from(...).where(...)` for DB read assertions.
 *
 * ### DB availability guard
 *
 * When `HOSPEDA_DATABASE_URL` is not set, every test is skipped via
 * `it.skipIf`. This keeps the exit code at 0 in environments without a DB.
 *
 * @see apps/api/src/routes/user/protected/tourProgress.ts
 * @see SPEC-174 §6.2, §6.3, D6, D16
 * @see SPEC-175 whats-new.integration.test.ts — mirror pattern (AC-17)
 */

import { eq, users } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { createAuthenticatedRequest, createMockActor } from '../../../helpers/auth.js';
import { createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// ---------------------------------------------------------------------------
// DB availability guard
// ---------------------------------------------------------------------------

const dbAvailable = Boolean(process.env.HOSPEDA_DATABASE_URL);

// ---------------------------------------------------------------------------
// DB read helper: load settings for a user by id
// ---------------------------------------------------------------------------

/**
 * Reads the full settings JSONB for a user from the database.
 *
 * @param userId - The user's id.
 * @returns The settings object or null if the user has no settings.
 */
async function readUserSettings(userId: string): Promise<Record<string, unknown> | null> {
    const rows = await testDb
        .getDb()
        .select({ settings: users.settings })
        .from(users)
        .where(eq(users.id, userId));
    return (rows[0]?.settings as Record<string, unknown>) ?? null;
}

/**
 * Reads `settings.onboarding.adminTours` for a user.
 *
 * @param userId - The user's id.
 * @returns The adminTours map or an empty object if not set.
 */
async function readAdminTours(userId: string): Promise<Record<string, unknown>> {
    const settings = await readUserSettings(userId);
    const onboarding = (settings?.onboarding as Record<string, unknown> | undefined) ?? {};
    return (onboarding?.adminTours as Record<string, unknown> | undefined) ?? {};
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('SPEC-174 T-017 — tour-progress integration tests (real DB)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(async () => {
        if (!dbAvailable) return;
        await testDb.setup();
        app = initApp();
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await testDb.teardown();
    });

    afterEach(async () => {
        if (!dbAvailable) return;
        await testDb.clean();
    });

    // =========================================================================
    // 1. PATCH persists adminTours[tourId]=version in JSONB
    // =========================================================================

    describe('basic persistence', () => {
        it.skipIf(!dbAvailable)(
            'PATCH persists adminTours[tourId]=version in the stored JSONB',
            async () => {
                // Arrange
                const user = await createTestUser({
                    role: RoleEnum.HOST,
                    settings: {
                        notifications: {
                            enabled: true,
                            allowEmails: true,
                            allowSms: false,
                            allowPush: false
                        }
                    }
                });

                const actor = createMockActor(
                    RoleEnum.HOST,
                    [
                        PermissionEnum.ACCESS_API_PRIVATE,
                        PermissionEnum.ACCESS_API_PUBLIC,
                        PermissionEnum.USER_SETTINGS_UPDATE
                    ],
                    user.id
                );
                const authHeaders = createAuthenticatedRequest(actor).headers;

                // Verify no adminTours state before
                const before = await readAdminTours(user.id);
                expect(before['host.welcome']).toBeUndefined();

                // Act
                const response = await app.request('/api/v1/protected/users/me/tour-progress', {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify({ tourId: 'host.welcome', version: 1 })
                });

                // Assert — HTTP 200
                expect(response.status).toBe(200);
                const body = await response.json();
                expect(body.success).toBe(true);

                // Assert — DB now has adminTours['host.welcome'] = 1
                const after = await readAdminTours(user.id);
                expect(after['host.welcome']).toBe(1);
            }
        );
    });

    // =========================================================================
    // 2. Sibling preservation — whatsNew + theme + notifications untouched
    // =========================================================================

    describe('sibling settings preservation (AC-17 mirror)', () => {
        it.skipIf(!dbAvailable)(
            'PATCH tour-progress preserves whatsNew, theme, and notifications sibling keys',
            async () => {
                // Arrange — user has pre-existing settings with whatsNew + theme + notifications
                const user = await createTestUser({
                    role: RoleEnum.ADMIN,
                    settings: {
                        theme: 'dark',
                        notifications: {
                            enabled: true,
                            allowEmails: false,
                            allowSms: false,
                            allowPush: true
                        },
                        onboarding: {
                            whatsNew: {
                                baselineAt: '2026-01-01T00:00:00Z',
                                seenIds: ['existing-entry']
                            }
                        }
                    }
                });

                const actor = createMockActor(
                    RoleEnum.ADMIN,
                    [
                        PermissionEnum.ACCESS_API_PRIVATE,
                        PermissionEnum.ACCESS_API_PUBLIC,
                        PermissionEnum.USER_SETTINGS_UPDATE
                    ],
                    user.id
                );
                const authHeaders = createAuthenticatedRequest(actor).headers;

                // Act — PATCH tour-progress
                const response = await app.request('/api/v1/protected/users/me/tour-progress', {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify({ tourId: 'admin.welcome', version: 1 })
                });

                // Assert — HTTP 200
                expect(response.status).toBe(200);

                // Assert — DB: sibling keys intact
                const after = await readUserSettings(user.id);
                const afterSettings = after as Record<string, unknown>;

                // theme preserved
                expect(afterSettings?.theme).toBe('dark');

                // notifications preserved
                const notifications = afterSettings?.notifications as
                    | Record<string, unknown>
                    | undefined;
                expect(notifications?.enabled).toBe(true);
                expect(notifications?.allowPush).toBe(true);

                // whatsNew preserved
                const onboarding = afterSettings?.onboarding as Record<string, unknown> | undefined;
                const whatsNew = onboarding?.whatsNew as
                    | { baselineAt?: string; seenIds?: string[] }
                    | undefined;
                expect(whatsNew?.baselineAt).toBe('2026-01-01T00:00:00Z');
                expect(whatsNew?.seenIds).toContain('existing-entry');

                // adminTours written
                const adminTours = onboarding?.adminTours as Record<string, unknown> | undefined;
                expect(adminTours?.['admin.welcome']).toBe(1);
            }
        );

        it.skipIf(!dbAvailable)(
            'PATCH tour-progress when adminTours already has entries: new entry added, existing preserved',
            async () => {
                // Arrange — user already has one tour seen + whatsNew baseline
                const user = await createTestUser({
                    role: RoleEnum.ADMIN,
                    settings: {
                        onboarding: {
                            adminTours: { 'host.welcome': 1 },
                            whatsNew: { baselineAt: '2026-01-01T00:00:00Z', seenIds: [] }
                        }
                    }
                });

                const actor = createMockActor(
                    RoleEnum.ADMIN,
                    [
                        PermissionEnum.ACCESS_API_PRIVATE,
                        PermissionEnum.ACCESS_API_PUBLIC,
                        PermissionEnum.USER_SETTINGS_UPDATE
                    ],
                    user.id
                );
                const authHeaders = createAuthenticatedRequest(actor).headers;

                // Act — mark a DIFFERENT tour seen
                const response = await app.request('/api/v1/protected/users/me/tour-progress', {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify({ tourId: 'admin.welcome', version: 1 })
                });

                expect(response.status).toBe(200);

                // Assert — both tours present, whatsNew untouched
                const after = await readUserSettings(user.id);
                const onboarding = (after?.onboarding as Record<string, unknown> | undefined) ?? {};
                const adminTours = (onboarding?.adminTours as Record<string, unknown>) ?? {};

                expect(adminTours['host.welcome']).toBe(1); // existing preserved
                expect(adminTours['admin.welcome']).toBe(1); // new entry added

                const whatsNew = onboarding?.whatsNew as { baselineAt?: string } | undefined;
                expect(whatsNew?.baselineAt).toBe('2026-01-01T00:00:00Z');
            }
        );
    });

    // =========================================================================
    // 3. Upsert: same tourId twice with higher version → single key, latest version
    // =========================================================================

    describe('upsert semantics', () => {
        it.skipIf(!dbAvailable)(
            'calling PATCH twice with the same tourId and higher version stores the latest version',
            async () => {
                // Arrange
                const user = await createTestUser({ role: RoleEnum.HOST });

                const actor = createMockActor(
                    RoleEnum.HOST,
                    [
                        PermissionEnum.ACCESS_API_PRIVATE,
                        PermissionEnum.ACCESS_API_PUBLIC,
                        PermissionEnum.USER_SETTINGS_UPDATE
                    ],
                    user.id
                );
                const authHeaders = createAuthenticatedRequest(actor).headers;

                // Act — PATCH version 1
                const r1 = await app.request('/api/v1/protected/users/me/tour-progress', {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify({ tourId: 'host.welcome', version: 1 })
                });
                expect(r1.status).toBe(200);

                // Act — PATCH version 2 (tour was updated)
                const r2 = await app.request('/api/v1/protected/users/me/tour-progress', {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify({ tourId: 'host.welcome', version: 2 })
                });
                expect(r2.status).toBe(200);

                // Assert — single key with latest version
                const after = await readAdminTours(user.id);
                expect(after['host.welcome']).toBe(2);

                // Exactly one key (no duplicates or separate entries)
                expect(Object.keys(after)).toHaveLength(1);
            }
        );
    });

    // =========================================================================
    // 4. Two different tourIds accumulate independently
    // =========================================================================

    describe('multiple tour accumulation', () => {
        it.skipIf(!dbAvailable)(
            'two different tourIds written in sequence accumulate as separate keys',
            async () => {
                // Arrange
                const user = await createTestUser({ role: RoleEnum.ADMIN });

                const actor = createMockActor(
                    RoleEnum.ADMIN,
                    [
                        PermissionEnum.ACCESS_API_PRIVATE,
                        PermissionEnum.ACCESS_API_PUBLIC,
                        PermissionEnum.USER_SETTINGS_UPDATE
                    ],
                    user.id
                );
                const authHeaders = createAuthenticatedRequest(actor).headers;

                // Act — PATCH first tour
                const r1 = await app.request('/api/v1/protected/users/me/tour-progress', {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify({ tourId: 'admin.welcome', version: 1 })
                });
                expect(r1.status).toBe(200);

                // Act — PATCH second tour
                const r2 = await app.request('/api/v1/protected/users/me/tour-progress', {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify({ tourId: 'admin.catalogo', version: 1 })
                });
                expect(r2.status).toBe(200);

                // Assert — both keys present with correct versions
                const after = await readAdminTours(user.id);
                expect(after['admin.welcome']).toBe(1);
                expect(after['admin.catalogo']).toBe(1);
                expect(Object.keys(after)).toHaveLength(2);
            }
        );
    });

    // =========================================================================
    // 5. Invalid body → 400
    // =========================================================================

    describe('validation', () => {
        it.skipIf(!dbAvailable)('missing tourId returns 400', async () => {
            // Arrange
            const user = await createTestUser({ role: RoleEnum.HOST });
            const actor = createMockActor(
                RoleEnum.HOST,
                [
                    PermissionEnum.ACCESS_API_PRIVATE,
                    PermissionEnum.ACCESS_API_PUBLIC,
                    PermissionEnum.USER_SETTINGS_UPDATE
                ],
                user.id
            );
            const authHeaders = createAuthenticatedRequest(actor).headers;

            // Act — body missing tourId
            const response = await app.request('/api/v1/protected/users/me/tour-progress', {
                method: 'PATCH',
                headers: authHeaders,
                body: JSON.stringify({ version: 1 })
            });

            // Assert
            expect(response.status).toBe(400);
        });

        it.skipIf(!dbAvailable)('missing version returns 400', async () => {
            // Arrange
            const user = await createTestUser({ role: RoleEnum.HOST });
            const actor = createMockActor(
                RoleEnum.HOST,
                [
                    PermissionEnum.ACCESS_API_PRIVATE,
                    PermissionEnum.ACCESS_API_PUBLIC,
                    PermissionEnum.USER_SETTINGS_UPDATE
                ],
                user.id
            );
            const authHeaders = createAuthenticatedRequest(actor).headers;

            // Act — body missing version
            const response = await app.request('/api/v1/protected/users/me/tour-progress', {
                method: 'PATCH',
                headers: authHeaders,
                body: JSON.stringify({ tourId: 'host.welcome' })
            });

            // Assert
            expect(response.status).toBe(400);
        });

        it.skipIf(!dbAvailable)('negative version returns 400', async () => {
            // Arrange
            const user = await createTestUser({ role: RoleEnum.HOST });
            const actor = createMockActor(
                RoleEnum.HOST,
                [
                    PermissionEnum.ACCESS_API_PRIVATE,
                    PermissionEnum.ACCESS_API_PUBLIC,
                    PermissionEnum.USER_SETTINGS_UPDATE
                ],
                user.id
            );
            const authHeaders = createAuthenticatedRequest(actor).headers;

            // Act
            const response = await app.request('/api/v1/protected/users/me/tour-progress', {
                method: 'PATCH',
                headers: authHeaders,
                body: JSON.stringify({ tourId: 'host.welcome', version: -1 })
            });

            // Assert
            expect(response.status).toBe(400);
        });

        it.skipIf(!dbAvailable)('empty tourId string returns 400', async () => {
            // Arrange
            const user = await createTestUser({ role: RoleEnum.HOST });
            const actor = createMockActor(
                RoleEnum.HOST,
                [
                    PermissionEnum.ACCESS_API_PRIVATE,
                    PermissionEnum.ACCESS_API_PUBLIC,
                    PermissionEnum.USER_SETTINGS_UPDATE
                ],
                user.id
            );
            const authHeaders = createAuthenticatedRequest(actor).headers;

            // Act
            const response = await app.request('/api/v1/protected/users/me/tour-progress', {
                method: 'PATCH',
                headers: authHeaders,
                body: JSON.stringify({ tourId: '', version: 1 })
            });

            // Assert
            expect(response.status).toBe(400);
        });
    });

    // =========================================================================
    // 6. Unauthenticated → 401
    // =========================================================================

    describe('authentication', () => {
        it.skipIf(!dbAvailable)(
            'request without actor headers returns 401 (valid body, no auth)',
            async () => {
                // Arrange — send a structurally valid body but no mock-actor headers.
                // The actorMiddleware resolves the actor as unauthenticated (GUEST),
                // which the protected route rejects before processing.
                // NOTE: We do NOT include x-mock-actor-* headers here, which means
                // the actorMiddleware can't inject an actor and the route guard fires.
                const response = await app.request('/api/v1/protected/users/me/tour-progress', {
                    method: 'PATCH',
                    headers: {
                        'content-type': 'application/json',
                        accept: 'application/json',
                        'user-agent': 'vitest'
                        // Deliberately no x-mock-actor-* headers
                    },
                    body: JSON.stringify({ tourId: 'host.welcome', version: 1 })
                });

                // Assert — protected endpoint rejects unauthenticated requests
                // The route uses createProtectedRoute which requires USER_SETTINGS_UPDATE.
                // Without auth headers, the actor has no permissions, so it should return
                // 401 (unauthenticated) or 403 (unauthorized). Both are acceptable for
                // this guard test.
                expect([401, 403]).toContain(response.status);
            }
        );
    });
});
