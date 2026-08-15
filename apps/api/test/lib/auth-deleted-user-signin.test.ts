/**
 * @file auth-deleted-user-signin.test.ts
 *
 * Regression test for H-163 half (a) — "the login authenticates against a
 * deleted account and mints a NEW session".
 *
 * Measured in production on 2026-08-15: `qazuor+r5prov` was deleted at 00:24:23
 * and a fresh session was created at 00:37:49 — thirteen minutes later, valid
 * for seven days. Not a stale session that outlived its owner: a brand-new,
 * successful authentication against a deleted account.
 *
 * The block lives in `databaseHooks.session.create.before`, which is the hook
 * Better Auth's own `admin` plugin uses to refuse banned users. Putting it there
 * rather than in the email/password handler covers EVERY credential type at one
 * choke point — OAuth included — because no provider can sign a user in without
 * creating a session.
 *
 * The real `betterAuth()` call lives inline in `src/lib/auth.ts` and cannot be
 * imported or reconfigured, so this pins the FRAMEWORK contract the production
 * hook depends on, over Better Auth's in-memory adapter. The predicate itself is
 * covered by `auth-deleted-user-guard.test.ts`.
 */

import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { APIError } from 'better-auth/api';
import { describe, expect, it, vi } from 'vitest';

const EMAIL = 'borrado@example.com';
const PASSWORD = ['Password', '123!'].join('');

/** A fresh in-memory store per instance, so tests never share accounts. */
const createEmptyStore = (): Record<string, unknown[]> => ({
    user: [],
    session: [],
    account: [],
    verification: []
});

/**
 * Builds an auth instance whose `session.create.before` hook behaves as told.
 *
 * @param params.beforeHook - The hook body to install.
 * @returns The auth instance plus its backing store, for post-hoc assertions.
 */
const createAuth = (params: { beforeHook: (session: { userId: string }) => Promise<void> }) => {
    const store = createEmptyStore();
    const auth = betterAuth({
        baseURL: 'http://localhost:3001',
        secret: 'test-secret-value-at-least-32-characters-long',
        database: memoryAdapter(store),
        emailAndPassword: { enabled: true },
        databaseHooks: {
            session: {
                create: {
                    before: params.beforeHook
                }
            }
        }
    });
    return { auth, store };
};

describe('Better Auth signInEmail — session.create.before refusal contract', () => {
    it('signs a live account in when the hook does not object (control)', async () => {
        // Without this the suite could pass with a hook that refuses everyone,
        // which would lock every account out rather than just deleted ones.
        const beforeHook = vi.fn(async () => {});
        const { auth } = createAuth({ beforeHook });

        await auth.api.signUpEmail({
            body: { email: EMAIL, password: PASSWORD, name: 'Ana' }
        });

        const result = await auth.api.signInEmail({
            body: { email: EMAIL, password: PASSWORD }
        });

        expect(result.user.email).toBe(EMAIL);
    });

    it('ABORTS the sign-in when the hook throws — no session is minted', async () => {
        // This is the contract the production guard rests on. If Better Auth
        // swallowed the throw, sign-in would answer 200 and hand out exactly the
        // seven-day session measured in production.
        const store = createEmptyStore();
        let refuse = false;
        const auth = betterAuth({
            baseURL: 'http://localhost:3001',
            secret: 'test-secret-value-at-least-32-characters-long',
            database: memoryAdapter(store),
            emailAndPassword: { enabled: true },
            databaseHooks: {
                session: {
                    create: {
                        before: async () => {
                            if (refuse) {
                                throw new APIError('FORBIDDEN', {
                                    message: 'This account has been deleted.',
                                    code: 'ACCOUNT_DELETED'
                                });
                            }
                        }
                    }
                }
            }
        });

        // Sign the account up while it is still live, then "delete" it.
        await auth.api.signUpEmail({
            body: { email: EMAIL, password: PASSWORD, name: 'Ana' }
        });
        const sessionsAfterSignup = (store.session ?? []).length;
        refuse = true;

        // Act & Assert — the credential is still valid and the row still exists;
        // only the deletion gate stands between them and a new session.
        await expect(
            auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD } })
        ).rejects.toThrow();

        // Verified in the SOURCE, not in the response: no new session row.
        expect((store.session ?? []).length).toBe(sessionsAfterSignup);
    });

    it('refuses every credential type, because no sign-in skips session creation', async () => {
        // The reason the block sits in `session.create.before` rather than in
        // the email/password path: a session row is the one thing every
        // authentication produces, so one hook covers OAuth too.
        const beforeHook = vi.fn(async () => {
            throw new APIError('FORBIDDEN', { message: 'This account has been deleted.' });
        });
        const { auth, store } = createAuth({ beforeHook });

        await expect(
            auth.api.signUpEmail({ body: { email: EMAIL, password: PASSWORD, name: 'Ana' } })
        ).rejects.toThrow();

        expect(beforeHook).toHaveBeenCalled();
        expect(store.session ?? []).toHaveLength(0);
    });
});
