/**
 * @file whats-new.integration.test.ts
 *
 * Integration tests for the What's New API routes with a real PostgreSQL
 * database (SPEC-175 T-019).
 *
 * Covers §12.3 + AC-17:
 *  1. Lazy-init: first GET for a user without `onboarding.whatsNew` persists
 *     baselineAt + seenIds=[] in the DB; second GET does not overwrite baselineAt.
 *  2. AC-17 coexistence: `adminTours` and other sibling keys (theme, notifications)
 *     are preserved across a PATCH whats-new-seen.
 *  3. Role filtering with real DB users (HOST vs ADMIN targeted entries).
 *  4. Locale resolution via `languageAdmin` setting (en → en content,
 *     missing-en → es fallback).
 *  5. Idempotent PATCH (same ids twice → no dupes in seenIds).
 *  6. Baseline semantics: entry with publishedAt < baselineAt is seen:true
 *     even without seenIds.
 *
 * ### Pattern
 *
 * Follows the established e2e suite pattern from SPEC-143:
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
 * ### Data injection strategy
 *
 * `whatsNewEntries` is the module-level singleton imported by the route at
 * startup. Since the suite runs in `singleFork` mode (sequential, one Node
 * process), we mutate the array in-place for each test and restore it
 * afterward. This avoids mocking the entire data module.
 *
 * @see apps/api/src/routes/whats-new/protected/getWhatsNew.ts
 * @see apps/api/src/routes/user/protected/whatsNewSeen.ts
 * @see SPEC-175 §12.3, AC-17
 */

import { eq, users } from '@repo/db';
import type { WhatsNewEntry } from '@repo/schemas';
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
// Catalog injection helpers
// ---------------------------------------------------------------------------

/** Fixed dates to make seen/unseen assertions deterministic. */
const PAST_DATE = '2020-01-01T00:00:00Z';
const FUTURE_DATE = '2099-01-01T00:00:00Z';
const MID_DATE = '2030-06-01T00:00:00Z';

const HOST_ENTRY: WhatsNewEntry = {
    id: 'test-host-feature',
    publishedAt: MID_DATE,
    highlight: true,
    title: { es: 'Para hosts', en: 'For hosts' },
    body: { es: 'Contenido para hosts.' },
    roles: ['HOST']
};

const ADMIN_ENTRY: WhatsNewEntry = {
    id: 'test-admin-feature',
    publishedAt: MID_DATE,
    highlight: true,
    title: { es: 'Para admins', en: 'For admins' },
    body: { es: 'Contenido para admins.' },
    roles: ['ADMIN', 'SUPER_ADMIN']
};

const UNIVERSAL_ENTRY: WhatsNewEntry = {
    id: 'test-universal-feature',
    publishedAt: MID_DATE,
    highlight: false,
    title: { es: 'Para todos en español', en: 'For everyone in english' },
    body: { es: 'Cuerpo en español.' }
};

const UNIVERSAL_NO_EN: WhatsNewEntry = {
    id: 'test-en-fallback',
    publishedAt: MID_DATE,
    highlight: false,
    title: { es: 'Título sin inglés' },
    body: { es: 'Solo en español.' }
};

const PAST_ENTRY: WhatsNewEntry = {
    id: 'test-past-entry',
    publishedAt: PAST_DATE,
    highlight: false,
    title: { es: 'Entrada antigua' },
    body: { es: 'Publicada antes del baseline.' }
};

const FUTURE_ENTRY: WhatsNewEntry = {
    id: 'test-future-not-seen',
    publishedAt: FUTURE_DATE,
    highlight: false,
    title: { es: 'Entrada futura' },
    body: { es: 'No vista todavía.' }
};

/**
 * Restore hook for the injected catalog. Registered by {@link injectEntries}
 * and ALWAYS invoked from `afterEach` — never from test bodies — so a failing
 * assertion can never leave the module singleton mutated for later tests.
 */
let restoreEntries: () => void = () => undefined;

