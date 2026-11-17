/**
 * @file sign-out.ts
 * @description Shared browser-side sign-out used by the auth islands that
 * offer "use another account" (BETA-216). It mirrors what the account menu
 * does around `signOut()`: it drops the cached `/auth/me` snapshot, resets the
 * analytics identity and clears the theme-sync marker, so nothing of the
 * previous account survives into the next sign-in.
 */

import { resetUser } from '@/lib/analytics/umami-client';
import { clearCachedAuthMe } from '@/lib/auth-cache';
import { signOut } from '@/lib/auth-client';
import { clearThemeSyncMarker } from '@/lib/theme';

/** Result of {@link signOutAndClearClientState}. */
export interface SignOutResult {
    /** `true` when the API accepted the sign-out and the session cookie is gone. */
    readonly ok: boolean;
}

/**
 * Clears the client-side account state, then ends the Better Auth session.
 *
 * Local state is cleared first and unconditionally, so a failing network call
 * can never leave the previous account's cache behind. A failed `signOut()` is
 * reported through `ok: false` instead of being thrown, because the callers
 * must NOT present the sign-in form while the old session is still alive.
 *
 * @returns `{ ok: true }` when the session was ended, `{ ok: false }` otherwise.
 */
export async function signOutAndClearClientState(): Promise<SignOutResult> {
    try {
        clearCachedAuthMe();
        resetUser();
        clearThemeSyncMarker();
    } catch {
        // Local cleanup is best-effort; it must never block ending the session.
    }
    try {
        const result = await signOut();
        return { ok: !result?.error };
    } catch {
        return { ok: false };
    }
}
