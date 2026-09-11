/**
 * Billing access guard helper for TanStack Router `beforeLoad` callbacks.
 *
 * Checks that the resolved auth context includes `BILLING_READ_ALL` before
 * allowing a billing route to render.  When the permission is absent the
 * caller throws a redirect to `/auth/forbidden` — rejecting direct-URL access
 * at the page-render level (SPEC-164 T-006, AC-8/9).
 *
 * SUPER_ADMIN passes automatically: `apps/api/src/middlewares/actor.ts` builds
 * the SUPER_ADMIN actor with `permissions: Object.values(PermissionEnum)` at
 * runtime, so `BILLING_READ_ALL` is always present in the session permissions
 * array for SUPER_ADMIN regardless of seed content.
 *
 * ADMIN fails: the seed revoke (T-002) removes `BILLING_READ_ALL` from the
 * ADMIN role, so `authState.permissions` will not contain it.
 *
 * Usage inside a billing route file:
 *
 * ```ts
 * import { requireBillingAccess } from '@/lib/billing-access';
 *
 * export const Route = createFileRoute('/_authed/billing/plans')({
 *     beforeLoad: ({ context }) => requireBillingAccess(context),
 *     component: BillingPlansPage,
 * });
 * ```
 *
 * @module billing-access
 */

import { PermissionEnum } from '@repo/schemas';
import { redirect } from '@tanstack/react-router';
import type { AuthState } from '@/lib/auth-session';

/**
 * Assert that the given route context includes `BILLING_READ_ALL`.
 *
 * Throws a TanStack Router redirect to `/auth/forbidden` when the permission
 * is absent.  Returns `void` (no return value needed by callers) when access
 * is granted.
 *
 * The `context` argument is typed as `unknown` because TanStack Router cannot
 * infer the dynamically-populated auth fields set in the parent `_authed`
 * `beforeLoad`; the function casts internally (same workaround used across all
 * per-route guards in this codebase).
 *
 * @param context - Raw TanStack Router `beforeLoad` context object.
 * @throws {ReturnType<typeof redirect>} Redirects to `/auth/forbidden` when
 *   `BILLING_READ_ALL` is absent.
 */
export function requireBillingAccess(context: unknown): void {
    // TYPE-WORKAROUND: TanStack Router context type can't infer dynamically-loaded
    // auth fields populated in the parent beforeLoad; cast restores the AuthState shape.
    const authState = context as unknown as AuthState;

    const hasAccess = authState.permissions?.includes(PermissionEnum.BILLING_READ_ALL);

    if (!hasAccess) {
        throw redirect({ to: '/auth/forbidden' });
    }
}

/**
 * Assert that the given route context includes `BILLING_RECONCILIATION_MANAGE`.
 *
 * Deliberately does NOT reuse {@link requireBillingAccess} / `BILLING_READ_ALL`:
 * that permission is held by anyone allowed to look at billing at all, while
 * the orphan-payment rescue screen (HOS-765) shows real payers' emails
 * side-by-side with what they were charged, and is the entry point to two
 * verbs that WRITE money into the ledger (force-linking a preapproval to a
 * subscription, backfilling a `billing_payments` row). That combination —
 * PII plus a real financial write, gated only behind "can view billing" —
 * is exactly the kind of over-broad grant this repo's permission model
 * exists to prevent. `BILLING_RECONCILIATION_MANAGE` is its own,
 * SUPER_ADMIN-only grant for that reason (see the enum's JSDoc in
 * `packages/schemas/src/enums/permission.enum.ts`).
 *
 * Throws a TanStack Router redirect to `/auth/forbidden` when the permission
 * is absent. Returns `void` when access is granted.
 *
 * @param context - Raw TanStack Router `beforeLoad` context object.
 * @throws {ReturnType<typeof redirect>} Redirects to `/auth/forbidden` when
 *   `BILLING_RECONCILIATION_MANAGE` is absent.
 */
export function requireBillingReconciliationAccess(context: unknown): void {
    // TYPE-WORKAROUND: TanStack Router context type can't infer dynamically-loaded
    // auth fields populated in the parent beforeLoad; cast restores the AuthState shape.
    const authState = context as unknown as AuthState;

    const hasAccess = authState.permissions?.includes(PermissionEnum.BILLING_RECONCILIATION_MANAGE);

    if (!hasAccess) {
        throw redirect({ to: '/auth/forbidden' });
    }
}
