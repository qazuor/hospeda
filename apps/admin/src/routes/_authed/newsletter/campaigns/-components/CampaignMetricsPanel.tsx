/**
 * @file CampaignMetricsPanel.tsx
 * @description Live-metrics card embedded in the campaign detail page
 * (SPEC-101 T-101-41).
 *
 * Wires `useCampaignMetrics(id, status)` so polling is automatic when the
 * campaign is in `sending` state (10-second refetchInterval handled by the
 * hook). Static for terminal statuses.
 *
 * Five tiles + open / click rates + a "Ver errores" CTA that opens the
 * FailedDeliveriesDialog. Dashes render while the first fetch is in
 * flight (no loading spinner — the metrics arrive within 100-300ms in
 * practice and a spinner causes more layout shift than it's worth).
 */

import { Button } from '@/components/ui/button';
import { useCampaignMetrics } from '@/hooks/newsletter';
import { useTranslations } from '@/hooks/use-translations';
import type { NewsletterCampaignStatusEnum } from '@repo/schemas';
import { useState } from 'react';
import { FailedDeliveriesDialog } from './FailedDeliveriesDialog';

export interface CampaignMetricsPanelProps {
    /** Campaign UUID. */
    readonly campaignId: string;
    /** Current campaign status — drives polling on/off in useCampaignMetrics. */
    readonly status: NewsletterCampaignStatusEnum;
}

/** Format an integer with es-AR thousand separators. Empty string when null. */
function formatInt(value: number | undefined | null): string {
    if (value === undefined || value === null) return '—';
    return value.toLocaleString('es-AR');
}

/** Format a 0-1 ratio as a percentage with one decimal. Empty when null. */
function formatRate(value: number | undefined | null): string {
    if (value === undefined || value === null) return '—';
    return `${(value * 100).toFixed(1)}%`;
}

export function CampaignMetricsPanel({ campaignId, status }: CampaignMetricsPanelProps) {
    const { t } = useTranslations();
    const { data, isLoading } = useCampaignMetrics(campaignId, status);
    const [errorsOpen, setErrorsOpen] = useState<boolean>(false);

    const tiles = [
        {
            key: 'admin-newsletter.campaigns.metrics.totalRecipients' as const,
            value: formatInt(data?.totalRecipients)
        },
        {
            key: 'admin-newsletter.campaigns.metrics.totalSoftcapped' as const,
            value: formatInt(data?.totalSoftcapped)
        },
        {
            key: 'admin-newsletter.campaigns.metrics.delivered' as const,
            value: formatInt(data?.delivered)
        },
        {
            key: 'admin-newsletter.campaigns.metrics.failed' as const,
            value: formatInt(data?.failed)
        },
        {
            key: 'admin-newsletter.campaigns.metrics.openRate' as const,
            value: formatRate(data?.openRate)
        },
        {
            key: 'admin-newsletter.campaigns.metrics.clickRate' as const,
            value: formatRate(data?.clickRate)
        }
    ];

    return (
        <section
            className="rounded-lg border bg-card p-6"
            aria-busy={isLoading || undefined}
            data-testid="campaign-metrics-panel"
            data-campaign-id={campaignId}
        >
            <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-lg">Métricas</h3>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setErrorsOpen(true)}
                    disabled={!data || data.failed === 0}
                >
                    {t('admin-newsletter.campaigns.metrics.viewErrors')}
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {tiles.map((tile) => (
                    <div
                        key={tile.key}
                        className="rounded-md border bg-background p-3"
                    >
                        <p className="text-muted-foreground text-xs">{t(tile.key)}</p>
                        <p className="mt-1 font-bold text-2xl tabular-nums">{tile.value}</p>
                    </div>
                ))}
            </div>

            <FailedDeliveriesDialog
                campaignId={campaignId}
                open={errorsOpen}
                onOpenChange={setErrorsOpen}
            />
        </section>
    );
}
