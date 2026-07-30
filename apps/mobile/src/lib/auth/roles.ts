/**
 * @file roles.ts
 * @description Pure role-set-to-navigation-group mapping helpers for the Hospeda
 * mobile app.
 *
 * These functions are intentionally small and side-effect-free so they can be
 * unit-tested without any React Native environment.
 *
 * ## Owner decision (SPEC-243, locked)
 * Mobile host set: HOST, ADMIN, SUPER_ADMIN.
 * Mobile tourist set: every other authenticated role (USER, EDITOR,
 * CLIENT_MANAGER, SPONSOR, COMMERCE_OWNER, and any unknown/future role).
 *
 * DIVERGENCE from `apps/web/src/lib/account-roles.ts`:
 * The web app includes EDITOR and CLIENT_MANAGER in its "host-like" set.
 * On mobile those roles route to the tourist shell — there is no admin/editor
 * surface in the app. Do NOT "fix" this to match web without an explicit
 * owner decision.
 *
 * ## HOS-296 — multi-role
 * `users.role` no longer exists: an account holds a SET of roles and the
 * session no longer carries a scalar. The mapping is now "does the held set
 * intersect the host set", but it is still 1-of-3 and still mutually
 * exclusive — a user holding HOST **and** COMMERCE_OWNER lands in `(host)`,
 * exactly as a HOST does today.
 *
 * That 1-of-3 shape is structurally incompatible with real dual-hat
 * navigation. That is known, accepted, and OUT OF SCOPE here (HOS-296 OQ-2):
 * changing it means re-opening SPEC-243. This module implements the minimal
 * fix — preserve today's behaviour against a role set — nothing more.
 *
 * @module roles
 */

import { RoleEnum } from '@repo/schemas';

/**
 * The three top-level expo-router groups the app can land in.
 *
 * Mirrors the directory names under `app/`: `app/(auth)`, `app/(host)`,
 * `app/(tourist)`.
 */
export type AuthGroup = '(auth)' | '(host)' | '(tourist)';

/**
 * Resolution state of the Better Auth session.
 *
 * - `loading` — the session is still being restored from SecureStore.
 * - `authenticated` — a session exists.
 * - `unauthenticated` — no session (signed out, or never signed in).
 */
export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Resolution state of the actor's role set, fetched from
 * `GET /api/v1/public/auth/me` (HOS-296: roles are no longer part of the
 * native Better Auth session payload).
 *
 * - `loading` — the request is in flight; the role set is NOT yet known.
 * - `ready` — the role set is known (possibly empty).
 * - `error` — the request failed after its retries were exhausted.
 */
export type RolesStatus = 'loading' | 'ready' | 'error';

/**
 * Roles that access the host navigator on mobile.
 * Stored as a `Set` for O(1) lookup.
 *
 * Values are RoleEnum literals to keep the mapping explicit and refactor-safe.
 */
const HOST_ROLES: ReadonlySet<string> = new Set<string>([
    RoleEnum.HOST,
    RoleEnum.ADMIN,
    RoleEnum.SUPER_ADMIN
]);

/**
 * Returns true when the held role set contains at least one role that grants
 * access to the `(host)` navigator.
 *
 * Handles null/undefined/empty gracefully — returns false.
 *
 * @param roles - Every role the actor holds, from `Actor.roles` on `/auth/me`.
 * @returns `true` when the set intersects `{HOST, ADMIN, SUPER_ADMIN}`.
 *
 * @example
 * ```ts
 * hasHostRole(['USER', 'HOST'])            // true
 * hasHostRole(['USER', 'COMMERCE_OWNER'])  // false
 * hasHostRole([])                          // false
 * hasHostRole(undefined)                   // false
 * ```
 */
export function hasHostRole(roles: readonly string[] | null | undefined): boolean {
    if (!roles) return false;
    return roles.some((role) => HOST_ROLES.has(role));
}

/**
 * Input for {@link resolveAuthGroup}.
 */
export type ResolveAuthGroupInput = {
    /** Whether the Better Auth session has resolved, and to what. */
    readonly sessionStatus: SessionStatus;
    /** Whether the `/auth/me` role set has resolved, and to what. */
    readonly rolesStatus: RolesStatus;
    /** Every role the actor holds. Only meaningful when `rolesStatus` is `ready`. */
    readonly roles: readonly string[] | null | undefined;
};

/**
 * Output of {@link resolveAuthGroup}.
 */
export type ResolveAuthGroupOutput = {
    /**
     * The expo-router group the user belongs in, or `null` when it cannot be
     * decided yet.
     *
     * `null` is NOT "send them to `(tourist)` for now" — the caller MUST hold
     * the splash screen and navigate nowhere. Defaulting to `(tourist)` while
     * the role set is in flight is the exact AC-9 bug in a different costume:
     * a host would see the tourist shell, however briefly.
     */
    readonly group: AuthGroup | null;
};

/**
 * Resolves the expo-router group that a user should be redirected to, from the
 * session state plus the role set fetched out of band.
 *
 * Resolution order:
 * 1. Session still restoring → `null` (undecided; hold the splash).
 * 2. No session → `(auth)`. The role set is irrelevant and never awaited.
 * 3. Session + roles still loading → `null` (undecided; hold the splash).
 * 4. Session + roles failed → `(tourist)`. Least privilege: a transport
 *    failure must never hand out the host shell. It is recoverable, not
 *    permanent — TanStack Query refetches on reconnect and the caller
 *    re-evaluates, promoting the user to `(host)` once the set arrives.
 * 5. Session + roles ready → `(host)` if the set intersects the host set,
 *    else `(tourist)` (default-to-tourist keeps unknown/future roles inside
 *    a shell rather than stranded).
 *
 * @param input - Session status, roles status, and the held role set.
 * @returns `{ group }` — the target group, or `null` while undecided.
 *
 * @example
 * ```ts
 * resolveAuthGroup({ sessionStatus: 'authenticated', rolesStatus: 'ready', roles: ['USER', 'HOST'] })
 * // { group: '(host)' }
 * resolveAuthGroup({ sessionStatus: 'authenticated', rolesStatus: 'loading', roles: undefined })
 * // { group: null } — hold the splash, do NOT fall through to (tourist)
 * resolveAuthGroup({ sessionStatus: 'unauthenticated', rolesStatus: 'ready', roles: [] })
 * // { group: '(auth)' }
 * ```
 */
export function resolveAuthGroup({
    sessionStatus,
    rolesStatus,
    roles
}: ResolveAuthGroupInput): ResolveAuthGroupOutput {
    if (sessionStatus === 'loading') return { group: null };
    if (sessionStatus === 'unauthenticated') return { group: '(auth)' };

    // Authenticated from here on.
    if (rolesStatus === 'loading') return { group: null };
    if (rolesStatus === 'error') return { group: '(tourist)' };

    return { group: hasHostRole(roles) ? '(host)' : '(tourist)' };
}
