/**
 * Integration tests for the social credential vault round-trip (HOS-64 G-4, T-035).
 *
 * Mirrors `test/integration/ai/vault-roundtrip.test.ts`. Exercises the full
 * HTTP → service → DB → decrypt cycle through the REAL admin routes mounted
 * in `initApp()`:
 *
 *   GET    /api/v1/admin/social/credentials              — list (masked)
 *   POST   /api/v1/admin/social/credentials               — create
 *   POST   /api/v1/admin/social/credentials/:key/rotate   — rotate
 *   PATCH  /api/v1/admin/social/credentials/:key          — update metadata
 *   DELETE /api/v1/admin/social/credentials/:key           — soft-delete
 *
 * Guarantees:
 *   - Plaintext secret never appears in any DB column after creation.
 *   - `getDecryptedSocialCredential` round-trips to the exact original plaintext.
 *   - Exactly one `social_credential_audit` row is written per mutation (AC-5).
 *   - No HTTP response ever contains ciphertext/iv/authTag (AC-6).
 *   - Covers all 4 fixed keys.
 *
 * Auth: mock-actor header injection (NODE_ENV=test + HOSPEDA_ALLOW_MOCK_ACTOR=true).
 * DB:   testDb.setup() / testDb.clean() / testDb.teardown() for full isolation.
 *
 * Vault key: `HOSPEDA_SOCIAL_VAULT_MASTER_KEY` lives in `.env.test`, loaded by
 * vitest before this file is evaluated — same as `HOSPEDA_AI_VAULT_MASTER_KEY`.
 *
 * @module test/integration/social/social-credential-vault-roundtrip
 */

import { getDb, socialCredentialAudit, socialCredentials } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import {
    getDecryptedSocialCredential,
    type SocialCredentialKey
} from '../../../src/services/social-credential-vault.service';
import { validateApiEnv } from '../../../src/utils/env';
import { createTestUser } from '../../e2e/setup/seed-helpers';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FAKE_PLAINTEXT = 'fake-secret-value-1234567890abcdef';
const FAKE_ROTATED_PLAINTEXT = 'fake-rotated-secret-9876543210fedcba';

const TEST_KEY: SocialCredentialKey = 'make_webhook_url';
const ALL_KEYS: readonly SocialCredentialKey[] = [
    'make_webhook_url',
    'make_api_key',
    'ai_social_key',
    'operator_pin'
];

const BASE_PATH = '/api/v1/admin/social/credentials';

// ---------------------------------------------------------------------------
// Actor helpers
// ---------------------------------------------------------------------------

/**
 * `social_credential_audit.actor_id` is a real FK to `users.id` (ON DELETE SET
 * NULL, but still enforced on INSERT). A random UUID with no matching user row
 * fails every mutation with a foreign-key-violation 500 — this is the same
 * root cause as the pre-existing failures in `test/integration/ai/vault-roundtrip.test.ts`
 * (see engram `discovery/pre-existing-500-in-ai-vault-roundtrip-e2e-test`).
 * Real `createTestUser()` rows are seeded fresh in `beforeEach` (below) instead,
 * since `testDb.clean()` in `afterEach` truncates `users` between tests.
 */
type TestActor = { id: string; role: string; permissions: readonly string[] };

