/**
 * TEST:V5:13 — a banned account gets no session (AC:V5:11, DEC-AUTH-003 point 5).
 *
 * HOS-1352 V5 empties `fullAdminRole` and strips `impersonate` / `set-role`
 * from the Better Auth `admin` plugin, which leaves the plugin with ONE job:
 * rejecting the session of a banned account at sign-in. That gate lives in the
 * plugin's `databaseHooks.session.create.before` and reads `users.banned` /
 * `users.ban_expires`; it does not depend on any plugin role. This suite proves
 * it still holds end to end, through the real sign-in route and a real DB.
 *
 * Runs under vitest.config.e2e.ts via `pnpm test:e2e`.
 */
import { randomUUID } from 'node:crypto';
import { eq, sessions, users } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';
import { forceVerifyEmail } from '../../e2e/helpers/auth-helpers';
import { testDb } from '../../e2e/setup/test-database';

let app: AppOpenAPI;
// Better Auth's CSRF protection rejects mutating requests without a trusted
// Origin header. CI can use a different HOSPEDA_SITE_URL from local tests.
const trustedOrigin = () => new URL(process.env.HOSPEDA_SITE_URL ?? 'http://localhost:4321').origin;
// Generated per run: a literal password trips the pre-commit secret scan.
const testPassword = `Pw-${randomUUID()}-Aa1!`;
let testCounter = 0;

// `.env.test` sets HOSPEDA_DISABLE_AUTH=true; this suite needs the real Better
// Auth branch (see max-sessions.test.ts for the full rationale). Restored in
// `afterAll` because e2e files share one fork.
const ORIGINAL_DISABLE_AUTH = process.env.HOSPEDA_DISABLE_AUTH;

beforeAll(async () => {
    process.env.HOSPEDA_DISABLE_AUTH = 'false';
    validateApiEnv();
    app = initApp();
    await testDb.setup();
});

afterAll(async () => {
    await testDb.teardown();
    process.env.HOSPEDA_DISABLE_AUTH = ORIGINAL_DISABLE_AUTH;
});

const authHeaders = {
    'content-type': 'application/json',
    'user-agent': 'vitest',
    get origin() {
        return trustedOrigin();
    }
} as const;

/** Signs up and verifies a fresh account; returns its email and id. */
async function createVerifiedUser(): Promise<{ email: string; userId: string }> {
    testCounter += 1;
    const email = `test-banned-signin-${Date.now()}-${testCounter}@example.com`;
    const res = await app.request('/api/auth/sign-up/email', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email, password: testPassword, name: 'Banned Signin Test User' })
    });
    expect(res.status).toBeLessThan(400);
    await forceVerifyEmail({ email });

    const rows = await testDb
        .getDb()
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email));
    const userId = rows[0]?.id;
    if (!userId) throw new Error(`user ${email} was not created`);
    return { email, userId };
}

async function signIn({ email }: { readonly email: string }): Promise<Response> {
    return app.request('/api/auth/sign-in/email', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email, password: testPassword })
    });
}

async function countSessions({ userId }: { readonly userId: string }): Promise<number> {
    const rows = await testDb
        .getDb()
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, userId));
    return rows.length;
}

describe('TEST:V5:13 — a banned account does not obtain a session', () => {
    it('control: the same flow gives an unbanned account a session', async () => {
        const { email, userId } = await createVerifiedUser();

        const res = await signIn({ email });

        expect(res.status).toBe(200);
        expect(res.headers.get('set-cookie') ?? '').toContain('session_token');
        expect(await countSessions({ userId })).toBe(1);
    });

    it('rejects the sign-in of a banned account and writes no session row', async () => {
        const { email, userId } = await createVerifiedUser();
        await testDb
            .getDb()
            .update(users)
            .set({ banned: true, banReason: 'TEST:V5:13', banExpires: null })
            .where(eq(users.id, userId));

        const res = await signIn({ email });

        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.headers.get('set-cookie') ?? '').not.toContain('session_token');
        expect(await countSessions({ userId })).toBe(0);
    });
});
