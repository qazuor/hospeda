/**
 * Commerce Leads Inbox — route handler (SPEC-239 T-058).
 *
 * URL: /platform/commerce-leads
 *
 * Auth guard: `_authed` wrapper + COMMERCE_VIEW_ALL permission check in
 * `beforeLoad`.  Users without COMMERCE_VIEW_ALL are redirected to
 * `/auth/forbidden`.
 *
 * The component layer (`CommerceLeadInbox`) handles its own row-level
 * COMMERCE_EDIT_ALL gates via the handle/provision dialog buttons.
 */

import { CommerceLeadInbox } from '@/features/commerce-leads/components/CommerceLeadInbox';
import type { AuthState } from '@/lib/auth-session';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/platform/commerce-leads/')({
    beforeLoad: ({ context }) => {
        // TYPE-WORKAROUND: same pattern used across all platform routes.
        const authState = context as unknown as AuthState;
        const hasAccess = authState.permissions?.includes(PermissionEnum.COMMERCE_VIEW_ALL);
        if (!hasAccess) {
            throw redirect({ to: '/auth/forbidden' });
        }
    },
    component: CommerceLeadInbox
});
