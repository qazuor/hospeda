/**
 * @file auth-signup-hook-abort.test.ts
 *
 * Pins the ONE Better Auth behaviour `grantBaselineUserRole` depends on and
 * that its own unit tests cannot observe (HOS-296).
 *
 * `auth-signup-baseline-role.test.ts` proves the helper deletes the account and
 * rethrows when the grant fails. That is only useful if a throw from
 * `databaseHooks.user.create.after` actually ABORTS `signUpEmail` — if Better
 * Auth swallowed it, signup would return 200 for an account the helper just
 * deleted, which is strictly worse than the bug it fixes.
 *
 * The real `betterAuth()` call lives inline in `src/lib/auth.ts` and cannot be
 * imported or reconfigured, so this constructs an equivalent instance over
 * Better Auth's in-memory adapter — no database, no `@repo/db`. What is pinned
 * is the FRAMEWORK contract, which is exactly the untested assumption; the
 * hook's own logic stays covered by the sibling unit test.
 */

import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { describe, expect, it, vi } from 'vitest';

const EMAIL = 'ana@example.com';
const PASSWORD = 'Password123!';

/** A fresh in-memory store per instance, so tests never share accounts. */
const createEmptyStore = (): Record<string, unknown[]> => ({
    user: [],
    session: [],
    account: [],
    verification: []
});

/**
 * Builds an auth instance whose `user.create.after` hook behaves as instructed.
 *
 * @param params.afterHook - The hook body to install.
 * @returns The auth instance plus its backing store, for post-hoc assertions.
 */
const createAuth = (params: { afterHook: (user: { id: string }) => Promise<void> }) => {
    const store = createEmptyStore();
    const auth = betterAuth({
        baseURL: 'http://localhost:3001',
        secret: 'test-secret-value-at-least-32-characters-long',
        database: memoryAdapter(store),
        emailAndPassword: { enabled: true },
        databaseHooks: {
            user: {
                create: {
                    after: params.afterHook
                }
            }
        }
    });
    return { auth, store };
};

describe('Better Auth signUpEmail — user.create.after abort contract', () => {
    it('resolves normally when the after hook succeeds (control)', async () => {
        const afterHook = vi.fn(async () => {});
        const { auth, store } = createAuth({ afterHook });

        const result = await auth.api.signUpEmail({
            body: { email: EMAIL, password: PASSWORD, name: 'Ana' }
        });

        expect(afterHook).toHaveBeenCalledTimes(1);
        expect(result.user.email).toBe(EMAIL);
        expect(store.user ?? []).toHaveLength(1);
    });

    it('ABORTS signUpEmail when the after hook throws — the caller never gets a 200', async () => {
        // This is the assumption `grantBaselineUserRole` rests on: it rethrows
        // the grant error after deleting the account, and that rethrow has to
        // reach the client as a failure. A swallowed throw would return success
        // for an account that no longer exists.
        const failure = new Error('grant failed');
        const { auth } = createAuth({
            afterHook: async () => {
                throw failure;
            }
        });

        await expect(
            auth.api.signUpEmail({
                body: { email: EMAIL, password: PASSWORD, name: 'Ana' }
            })
        ).rejects.toThrow();
    });

    it('DOES persist a session row before the throw — which is why the compensating DELETE matters', async () => {
        // Discovered here, not assumed: Better Auth writes the session BEFORE
        // `user.create.after` runs, so aborting signup does not unwind it. The
        // row is not returned to the caller (the call rejects), but it exists.
        //
        // `grantBaselineUserRole`'s compensating DELETE is what reaps it:
        // `sessions.user_id` is `ON DELETE cascade` (see
        // `packages/db/src/schemas/user/session.dbschema.ts`), so removing the
        // `users` row takes the session and the `account` row with it. This is
        // the concrete reason log-and-continue was the wrong choice — it would
        // have left a live session on a hatless account.
        const { auth, store } = createAuth({
            afterHook: async () => {
                throw new Error('grant failed');
            }
        });

        await expect(
            auth.api.signUpEmail({
                body: { email: EMAIL, password: PASSWORD, name: 'Ana' }
            })
        ).rejects.toThrow();

        const createdUsers = (store.user ?? []) as { id: string }[];
        const sessions = (store.session ?? []) as { userId: string }[];

        const createdUserId = createdUsers[0]?.id;
        expect(createdUserId).toBeTruthy();
        // Every persisted session belongs to the account the DELETE removes, so
        // the cascade leaves nothing behind.
        expect(sessions.length).toBeGreaterThan(0);
        for (const session of sessions) {
            expect(session.userId).toBe(createdUserId);
        }
    });
});