function makeHeaders(actor: TestActor, extra: Record<string, string> = {}): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        accept: 'application/json',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions),
        ...extra
    };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Social credential vault round-trip (HOS-64 G-4, T-035)', () => {
    let app: ReturnType<typeof initApp>;
    let adminActorId: string;
    let adminActor: TestActor;
    let nonAdminActor: TestActor;

    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // Real user rows — required for the actor_id FK on social_credential_audit.
    // Re-seeded before every test since afterEach truncates `users`.
    beforeEach(async () => {
        const adminUser = await createTestUser({
            role: RoleEnum.SUPER_ADMIN,
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.SOCIAL_SETTINGS_MANAGE
            ]
        });
        adminActorId = adminUser.id;
        adminActor = {
            id: adminUser.id,
            role: RoleEnum.SUPER_ADMIN,
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.SOCIAL_SETTINGS_MANAGE
            ]
        };

        const nonAdminUser = await createTestUser({
            role: RoleEnum.USER,
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
        });
        nonAdminActor = {
            id: nonAdminUser.id,
            role: RoleEnum.USER,
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN] // intentionally no SOCIAL_SETTINGS_MANAGE
        };
    });

    // -------------------------------------------------------------------------
    // Security: anon → 401/400, non-admin → 403
    // -------------------------------------------------------------------------

    describe('security', () => {
        it('returns 400/401 when no mock-actor headers are present', async () => {
            const res = await app.request(BASE_PATH, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ key: TEST_KEY, plaintext: FAKE_PLAINTEXT })
            });
            expect([400, 401]).toContain(res.status);
        });

        it('returns 403 when actor lacks SOCIAL_SETTINGS_MANAGE permission', async () => {
            const res = await app.request(BASE_PATH, {
                method: 'POST',
                headers: makeHeaders(nonAdminActor),
                body: JSON.stringify({ key: TEST_KEY, plaintext: FAKE_PLAINTEXT })
            });
            expect(res.status).toBe(403);
        });
    });

    // -------------------------------------------------------------------------
    // Create — round-trip + audit + no plaintext leakage
    // -------------------------------------------------------------------------

    describe('create credential', () => {
        it('encrypts the secret at rest — plaintext never appears in any DB column', async () => {
            const res = await app.request(BASE_PATH, {
                method: 'POST',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({
                    key: TEST_KEY,
                    plaintext: FAKE_PLAINTEXT,
                    label: 'integration-test-webhook'
                })
            });

            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toHaveProperty('id');
            expect(body.data).toHaveProperty('key', TEST_KEY);
            // The create response never contains the plaintext or ciphertext.
            expect(JSON.stringify(body)).not.toContain(FAKE_PLAINTEXT);
            expect(body.data).not.toHaveProperty('ciphertext');
            expect(body.data).not.toHaveProperty('iv');
            expect(body.data).not.toHaveProperty('authTag');

            const db = getDb();
            const rows = await db
                .select()
                .from(socialCredentials)
                .where(
                    and(eq(socialCredentials.key, TEST_KEY), isNull(socialCredentials.deletedAt))
                )
                .limit(1);

            expect(rows).toHaveLength(1);
            const row = rows[0];
            if (!row) throw new Error('Expected a credential row');

            expect(row.ciphertext.length).toBeGreaterThan(0);
            expect(row.iv.length).toBeGreaterThan(0);
            expect(row.authTag.length).toBeGreaterThan(0);

            const rowJson = JSON.stringify(row);
            expect(rowJson).not.toContain(FAKE_PLAINTEXT);
        });

        it('round-trips: getDecryptedSocialCredential returns the exact original plaintext', async () => {
            const res = await app.request(BASE_PATH, {
                method: 'POST',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ key: TEST_KEY, plaintext: FAKE_PLAINTEXT })
            });
            expect(res.status).toBe(201);

            const decryptResult = await getDecryptedSocialCredential({ key: TEST_KEY });
            expect(decryptResult.error).toBeUndefined();
            expect(decryptResult.data?.plaintext).toBe(FAKE_PLAINTEXT);
        });

        it('writes exactly one audit row with action "created" and the correct actorId', async () => {
            const res = await app.request(BASE_PATH, {
                method: 'POST',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ key: TEST_KEY, plaintext: FAKE_PLAINTEXT })
            });
            expect(res.status).toBe(201);

            const db = getDb();
            const auditRows = await db
                .select()
                .from(socialCredentialAudit)
                .where(
                    and(
                        eq(socialCredentialAudit.key, TEST_KEY),
                        eq(socialCredentialAudit.action, 'created')
                    )
                );

            expect(auditRows).toHaveLength(1);
            const auditRow = auditRows[0];
            if (!auditRow) throw new Error('Expected an audit row');
            expect(auditRow.actorId).toBe(adminActorId);
            expect(auditRow.key).toBe(TEST_KEY);
        });

        it('returns 422/400 when an active credential already exists for the key', async () => {
            const first = await app.request(BASE_PATH, {
                method: 'POST',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ key: TEST_KEY, plaintext: FAKE_PLAINTEXT })
            });
            expect(first.status).toBe(201);

            const second = await app.request(BASE_PATH, {
                method: 'POST',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ key: TEST_KEY, plaintext: 'another-secret-value' })
            });
            expect([400, 422]).toContain(second.status);
        });

        it.each(ALL_KEYS)('creates and round-trips key "%s"', async (key) => {
            const res = await app.request(BASE_PATH, {
                method: 'POST',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ key, plaintext: `${FAKE_PLAINTEXT}-${key}` })
            });
            expect(res.status).toBe(201);

            const decryptResult = await getDecryptedSocialCredential({ key });
            expect(decryptResult.data?.plaintext).toBe(`${FAKE_PLAINTEXT}-${key}`);
        });
    });

    // -------------------------------------------------------------------------
    // Rotate — new plaintext round-trip + audit row
    // -------------------------------------------------------------------------

    describe('rotate credential', () => {
        it('rotate: decrypt returns NEW value, exactly one "rotated" audit row is written', async () => {
            const createRes = await app.request(BASE_PATH, {
                method: 'POST',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ key: TEST_KEY, plaintext: FAKE_PLAINTEXT })
            });
            expect(createRes.status).toBe(201);

            const rotateRes = await app.request(`${BASE_PATH}/${TEST_KEY}/rotate`, {
                method: 'POST',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ newPlaintext: FAKE_ROTATED_PLAINTEXT })
            });
            expect([200, 201]).toContain(rotateRes.status);
            const rotateBody = await rotateRes.json();
            expect(rotateBody.success).toBe(true);
            expect(rotateBody.data.key).toBe(TEST_KEY);
            expect(JSON.stringify(rotateBody)).not.toContain(FAKE_ROTATED_PLAINTEXT);

            const decryptResult = await getDecryptedSocialCredential({ key: TEST_KEY });
            expect(decryptResult.data?.plaintext).toBe(FAKE_ROTATED_PLAINTEXT);
            expect(decryptResult.data?.plaintext).not.toBe(FAKE_PLAINTEXT);

            const db = getDb();
            const rotateAuditRows = await db
                .select()
                .from(socialCredentialAudit)
                .where(
                    and(
                        eq(socialCredentialAudit.key, TEST_KEY),
                        eq(socialCredentialAudit.action, 'rotated')
                    )
                );
            expect(rotateAuditRows).toHaveLength(1);
            expect(rotateAuditRows[0]?.actorId).toBe(adminActorId);
        });

        it('returns 404 when rotating a non-existent (never-created) key', async () => {
            const res = await app.request(`${BASE_PATH}/${TEST_KEY}/rotate`, {
                method: 'POST',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ newPlaintext: FAKE_ROTATED_PLAINTEXT })
            });
            expect(res.status).toBe(404);
        });
    });

    // -------------------------------------------------------------------------
    // Update metadata — label only, no secret change, one audit row
    // -------------------------------------------------------------------------

    describe('update credential metadata', () => {
        it('updates the label without touching the encrypted secret, one "updated" audit row', async () => {
            const createRes = await app.request(BASE_PATH, {
                method: 'POST',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ key: TEST_KEY, plaintext: FAKE_PLAINTEXT, label: 'old' })
            });
            expect(createRes.status).toBe(201);

            const updateRes = await app.request(`${BASE_PATH}/${TEST_KEY}`, {
                method: 'PATCH',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ label: 'new-label' })
            });
            expect(updateRes.status).toBe(200);
            const updateBody = await updateRes.json();
            expect(updateBody.data.key).toBe(TEST_KEY);

            // Secret is unchanged.
            const decryptResult = await getDecryptedSocialCredential({ key: TEST_KEY });
            expect(decryptResult.data?.plaintext).toBe(FAKE_PLAINTEXT);

            // The list response now reflects the new label, masked.
            const listRes = await app.request(BASE_PATH, {
                method: 'GET',
                headers: makeHeaders(adminActor)
            });
            const listBody = await listRes.json();
            const item = listBody.data.items.find((i: { key: string }) => i.key === TEST_KEY);
            expect(item?.label).toBe('new-label');

            const db = getDb();
            const updateAuditRows = await db
                .select()
                .from(socialCredentialAudit)
                .where(
                    and(
                        eq(socialCredentialAudit.key, TEST_KEY),
                        eq(socialCredentialAudit.action, 'updated')
                    )
                );
            expect(updateAuditRows).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    // Delete — soft-delete, one audit row, 404 on re-delete
    // -------------------------------------------------------------------------

    describe('delete credential', () => {
        it('soft-deletes the credential, one "deleted" audit row, list omits it by default', async () => {
            const createRes = await app.request(BASE_PATH, {
                method: 'POST',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ key: TEST_KEY, plaintext: FAKE_PLAINTEXT })
            });
            expect(createRes.status).toBe(201);

            const deleteRes = await app.request(`${BASE_PATH}/${TEST_KEY}`, {
                method: 'DELETE',
                headers: makeHeaders(adminActor)
            });
            expect(deleteRes.status).toBe(200);
            const deleteBody = await deleteRes.json();
            expect(deleteBody.data.key).toBe(TEST_KEY);

            const listRes = await app.request(BASE_PATH, {
                method: 'GET',
                headers: makeHeaders(adminActor)
            });
            const listBody = await listRes.json();
            expect(listBody.data.items.some((i: { key: string }) => i.key === TEST_KEY)).toBe(
                false
            );

            const db = getDb();
            const deleteAuditRows = await db
                .select()
                .from(socialCredentialAudit)
                .where(
                    and(
                        eq(socialCredentialAudit.key, TEST_KEY),
                        eq(socialCredentialAudit.action, 'deleted')
                    )
                );
            expect(deleteAuditRows).toHaveLength(1);
        });

        it('returns 404 when deleting a non-existent (never-created) key', async () => {
            const res = await app.request(`${BASE_PATH}/${TEST_KEY}`, {
                method: 'DELETE',
                headers: makeHeaders(adminActor)
            });
            expect(res.status).toBe(404);
        });
    });

    // -------------------------------------------------------------------------
    // List — masked shape, no ciphertext/iv/authTag/plaintext (AC-6)
    // -------------------------------------------------------------------------

    describe('list credentials', () => {
        it('returns masked items — never ciphertext/iv/authTag/plaintext for any of the 4 keys', async () => {
            for (const key of ALL_KEYS) {
                const res = await app.request(BASE_PATH, {
                    method: 'POST',
                    headers: makeHeaders(adminActor),
                    body: JSON.stringify({ key, plaintext: `${FAKE_PLAINTEXT}-${key}` })
                });
                expect(res.status).toBe(201);
            }

            const listRes = await app.request(BASE_PATH, {
                method: 'GET',
                headers: makeHeaders(adminActor)
            });
            expect(listRes.status).toBe(200);
            const listBody = await listRes.json();

            expect(listBody.data.items).toHaveLength(ALL_KEYS.length);
            const bodyJson = JSON.stringify(listBody);
            expect(bodyJson).not.toContain('ciphertext');
            expect(bodyJson).not.toContain('authTag');
            expect(bodyJson).not.toContain(FAKE_PLAINTEXT);
            for (const item of listBody.data.items) {
                expect(item).not.toHaveProperty('ciphertext');
                expect(item).not.toHaveProperty('iv');
                expect(item).not.toHaveProperty('authTag');
            }
        });
    });
});
