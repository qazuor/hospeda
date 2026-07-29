/**
 * useCurrentRoleConfig — resolves the IA RoleConfig for the currently
 * authenticated user.
 *
 * This hook is the **template selector** only. It reads the user's role SET
 * from `useAuthContext()` (HOS-296: an account can hold multiple hats) and
 * returns the matching `RoleConfig` for the first held role that has one.
 * This is NOT a permission gate — it only picks which layout template to use.
 *
 * **Multi-hat tie-break**: when the user holds more than one role with a
 * `RoleConfig` entry, this resolves the FIRST one in `validatedConfig.roles`'
 * own key declaration order (see {@link resolvePrimaryRole}) — deterministic,
 * and documented here rather than left as an implicit "whichever happened to
 * be picked" heuristic.
 *
 * Returns `undefined` when:
 * - No user is authenticated, or the user holds no roles.
 * - None of the user's roles match a key in `validatedConfig.roles`.
 * - The matching role entry has `enabled: false` (deferred/disabled role).
 *
 * Consumers should treat `undefined` as "no layout config available" and
 * render nothing or a fallback UI.
 *
 * ARCHITECTURAL RULE (SPEC-154): Every access/visibility decision MUST be
 * driven by the user's REAL permissions via `useUserPermissions()`, NOT by
 * the role itself. This hook only provides the layout template.
 *
 * @module use-current-role-config
 * @see apps/admin/src/config/ia/validate.ts   — validatedConfig
 * @see apps/admin/src/contexts/auth-context.tsx — user.roles source
 * @see SPEC-154 T-023
 */

import type { RoleConfig } from '@/config/ia/schema';
import { validatedConfig } from '@/config/ia/validate';
import { useAuthContext } from '@/hooks/use-auth-context';

/**
 * Resolves the single "primary" role key to use for template selection out of
 * a user's full role set, per the multi-hat tie-break documented on
 * {@link useCurrentRoleConfig}: the first role (in `validatedConfig.roles`'
 * own key declaration order) that the user actually holds.
 *
 * Exported so other single-role consumers (e.g. tour role resolution) can
 * reuse the exact same precedence instead of re-deriving their own.
 *
 * @param roles - The full set of roles the user holds.
 * @returns The first matching role key, or `undefined` if none match.
 */
export function resolvePrimaryRole(roles: readonly string[] | undefined): string | undefined {
    if (!roles || roles.length === 0) {
        return undefined;
    }
    return Object.keys(validatedConfig.roles).find((roleKey) => roles.includes(roleKey));
}

/**
 * Returns the IA {@link RoleConfig} for the currently authenticated user.
 *
 * This hook ONLY selects the layout template — it is NOT a permission check.
 * All item-level visibility must go through `useUserPermissions()`.
 *
 * @returns The {@link RoleConfig} for the user's (primary) role, or
 *   `undefined` if no user is authenticated, no held role is known, or the
 *   matching role is disabled.
 *
 * @example
 * ```ts
 * const roleConfig = useCurrentRoleConfig();
 * if (!roleConfig) return null; // no layout for this user/role
 * // Use roleConfig.mainMenu, roleConfig.topbar, roleConfig.mobile, etc.
 * ```
 */
export function useCurrentRoleConfig(): RoleConfig | undefined {
    const { user } = useAuthContext();

    const primaryRole = resolvePrimaryRole(user?.roles);
    if (!primaryRole) {
        return undefined;
    }

    const roleConfig = validatedConfig.roles[primaryRole];
    if (!roleConfig?.enabled) {
        return undefined;
    }

    return roleConfig;
}
