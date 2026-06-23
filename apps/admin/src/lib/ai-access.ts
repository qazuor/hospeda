/**
 * AI access guard helper for TanStack Router `beforeLoad` callbacks.
 *
 * Checks that the resolved auth context includes `AI_SETTINGS_MANAGE` before
 * allowing an AI route to render.  When the permission is absent the caller
 * throws a redirect to `/auth/forbidden` — rejecting direct-URL access at the
 * page-render level.
 *
 * SUPER_ADMIN passes automatically: `apps/api/src/middlewares/actor.ts` builds
 * the SUPER_ADMIN actor with `permissions: Object.values(PermissionEnum)` at
 * runtime, so `AI_SETTINGS_MANAGE` is always present in the session permissions
 * array for SUPER_ADMIN regardless of seed content.
 *
 * Usage inside an AI route file:
 *
 * ```ts
 * import { requireAiAccess } from '@/lib/ai-access';
 *
 * export const Route = createFileRoute('/_authed/ai/usage')({
 *     beforeLoad: ({ context }) => requireAiAccess(context),
 *     component: AiUsagePage,
 * });
 * ```
 *
 * @module ai-access
 */

import type { AuthState } from '@/lib/auth-session';
import { PermissionEnum } from '@repo/schemas';
import { redirect } from '@tanstack/react-router';

/**
 * Assert that the given route context includes `AI_SETTINGS_MANAGE`.
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
 *   `AI_SETTINGS_MANAGE` is absent.
 */
export function requireAiAccess(context: unknown): void {
    // TYPE-WORKAROUND: TanStack Router context type can't infer dynamically-loaded
    // auth fields populated in the parent beforeLoad; cast restores the AuthState shape.
    const authState = context as unknown as AuthState;

    const hasAccess = authState.permissions?.includes(PermissionEnum.AI_SETTINGS_MANAGE);

    if (!hasAccess) {
        throw redirect({ to: '/auth/forbidden' });
    }
}
