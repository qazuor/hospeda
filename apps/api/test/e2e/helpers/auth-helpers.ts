import { eq, users } from '@repo/db';
import { testDb } from '../setup/test-database';

/**
 * Deterministically marks a freshly signed-up user's email as verified in the
 * test database.
 *
 * The API is configured with `requireEmailVerification: true`, and the
 * `sendVerificationEmail` hook in `src/lib/auth.ts` auto-verifies users in
 * non-production environments when no mailer key is configured. That auto-verify
 * runs fire-and-forget (`void (async () => { ... })()`) as a timing-attack
 * mitigation, so a sign-in issued immediately after sign-up frequently races
 * ahead of the `emailVerified = true` commit and gets rejected with
 * `EMAIL_NOT_VERIFIED` (HTTP 403), leaving no session behind.
 *
 * Integration tests call this helper right after sign-up (and before any
 * sign-in) to remove that race deterministically, instead of depending on the
 * fire-and-forget hook's timing.
 *
 * @param params - Object with the `email` of the user to verify.
 * @returns Resolves once the user row has been flipped to verified.
 */
export async function forceVerifyEmail({ email }: { readonly email: string }): Promise<void> {
    const db = testDb.getDb();
    await db.update(users).set({ emailVerified: true }).where(eq(users.email, email));
}
