/**
 * @file roles.ts
 * @description Pure role-to-navigation-group mapping helpers for the Hospeda
 * mobile app.
 *
 * These functions are intentionally small and side-effect-free so they can be
 * unit-tested without any React Native environment.
 *
 * ## Owner decision (SPEC-243, locked)
 * Mobile host set: HOST, ADMIN, SUPER_ADMIN.
 * Mobile tourist set: every other authenticated role (USER, EDITOR,
 * CLIENT_MANAGER, SPONSOR, and any unknown/future role).
 *
 * DIVERGENCE from `apps/web/src/lib/account-roles.ts`:
 * The web app includes EDITOR and CLIENT_MANAGER in its "host-like" set.
 * On mobile those roles route to the tourist shell — there is no admin/editor
 * surface in the app. Do NOT "fix" this to match web without an explicit
 * owner decision.
 *
 * @module roles
 */

import { RoleEnum } from '@repo/schemas';

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
 * Returns true when the given role should land in the `(host)` navigator.
 *
 * Handles null/undefined gracefully — returns false (tourist/auth fallback).
 *
 * @param role - The role string from `useSession().data.user.role`, or null/undefined.
 * @returns `true` for HOST, ADMIN, SUPER_ADMIN; `false` for everything else.
 *
 * @example
 * ```ts
 * isHostRole('HOST')        // true
 * isHostRole('USER')        // false
 * isHostRole(undefined)     // false
 * ```
 */
export function isHostRole(role: string | null | undefined): boolean {
    return HOST_ROLES.has(role ?? '');
}

/**
 * Resolves the expo-router group that a user should be redirected to based on
 * their role and session state.
 *
 * Resolution order:
 * 1. No session → `(auth)` (sign-in/sign-up group)
 * 2. Session + host role → `(host)`
 * 3. Session + any other role (including unknown/future) → `(tourist)`
 *    (default-to-tourist ensures no logged-in user is left without a shell)
 *
 * @param role       - The role string from `useSession().data.user.role`, or null/undefined.
 * @param hasSession - Whether a valid session exists (user is authenticated).
 * @returns The expo-router group path: `'(auth)'`, `'(host)'`, or `'(tourist)'`.
 *
 * @example
 * ```ts
 * resolveAuthGroup('HOST', true)    // '(host)'
 * resolveAuthGroup('USER', true)    // '(tourist)'
 * resolveAuthGroup('EDITOR', true)  // '(tourist)'
 * resolveAuthGroup(null, false)     // '(auth)'
 * resolveAuthGroup('HOST', false)   // '(auth)'  — session required
 * ```
 */
export function resolveAuthGroup(
    role: string | null | undefined,
    hasSession: boolean
): '(auth)' | '(host)' | '(tourist)' {
    if (!hasSession) return '(auth)';
    return isHostRole(role) ? '(host)' : '(tourist)';
}
