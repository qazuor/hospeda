/**
 * @file new.tsx
 * @description Admin page for creating a new newsletter campaign.
 *
 * Route: /_authed/newsletter/campaigns/new
 * Guard: NEWSLETTER_CAMPAIGN_WRITE permission.
 *
 * Renders CampaignEditor in create mode. On successful first save the editor
 * navigates to the detail page for the new campaign ID.
 *
 * @module NewCampaignPage
 */

import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import type { AuthState } from '@/lib/auth-session';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { CampaignEditor } from './-components/CampaignEditor';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/_authed/newsletter/campaigns/new')({
    beforeLoad: ({ context }) => {
        // TYPE-WORKAROUND: TanStack Router context type can't infer dynamically-loaded
        // auth fields populated in the parent beforeLoad; cast restores the AuthState shape.
        const authState = context as unknown as AuthState;

        const hasWritePermission = authState.permissions?.includes(
            PermissionEnum.NEWSLETTER_CAMPAIGN_WRITE
        );

        if (!hasWritePermission) {
            throw redirect({ to: '/auth/forbidden' });
        }
    },
    component: NewCampaignPage
});

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Create-campaign page.
 *
 * Wraps CampaignEditor in create mode inside the standard SidebarPageLayout.
 * CampaignEditor handles navigation to the detail page after first save.
 */
function NewCampaignPage() {
    const { t } = useTranslations();

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Page header */}
                <div>
                    <h1 className="font-bold text-3xl">
                        {t('admin-newsletter.campaigns.newCampaign')}
                    </h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Redactá el contenido de tu campaña y guardala como borrador.
                    </p>
                </div>

                {/* Editor */}
                <CampaignEditor mode="create" />
            </div>
        </SidebarPageLayout>
    );
}
