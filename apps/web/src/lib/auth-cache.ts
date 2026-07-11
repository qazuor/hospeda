/**
 * @file auth-cache.ts
 * @description Shared client-side `/auth/me` cache: constants, types, and
 * the read/write/fetch functions. `UserMenu.client.tsx` was the original
 * producer (populating the cache after first hydration); the rest of the
 * client islands (`MobileMenu.client.tsx`, `NewsletterForm.client.tsx`,
 * `AuthedPreferenceSync.client.tsx`, `auth-client.ts`) consume it to
 * short-circuit `/auth/me` fetches.
 *
 * Centralising the cache key, TTL, and fetch/parse logic in a single module
 * prevents the silent drift that happens when they're duplicated across
 * files: a rename or response-shape change in one place would otherwise
 * leave the others reading a stale/incompatible snapshot.
 *
 * Invalidated by `refreshBetterAuthSession()` after operations that mutate
 * the underlying user record (e.g. profile completion).
 */

import { getApiUrl } from '@/lib/env';

/**
 * sessionStorage key under which the `/auth/me` snapshot is cached.
 *
 * Producers write `{ isAuthenticated, user, permissions, role, cachedAt }`
 * as JSON via `writeCachedAuthMe`. Consumers read and TTL-check via
 * `readCachedAuthMe` (or, for the minimal user-id-only case, their own
 * narrow parse — see `AuthedPreferenceSync.client.tsx`).
 */
export const AUTH_ME_CACHE_KEY = 'authMeSnapshot' as const;

/** Cache TTL — see `readCachedAuthMe` for the expiry check. */
export const AUTH_ME_CACHE_TTL_MS = 60 * 1000;

/** Minimal user shape carried in the `/auth/me` snapshot. */
export interface AuthMeUser {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly avatarUrl?: string;
}

/** Full `/auth/me` snapshot cached in `sessionStorage`. */
export interface AuthMeSnapshot {
    readonly isAuthenticated: boolean;
    readonly user: AuthMeUser | null;
    readonly permissions: ReadonlyArray<string>;
    /** Actor role (e.g. USER, HOST, ADMIN). Null for guests. Fed to PostHog. */
    readonly role: string | null;
    readonly cachedAt: number;
}

/**
 * Reads the cached `/auth/me` snapshot from `sessionStorage`, if present and
 * still within `AUTH_ME_CACHE_TTL_MS`.
 *
 * @returns The cached snapshot, or `null` if absent, expired, or unparsable.
 */
export function readCachedAuthMe(): AuthMeSnapshot | null {
    try {
        const raw = sessionStorage.getItem(AUTH_ME_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as AuthMeSnapshot;
        if (Date.now() - parsed.cachedAt > AUTH_ME_CACHE_TTL_MS) return null;
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Writes a `/auth/me` snapshot to `sessionStorage`. Silently no-ops on
 * quota-exceeded or unavailable storage.
 *
 * @param snapshot - The snapshot to persist.
 */
export function writeCachedAuthMe(snapshot: AuthMeSnapshot): void {
    try {
        sessionStorage.setItem(AUTH_ME_CACHE_KEY, JSON.stringify(snapshot));
    } catch {
        // Quota exceeded or unavailable — ignore.
    }
}

/** Raw response shape of `GET /api/v1/public/auth/me`. */
interface AuthMeResponseBody {
    readonly data?: {
        readonly actor?: {
            readonly id?: string;
            readonly name?: string;
            readonly email?: string;
            readonly image?: string;
            readonly role?: string;
            readonly permissions?: ReadonlyArray<string>;
        };
        readonly isAuthenticated?: boolean;
    };
}

/** Input for `fetchAuthMe`. */
export interface FetchAuthMeParams {
    /** Base API URL (from `getApiUrl()`). */
    readonly apiUrl?: string;
}

/**
 * Fetches the current session from `GET /api/v1/public/auth/me` and maps it
 * to an `AuthMeSnapshot`. Never throws — a non-`ok` response resolves to a
 * guest snapshot so callers can treat network/auth failures uniformly.
 *
 * @param params - `{ apiUrl }` (RO-RO). Defaults to `getApiUrl()` when omitted.
 * @returns The resolved `AuthMeSnapshot` (not yet cached — call `writeCachedAuthMe` to persist it).
 */
export async function fetchAuthMe({ apiUrl }: FetchAuthMeParams = {}): Promise<AuthMeSnapshot> {
    const resolvedApiUrl = apiUrl ?? getApiUrl();
    const response = await fetch(`${resolvedApiUrl}/api/v1/public/auth/me`, {
        credentials: 'include'
    });
    if (!response.ok) {
        return {
            isAuthenticated: false,
            user: null,
            permissions: [],
            role: null,
            cachedAt: Date.now()
        };
    }
    const json = (await response.json()) as AuthMeResponseBody;

    const actor = json.data?.actor;
    const isAuthenticated = json.data?.isAuthenticated === true;

    return {
        isAuthenticated,
        user:
            isAuthenticated && actor?.id
                ? {
                      id: actor.id,
                      name: actor.name ?? '',
                      email: actor.email ?? '',
                      // Map actor.image → avatarUrl so the navbar avatar
                      // stays in sync after the post-mount /auth/me refresh
                      // (otherwise OAuth users would flicker from the
                      // SSR-provided picture back to initials after ~1s,
                      // mirroring the name flicker fixed in PR #1111).
                      avatarUrl:
                          typeof actor.image === 'string' && actor.image.length > 0
                              ? actor.image
                              : undefined
                  }
                : null,
        permissions: actor?.permissions ?? [],
        role: isAuthenticated && actor?.role ? actor.role : null,
        cachedAt: Date.now()
    };
}
