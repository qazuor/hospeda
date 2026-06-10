/**
 * Generic admin-API guard helper for TanStack Router `beforeLoad` callbacks.
 *
 * Checks that the resolved auth context includes `ACCESS_API_ADMIN` before
 * allowing a non-billing admin-tier route to render. Used for pages that
 * surface operational data (cron jobs, webhook deliveries, email/notification
 * logs) where the only requirement is "be a staff member who can use the
 * admin API" — there is no narrower permission that fits.
 *
 * Coverage per `role_permission`:
 *   - SUPER_ADMIN, ADMIN, CLIENT_MANAGER, EDITOR → granted
 *   - HOST, USER, SPONSOR → denied (redirected to `/auth/forbidden`)
 *
 * Note: this is distinct from `requireBillingAccess`, which gates on
 * `BILLING_READ_ALL` (SUPER_ADMIN-only). The ops/email pages were previously
 * reusing the billing guard by mistake — see SPEC-156 PR-4 smoke sign-off
 * (PR #1305) for the discovery context. Each non-billing route should use
 * this helper instead until granular per-route permissions are introduced.
 *
 * Usage inside a route file:
 *
 * ```ts
 * import { requireAdminApiAccess } from '@/lib/admin-api-access';
 *
 * export const Route = createFileRoute('/_authed/platform/ops/cron')({
 *     beforeLoad: ({ context }) => requireAdminApiAccess(context),
 *     component: CronPage,
 * });
 * ```
 *
 * @module admin-api-access
 */

import type { AuthState } from '@/lib/auth-session';
import { PermissionEnum } from '@repo/schemas';
import { redirect } from '@tanstack/react-router';

/**
 * Assert that the given route context includes `ACCESS_API_ADMIN`.
 *
 * Throws a TanStack Router redirect to `/auth/forbidden` when the permission
 * is absent. Returns `void` (no return value needed by callers) when access
 * is granted.
 *
 * The `context` argument is typed as `unknown` because TanStack Router cannot
 * infer the dynamically-populated auth fields set in the parent `_authed`
 * `beforeLoad`; the function casts internally (same workaround used across
 * all per-route guards in this codebase).
 *
 * @param context - Raw TanStack Router `beforeLoad` context object.
 * @throws {ReturnType<typeof redirect>} Redirects to `/auth/forbidden` when
 *   `ACCESS_API_ADMIN` is absent.
 */
export function requireAdminApiAccess(context: unknown): void {
    // TYPE-WORKAROUND: TanStack Router context type can't infer dynamically-loaded
    // auth fields populated in the parent beforeLoad; cast restores the AuthState shape.
    const authState = context as unknown as AuthState;

    const hasAccess = authState.permissions?.includes(PermissionEnum.ACCESS_API_ADMIN);

    if (!hasAccess) {
        throw redirect({ to: '/auth/forbidden' });
    }
}
