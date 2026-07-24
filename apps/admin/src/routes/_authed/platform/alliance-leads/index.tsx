/**
 * Alliance Leads Inbox — route handler (HOS-277 §6.4).
 *
 * URL: /platform/alliance-leads
 *
 * Auth guard: `_authed` wrapper + ALLIANCE_LEAD_VIEW_ALL permission check in
 * `beforeLoad`. Users without ALLIANCE_LEAD_VIEW_ALL are redirected to
 * `/auth/forbidden`.
 *
 * The component layer (`AllianceLeadInbox`) handles its own row-level
 * ALLIANCE_LEAD_MANAGE gate via the handle dialog button.
 */

import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { AllianceLeadInbox } from '@/features/alliance-leads/components/AllianceLeadInbox';
import type { AuthState } from '@/lib/auth-session';

export const Route = createFileRoute('/_authed/platform/alliance-leads/')({
    beforeLoad: ({ context }) => {
        // TYPE-WORKAROUND: same pattern used across all platform routes.
        const authState = context as unknown as AuthState;
        const hasAccess = authState.permissions?.includes(PermissionEnum.ALLIANCE_LEAD_VIEW_ALL);
        if (!hasAccess) {
            throw redirect({ to: '/auth/forbidden' });
        }
    },
    component: AllianceLeadInbox
});
