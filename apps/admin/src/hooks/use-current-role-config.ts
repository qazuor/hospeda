/**
 * useCurrentRoleConfig — resolves the IA RoleConfig for the currently
 * authenticated user's role.
 *
 * This hook is the **template selector** only. It reads the user's role string
 * from `useAuthContext()` and returns the matching `RoleConfig` from the
 * validated IA config. This is NOT a permission gate — it only picks which
 * layout template to use for the current role.
 *
 * Returns `undefined` when:
 * - No user is authenticated.
 * - The user's role string does not match any key in `validatedConfig.roles`.
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
 * @see apps/admin/src/contexts/auth-context.tsx — user.role source
 * @see SPEC-154 T-023
 */

import type { RoleConfig } from '@/config/ia/schema';
import { validatedConfig } from '@/config/ia/validate';
import { useAuthContext } from '@/hooks/use-auth-context';

/**
 * Returns the IA {@link RoleConfig} for the currently authenticated user's role.
 *
 * This hook ONLY selects the layout template — it is NOT a permission check.
 * All item-level visibility must go through `useUserPermissions()`.
 *
 * @returns The {@link RoleConfig} for the user's role, or `undefined` if no
 *   user is authenticated, the role is unknown, or the role is disabled.
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

    if (!user?.role) {
        return undefined;
    }

    const roleConfig = validatedConfig.roles[user.role];
    if (!roleConfig || !roleConfig.enabled) {
        return undefined;
    }

    return roleConfig;
}
