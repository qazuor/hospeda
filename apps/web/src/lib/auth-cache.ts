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
 * Producers write `{ isAuthenticated, user, permissions, roles, cachedAt }`
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
    /**
     * Every role the actor holds (e.g. `['USER', 'HOST', 'COMMERCE_OWNER']`).
     * Empty for guests. HOS-296 replaced the former `role` scalar: an account
     * can wear several hats and there is no derived "primary role", so
     * consumers must ask `roles.includes(X)`.
     */
    readonly roles: ReadonlyArray<string>;
    readonly cachedAt: number;
}

/**
 * Reads the cached `/auth/me` snapshot from `sessionStorage`, if present,
 * still within `AUTH_ME_CACHE_TTL_MS`, AND shaped like the current schema.
 *
 * **Why the shape check.** `sessionStorage` outlives a deploy: a tab opened
 * before HOS-296 holds a snapshot with the old `role: string | null` scalar
 * and NO `roles` array. Trusting it blind would hand consumers
 * `roles === undefined` and blow up the first `roles.includes(...)` gate.
 * A snapshot that fails the check is treated exactly like a cache miss, so
 * the caller refetches `/auth/me` and rewrites it in the current shape.
 *
 * @returns The cached snapshot, or `null` if absent, expired, unparsable, or
 *   written by an incompatible (older) bundle.
 */
export function readCachedAuthMe(): AuthMeSnapshot | null {
    try {
        const raw = sessionStorage.getItem(AUTH_ME_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as AuthMeSnapshot;
        if (typeof parsed?.cachedAt !== 'number') return null;
        if (Date.now() - parsed.cachedAt > AUTH_ME_CACHE_TTL_MS) return null;
        if (!Array.isArray(parsed.roles) || !Array.isArray(parsed.permissions)) return null;
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
            /**
             * HOS-296: the actor's role SET. Replaces the former `role`
             * scalar, which no longer exists in the payload — reading it would
             * be silently `undefined` with no compile error (spec §7.2).
             */
            readonly roles?: ReadonlyArray<string>;
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
 * Shared in-flight `/auth/me` request, if one is currently pending.
 *
 * `UserMenu.client.tsx` and `MobileMenu.client.tsx` both hydrate `client:load`
 * and each runs its own mount effect, so on a cold page load (empty
 * `sessionStorage` cache) they would fire two identical `GET /auth/me`
 * requests in parallel. The post-write cache (`writeCachedAuthMe`) can't
 * dedup them because it only populates after a response resolves. Sharing a
 * single in-flight promise collapses concurrent callers onto one request; it
 * is cleared once settled so a later cold call (after the cache TTL lapses)
 * fetches fresh. (HOS-160 lever D.)
 */
let inFlightAuthMe: Promise<AuthMeSnapshot> | null = null;

/**
 * TEST-ONLY: clears the shared in-flight promise. Vitest reuses the module
 * across tests, so a test that renders an island with a deliberately-pending
 * `/auth/me` fetch would otherwise leave `inFlightAuthMe` set, making every
 * following test reuse that stale promise (and never call `fetch`). The global
 * `afterEach` in `test/setup.ts` calls this to isolate tests. No-op cost in prod.
 */
export function resetInFlightAuthMe(): void {
    inFlightAuthMe = null;
}

/**
 * Fetches the current session from `GET /api/v1/public/auth/me` and maps it
 * to an `AuthMeSnapshot`. Never throws — a non-`ok` response resolves to a
 * guest snapshot so callers can treat network/auth failures uniformly.
 *
 * Concurrent callers share a single in-flight request (see `inFlightAuthMe`),
 * so two islands hydrating in the same tick issue only one network request.
 *
 * @param params - `{ apiUrl }` (RO-RO). Defaults to `getApiUrl()` when omitted.
 * @returns The resolved `AuthMeSnapshot` (not yet cached — call `writeCachedAuthMe` to persist it).
 */
export async function fetchAuthMe(params: FetchAuthMeParams = {}): Promise<AuthMeSnapshot> {
    if (inFlightAuthMe) return inFlightAuthMe;

    const request = performAuthMeFetch(params);
    inFlightAuthMe = request;
    try {
        return await request;
    } finally {
        // Only clear if still ours — guards against a later request's slot
        // being wiped by this one's late settlement.
        if (inFlightAuthMe === request) inFlightAuthMe = null;
    }
}

/** Guest (unauthenticated) snapshot — the uniform result for any non-ok or failed request. */
function guestAuthMeSnapshot(): AuthMeSnapshot {
    return {
        isAuthenticated: false,
        user: null,
        permissions: [],
        roles: [],
        cachedAt: Date.now()
    };
}

/**
 * Performs the actual `/auth/me` request and mapping. Kept separate from
 * `fetchAuthMe` so the in-flight dedup wrapper stays thin. Never rejects — a
 * transport failure (network/DNS/CORS) or malformed JSON resolves to a guest
 * snapshot, so the shared in-flight promise never fans a rejection out to every
 * concurrent awaiter.
 */
async function performAuthMeFetch({ apiUrl }: FetchAuthMeParams): Promise<AuthMeSnapshot> {
    const resolvedApiUrl = apiUrl ?? getApiUrl();
    try {
        const response = await fetch(`${resolvedApiUrl}/api/v1/public/auth/me`, {
            credentials: 'include'
        });
        if (!response.ok) {
            return guestAuthMeSnapshot();
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
            roles: isAuthenticated && Array.isArray(actor?.roles) ? actor.roles : [],
            cachedAt: Date.now()
        };
    } catch {
        // Network/DNS/CORS failure or malformed JSON — treat as guest.
        return guestAuthMeSnapshot();
    }
}
