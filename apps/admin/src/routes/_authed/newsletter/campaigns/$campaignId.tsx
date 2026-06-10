/**
 * @file $campaignId.tsx
 * @description Campaign detail / edit / metrics page.
 *
 * Route: /_authed/newsletter/campaigns/$campaignId
 * Guard: NEWSLETTER_CAMPAIGN_VIEW permission.
 *
 * Branches on campaign status:
 * - draft    → CampaignEditor mode="edit"
 * - sending  → CampaignEditor mode="readonly" + cancel-send + metrics placeholder
 * - sent     → CampaignEditor mode="readonly" + metrics placeholder
 * - cancelled → CampaignEditor mode="readonly" + metrics placeholder
 *
 * The metrics panel placeholder (data-testid="metrics-placeholder") will be
 * replaced by the real MetricsPanel component in T-101-41.
 *
 * @module CampaignDetailPage
 */

import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useNewsletterCampaign } from '@/hooks/newsletter';
import { useTranslations } from '@/hooks/use-translations';
import type { AuthState } from '@/lib/auth-session';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { CampaignEditor } from './-components/CampaignEditor';
import { CampaignMetricsPanel } from './-components/CampaignMetricsPanel';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/_authed/newsletter/campaigns/$campaignId')({
    beforeLoad: ({ context }) => {
        // TYPE-WORKAROUND: TanStack Router context type can't infer dynamically-loaded
        // auth fields populated in the parent beforeLoad; cast restores the AuthState shape.
        const authState = context as unknown as AuthState;

        const hasViewPermission = authState.permissions?.includes(
            PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW
        );

        if (!hasViewPermission) {
            throw redirect({ to: '/auth/forbidden' });
        }
    },
    component: CampaignDetailPage
});

// ─── Status badge ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
    readonly status: string;
}

const STATUS_STYLES: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground border-border',
    sending: 'border-info/30 bg-info/15 text-info',
    sent: 'border-success/30 bg-success/15 text-success',
    cancelled: 'border-destructive/30 bg-destructive/15 text-destructive'
};

const STATUS_LABELS: Record<string, string> = {
    draft: 'Borrador',
    sending: 'Enviando',
    sent: 'Enviada',
    cancelled: 'Cancelada'
};

function StatusBadge({ status }: StatusBadgeProps) {
    const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
    const label = STATUS_LABELS[status] ?? status;
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium text-xs ${style}`}
            aria-label={`Estado: ${label}`}
        >
            {label}
        </span>
    );
}

// ─── Metrics placeholder ──────────────────────────────────────────────────────

// ─── CampaignDetailPage ───────────────────────────────────────────────────────

/**
 * Detail page for a newsletter campaign.
 *
 * Fetches the campaign via useNewsletterCampaign(id) and renders the appropriate
 * editor mode based on status. Shows the metrics panel placeholder for non-draft
 * campaigns (T-101-41 will replace it with the real panel).
 */
function CampaignDetailPage() {
    const { campaignId } = Route.useParams();
    const { t } = useTranslations();

    const { data: campaign, isLoading, error } = useNewsletterCampaign(campaignId);

    if (isLoading) {
        return (
            <SidebarPageLayout>
                <div className="space-y-6">
                    <div className="h-8 w-64 animate-pulse rounded bg-muted" />
                    <div className="h-96 animate-pulse rounded bg-muted" />
                </div>
            </SidebarPageLayout>
        );
    }

    if (error || !campaign) {
        return (
            <SidebarPageLayout>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
                    <h2 className="font-semibold text-destructive text-xl">
                        {t('ui.errors.pageNotFound')}
                    </h2>
                    <p className="mt-2 text-muted-foreground text-sm">
                        No se encontró la campaña o no tenés acceso.
                    </p>
                </div>
            </SidebarPageLayout>
        );
    }

    const isDraft = campaign.status === 'draft';
    const editorMode = isDraft ? 'edit' : 'readonly';
    const showMetrics = campaign.status !== 'draft';

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Page header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="font-bold text-2xl">{campaign.title}</h1>
                        <p className="mt-0.5 text-muted-foreground text-sm">
                            Asunto: {campaign.subject}
                        </p>
                    </div>
                    <StatusBadge status={campaign.status} />
                </div>

                {/* Campaign editor (branches by mode) */}
                <CampaignEditor
                    mode={editorMode}
                    campaign={campaign}
                />

                {/* Metrics panel — rendered for sending/sent/cancelled campaigns */}
                {showMetrics && (
                    <CampaignMetricsPanel
                        campaignId={campaignId}
                        status={campaign.status}
                    />
                )}
            </div>
        </SidebarPageLayout>
    );
}
