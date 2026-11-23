/**
 * @file PartnerStatsGrid.client.tsx
 * @description The partner dashboard's numbers (HOS-2477).
 *
 * One read of `partnersApi.mineStats({ windowDays: 30 })`. Which cards apply is
 * `resolvePartnerStatsCards`' decision (views only when the partner has its own
 * page, clicks only when the logo links out), so no card promises a stat the API
 * does not compute (NG-6). A failed read is one card with «—» and retry, never
 * a `0`; a payload with `available: false` renders nothing.
 */

import { EyeIcon, LinkIcon } from '@repo/icons';
import { type JSX, useCallback, useEffect, useState } from 'react';
import { StatCard, StatGrid } from '@/components/account/ui';
import { type MyPartnerStats, partnersApi } from '@/lib/api/endpoints-protected';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { resolvePartnerStatsCards } from '@/lib/partner-stats-cards';

/** Props of {@link PartnerStatsGrid}. */
export interface PartnerStatsGridProps {
    /** Active UI locale. */
    readonly locale: SupportedLocale;
}

type ReadState =
    | { readonly status: 'loading' }
    | { readonly status: 'error' }
    | { readonly status: 'ready'; readonly stats: MyPartnerStats };

/**
 * Partner stats island.
 *
 * @param props - See {@link PartnerStatsGridProps}.
 * @returns The stat grid, or nothing when the API says stats are not available.
 */
export function PartnerStatsGrid({ locale }: PartnerStatsGridProps): JSX.Element | null {
    const t = createT(locale);
    const [read, setRead] = useState<ReadState>({ status: 'loading' });

    const load = useCallback(async () => {
        setRead({ status: 'loading' });
        try {
            const result = await partnersApi.mineStats({ windowDays: 30 });
            setRead(result.ok ? { status: 'ready', stats: result.data } : { status: 'error' });
        } catch {
            setRead({ status: 'error' });
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const window30 = t('account.partnerStats.windows.last30');

    if (read.status !== 'ready') {
        return (
            <StatGrid helpId="section:partner.dashboard#stats">
                <StatCard
                    id="partnerStats"
                    label={t('account.partnerStats.title')}
                    state={
                        read.status === 'loading'
                            ? { status: 'loading' }
                            : { status: 'error', retry: () => void load() }
                    }
                    locale={locale}
                />
            </StatGrid>
        );
    }

    const { showViews, showClicks } = resolvePartnerStatsCards({ stats: read.stats, locale });
    const { views, clicks } = read.stats;
    const viewsReady = showViews && views !== undefined;
    const clicksReady = showClicks && clicks !== undefined;
    if (!viewsReady && !clicksReady) return null;

    return (
        <StatGrid helpId="section:partner.dashboard#stats">
            {viewsReady ? (
                <StatCard
                    id="partnerViews"
                    label={t('account.partnerStats.views.label')}
                    state={{ status: 'ready', data: { value: views.total, hint: window30 } }}
                    locale={locale}
                    icon={<EyeIcon size={20} />}
                />
            ) : null}
            {clicksReady ? (
                <StatCard
                    id="partnerClicks"
                    label={t('account.partnerStats.clicks.label')}
                    state={{ status: 'ready', data: { value: clicks.total, hint: window30 } }}
                    locale={locale}
                    icon={<LinkIcon size={20} />}
                />
            ) : null}
        </StatGrid>
    );
}