/**
 * Injects entries into the module-level `whatsNewEntries` array used by the
 * route handler. Works because `singleFork: true` gives a single module
 * registry. Cleanup is automatic via the suite's `afterEach`.
 */
async function injectEntries(entries: WhatsNewEntry[]): Promise<void> {
    const mod = await import('../../../../src/data/whats-new/whats-new.js');
    const real = mod.whatsNewEntries;
    real.splice(0, real.length, ...entries);
    restoreEntries = () => {
        real.splice(0, real.length);
    };
}

// ---------------------------------------------------------------------------
// DB read helper: load settings for a user by id
// ---------------------------------------------------------------------------

async function readUserSettings(userId: string): Promise<Record<string, unknown> | null> {
    const rows = await testDb
        .getDb()
        .select({ settings: users.settings })
        .from(users)
        .where(eq(users.id, userId));
    return (rows[0]?.settings as Record<string, unknown>) ?? null;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('SPEC-175 T-019 — whats-new integration tests (real DB)', () => {
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
        restoreEntries();
        restoreEntries = () => undefined;
        if (!dbAvailable) return;
        await testDb.clean();
    });

    // =========================================================================
    // 1. Lazy-init: first GET creates baseline, second GET does not overwrite
    // =========================================================================

    describe('lazy-init baseline', () => {
        it.skipIf(!dbAvailable)(
            'first GET for a user without whatsNew state creates baselineAt + seenIds=[] in DB',
            async () => {
                // Arrange
                await injectEntries([UNIVERSAL_ENTRY]);

                const user = await createTestUser({
                    role: RoleEnum.ADMIN,
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
                    RoleEnum.ADMIN,
                    [PermissionEnum.ACCESS_API_PRIVATE, PermissionEnum.ACCESS_API_PUBLIC],
                    user.id
                );
                const authHeaders = createAuthenticatedRequest(actor).headers;

                // Verify no whatsNew state before
                const before = await readUserSettings(user.id);
                const beforeOnboarding =
                    (before?.onboarding as Record<string, unknown> | undefined) ?? {};
                expect(beforeOnboarding.whatsNew).toBeUndefined();

                // Act
                const response = await app.request('/api/v1/protected/whats-new', {
                    method: 'GET',
                    headers: authHeaders
                });

                // Assert — HTTP 200
                expect(response.status).toBe(200);
                const body = await response.json();
                expect(body.success).toBe(true);
                expect(Array.isArray(body.data.items)).toBe(true);

                // Assert — DB now has baselineAt + seenIds=[]
                const after = await readUserSettings(user.id);
                const afterOnboarding =
                    (after?.onboarding as Record<string, unknown> | undefined) ?? {};
                const whatsNewState = afterOnboarding.whatsNew as
                    | { baselineAt?: string; seenIds?: string[] }
                    | undefined;

                expect(whatsNewState).toBeDefined();
                expect(typeof whatsNewState?.baselineAt).toBe('string');
                expect(Array.isArray(whatsNewState?.seenIds)).toBe(true);
                expect(whatsNewState?.seenIds).toHaveLength(0);
            }
        );

        it.skipIf(!dbAvailable)(
            'second GET does not overwrite the already-persisted baselineAt',
            async () => {
                // Arrange
                await injectEntries([UNIVERSAL_ENTRY]);

                const user = await createTestUser({ role: RoleEnum.ADMIN });
                const actor = createMockActor(
                    RoleEnum.ADMIN,
                    [PermissionEnum.ACCESS_API_PRIVATE, PermissionEnum.ACCESS_API_PUBLIC],
                    user.id
                );
                const authHeaders = createAuthenticatedRequest(actor).headers;

                // First GET triggers lazy-init
                const r1 = await app.request('/api/v1/protected/whats-new', {
                    method: 'GET',
                    headers: authHeaders
                });
                expect(r1.status).toBe(200);

                const afterFirst = await readUserSettings(user.id);
                const whatsNew1 = (afterFirst?.onboarding as Record<string, unknown> | undefined)
                    ?.whatsNew as { baselineAt?: string } | undefined;
                const baselineAtFirst = whatsNew1?.baselineAt;

                // Small delay to ensure clock ticks if second init were to run
                await new Promise((r) => setTimeout(r, 5));

                // Act — second GET
                const r2 = await app.request('/api/v1/protected/whats-new', {
                    method: 'GET',
                    headers: authHeaders
                });
                expect(r2.status).toBe(200);

                // Assert — baselineAt unchanged
                const afterSecond = await readUserSettings(user.id);
                const whatsNew2 = (afterSecond?.onboarding as Record<string, unknown> | undefined)
                    ?.whatsNew as { baselineAt?: string } | undefined;
                expect(whatsNew2?.baselineAt).toBe(baselineAtFirst);
            }
        );
    });

    // =========================================================================
    // 2. AC-17 coexistence: sibling settings keys preserved on PATCH
    // =========================================================================

    describe('AC-17 sibling settings coexistence', () => {
        it.skipIf(!dbAvailable)(
            'PATCH whats-new-seen preserves adminTours, theme, and notifications keys',
            async () => {
                // Arrange — user has pre-existing settings with adminTours + other keys
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
                            adminTours: { 'host.welcome': 1 },
                            whatsNew: { baselineAt: PAST_DATE, seenIds: [] }
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

                // Act — PATCH to mark an entry seen
                const response = await app.request('/api/v1/protected/users/me/whats-new-seen', {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify({ ids: ['some-entry-id'] })
                });

                // Assert — HTTP success
                expect(response.status).toBe(200);
                const body = await response.json();
                expect(body.success).toBe(true);

                // Assert — DB: sibling keys intact
                const after = await readUserSettings(user.id);
                const afterSettings = after as Record<string, unknown>;
                expect(afterSettings?.theme).toBe('dark');

                const notifications = afterSettings?.notifications as
                    | Record<string, unknown>
                    | undefined;
                expect(notifications?.enabled).toBe(true);
                expect(notifications?.allowPush).toBe(true);

                const onboarding = afterSettings?.onboarding as Record<string, unknown> | undefined;
                const adminTours = onboarding?.adminTours as Record<string, unknown> | undefined;
                expect(adminTours?.['host.welcome']).toBe(1);

                // whatsNew.seenIds should contain the new id
                const whatsNew = onboarding?.whatsNew as { seenIds?: string[] } | undefined;
                expect(whatsNew?.seenIds).toContain('some-entry-id');
            }
        );
    });

    // =========================================================================
    // 3. Role filtering with real DB users
    // =========================================================================

    describe('role filtering', () => {
        it.skipIf(!dbAvailable)(
            'HOST user receives HOST-targeted entries but not ADMIN-only entries',
            async () => {
                // Arrange
                await injectEntries([HOST_ENTRY, ADMIN_ENTRY, UNIVERSAL_ENTRY]);

                const hostUser = await createTestUser({
                    role: RoleEnum.HOST,
                    settings: {
                        onboarding: { whatsNew: { baselineAt: PAST_DATE, seenIds: [] } }
                    }
                });

                const actor = createMockActor(
                    RoleEnum.HOST,
                    [PermissionEnum.ACCESS_API_PRIVATE, PermissionEnum.ACCESS_API_PUBLIC],
                    hostUser.id
                );
                const authHeaders = createAuthenticatedRequest(actor).headers;

                // Act
                const response = await app.request('/api/v1/protected/whats-new', {
                    method: 'GET',
                    headers: authHeaders
                });

                // Assert
                expect(response.status).toBe(200);
                const body = await response.json();
                const ids = body.data.items.map((i: { id: string }) => i.id);

                expect(ids).toContain(HOST_ENTRY.id);
                expect(ids).toContain(UNIVERSAL_ENTRY.id);
                expect(ids).not.toContain(ADMIN_ENTRY.id);
            }
        );

        it.skipIf(!dbAvailable)(
            'ADMIN user receives ADMIN-targeted entries but not HOST-only entries',
            async () => {
                // Arrange
                await injectEntries([HOST_ENTRY, ADMIN_ENTRY, UNIVERSAL_ENTRY]);

                const adminUser = await createTestUser({
                    role: RoleEnum.ADMIN,
                    settings: {
                        onboarding: { whatsNew: { baselineAt: PAST_DATE, seenIds: [] } }
                    }
                });

                const actor = createMockActor(
                    RoleEnum.ADMIN,
                    [PermissionEnum.ACCESS_API_PRIVATE, PermissionEnum.ACCESS_API_PUBLIC],
                    adminUser.id
                );
                const authHeaders = createAuthenticatedRequest(actor).headers;

                // Act
                const response = await app.request('/api/v1/protected/whats-new', {
                    method: 'GET',
                    headers: authHeaders
                });

                // Assert
                expect(response.status).toBe(200);
                const body = await response.json();
                const ids = body.data.items.map((i: { id: string }) => i.id);

                expect(ids).toContain(ADMIN_ENTRY.id);
                expect(ids).toContain(UNIVERSAL_ENTRY.id);
                expect(ids).not.toContain(HOST_ENTRY.id);
            }
        );
    });

    // =========================================================================
    // 4. Locale resolution via languageAdmin setting
    // =========================================================================

    describe('locale resolution', () => {
        it.skipIf(!dbAvailable)(
            'en locale returns en title when entry has en translation',
            async () => {
                // Arrange
                await injectEntries([UNIVERSAL_ENTRY]);

                const user = await createTestUser({
                    role: RoleEnum.ADMIN,
                    settings: {
                        languageAdmin: 'en',
                        onboarding: { whatsNew: { baselineAt: PAST_DATE, seenIds: [] } }
                    }
                });

                const actor = createMockActor(
                    RoleEnum.ADMIN,
                    [PermissionEnum.ACCESS_API_PRIVATE, PermissionEnum.ACCESS_API_PUBLIC],
                    user.id
                );
                const authHeaders = createAuthenticatedRequest(actor).headers;

                // Act
                const response = await app.request('/api/v1/protected/whats-new', {
                    method: 'GET',
                    headers: authHeaders
                });

                // Assert — title is English
                expect(response.status).toBe(200);
                const body = await response.json();
                const item = body.data.items.find(
                    (i: { id: string }) => i.id === UNIVERSAL_ENTRY.id
                );
                expect(item).toBeDefined();
                expect(item?.title).toBe('For everyone in english');
            }
        );

        it.skipIf(!dbAvailable)(
            'en locale falls back to es when entry has no en translation',
            async () => {
                // Arrange — entry with no en title/body
                await injectEntries([UNIVERSAL_NO_EN]);

                const user = await createTestUser({
                    role: RoleEnum.ADMIN,
                    settings: {
                        languageAdmin: 'en',
                        onboarding: { whatsNew: { baselineAt: PAST_DATE, seenIds: [] } }
                    }
                });

                const actor = createMockActor(
                    RoleEnum.ADMIN,
                    [PermissionEnum.ACCESS_API_PRIVATE, PermissionEnum.ACCESS_API_PUBLIC],
                    user.id
                );
                const authHeaders = createAuthenticatedRequest(actor).headers;

                // Act
                const response = await app.request('/api/v1/protected/whats-new', {
                    method: 'GET',
                    headers: authHeaders
                });

                // Assert — title falls back to es
                expect(response.status).toBe(200);
                const body = await response.json();
                const item = body.data.items.find(
                    (i: { id: string }) => i.id === UNIVERSAL_NO_EN.id
                );
                expect(item).toBeDefined();
                expect(item?.title).toBe('Título sin inglés');
            }
        );
    });

    // =========================================================================
    // 5. Idempotent PATCH — same ids twice → no duplicates in seenIds
    // =========================================================================

    describe('idempotent PATCH', () => {
        it.skipIf(!dbAvailable)(
            'calling PATCH twice with the same ids does not create duplicates in seenIds',
            async () => {
                // Arrange
                const user = await createTestUser({
                    role: RoleEnum.ADMIN,
                    settings: {
                        onboarding: { whatsNew: { baselineAt: PAST_DATE, seenIds: [] } }
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
                const idsToMark = ['entry-alpha', 'entry-beta'];

                // Act — PATCH twice with the same ids
                const r1 = await app.request('/api/v1/protected/users/me/whats-new-seen', {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify({ ids: idsToMark })
                });
                expect(r1.status).toBe(200);

                const r2 = await app.request('/api/v1/protected/users/me/whats-new-seen', {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify({ ids: idsToMark })
                });
                expect(r2.status).toBe(200);

                // Assert — each id appears exactly once in seenIds
                const after = await readUserSettings(user.id);
                const onboarding = (after as Record<string, unknown>)?.onboarding as
                    | Record<string, unknown>
                    | undefined;
                const whatsNew = onboarding?.whatsNew as { seenIds?: string[] } | undefined;
                const seenIds = whatsNew?.seenIds ?? [];

                for (const id of idsToMark) {
                    expect(seenIds.filter((s) => s === id)).toHaveLength(1);
                }
            }
        );
    });

    // =========================================================================
    // 6. Baseline semantics: publishedAt comparison with baselineAt
    // =========================================================================

    describe('baseline semantics', () => {
        it.skipIf(!dbAvailable)(
            'entry with publishedAt before baselineAt is returned as seen:true even with empty seenIds',
            async () => {
                // Arrange — entry published in PAST; baseline is in FUTURE
                await injectEntries([PAST_ENTRY]);

                const user = await createTestUser({
                    role: RoleEnum.ADMIN,
                    settings: {
                        onboarding: {
                            whatsNew: { baselineAt: FUTURE_DATE, seenIds: [] }
                        }
                    }
                });

                const actor = createMockActor(
                    RoleEnum.ADMIN,
                    [PermissionEnum.ACCESS_API_PRIVATE, PermissionEnum.ACCESS_API_PUBLIC],
                    user.id
                );
                const authHeaders = createAuthenticatedRequest(actor).headers;

                // Act
                const response = await app.request('/api/v1/protected/whats-new', {
                    method: 'GET',
                    headers: authHeaders
                });

                // Assert — PAST_ENTRY is seen:true (publishedAt < baselineAt)
                expect(response.status).toBe(200);
                const body = await response.json();
                const item = body.data.items.find((i: { id: string }) => i.id === PAST_ENTRY.id);
                expect(item).toBeDefined();
                expect(item?.seen).toBe(true);
            }
        );

        it.skipIf(!dbAvailable)(
            'entry with publishedAt after baselineAt and not in seenIds is returned as seen:false',
            async () => {
                // Arrange — entry published in FUTURE; baseline is in PAST
                await injectEntries([FUTURE_ENTRY]);

                const user = await createTestUser({
                    role: RoleEnum.ADMIN,
                    settings: {
                        onboarding: {
                            whatsNew: { baselineAt: PAST_DATE, seenIds: [] }
                        }
                    }
                });

                const actor = createMockActor(
                    RoleEnum.ADMIN,
                    [PermissionEnum.ACCESS_API_PRIVATE, PermissionEnum.ACCESS_API_PUBLIC],
                    user.id
                );
                const authHeaders = createAuthenticatedRequest(actor).headers;

                // Act
                const response = await app.request('/api/v1/protected/whats-new', {
                    method: 'GET',
                    headers: authHeaders
                });

                // Assert — FUTURE_ENTRY is seen:false
                expect(response.status).toBe(200);
                const body = await response.json();
                const item = body.data.items.find((i: { id: string }) => i.id === FUTURE_ENTRY.id);
                expect(item).toBeDefined();
                expect(item?.seen).toBe(false);
                expect(body.data.unseenCount).toBeGreaterThanOrEqual(1);
            }
        );
    });
});
