/**
 * @file OwnerListingDashboard.client.tsx
 * @description Live part of the venue and experience owner dashboards
 * (HOS-2475, HOS-2476).
 *
 * ONE request (`ownerDashboardApi.getStats`) feeds two StatCards:
 * - listings: total, with published/draft as the hint;
 * - traffic: views in the window when the plan grants it, a LockedState naming
 *   the catalog plans when it does not, «—» plus retry when the read failed.
 *
 * A failed read never renders `0` (HOS-2424) and a missing entitlement never
 * renders a number. An owner with no listing gets an onboarding EmptyState.
 */

import { BriefcaseIcon, EyeIcon } from '@repo/icons';
import type { OwnerDashboardVertical } from '@repo/schemas';
import { type JSX, useCallback, useEffect, useState } from 'react';
import {
    type AsyncResult,
    EmptyState,
    LinkButton,
    Section,
    StatCard,
    StatGrid,
    type StatValue
} from '@/components/account/ui';
import {
    OWNER_DASHBOARD_WIDGETS,
    type OwnerDashboardView,
    type OwnerWidgetState,
    resolveOwnerDashboardView
} from '@/lib/account/owner-listing-dashboard';
import { ownerDashboardApi } from '@/lib/api/endpoints-protected-dashboards';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { PUBLISH_PAGE_PATH_BY_VERTICAL } from '@/lib/publish/publish-page-paths';
import { buildUrl } from '@/lib/urls';

/** Props of {@link OwnerListingDashboard}. */
export interface OwnerListingDashboardProps {
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /** Which owner dashboard this is. */
    readonly vertical: OwnerDashboardVertical;
    /** Catalog names of the plans that grant traffic stats (read on the server). */
    readonly planNames: readonly string[];
    /** Where «Ver planes» goes. */
    readonly plansHref: string;
}

/**
 * Venue / experience owner dashboard island.
 *
 * @param props - See {@link OwnerListingDashboardProps}.
 * @returns The stat grid and, for an owner with no listing, the onboarding.
 */
export function OwnerListingDashboard({
    locale,
    vertical,
    planNames,
    plansHref
}: OwnerListingDashboardProps): JSX.Element {
    const t = createT(locale);
    const [view, setView] = useState<OwnerDashboardView>(() =>
        resolveOwnerDashboardView({ read: { status: 'loading' } })
    );

    const load = useCallback(async () => {
        setView(resolveOwnerDashboardView({ read: { status: 'loading' } }));
        try {
            const result = await ownerDashboardApi.getStats({ vertical });
            setView(
                resolveOwnerDashboardView({
                    read: result.ok ? { status: 'ready', data: result.data } : { status: 'error' }
                })
            );
        } catch {
            setView(resolveOwnerDashboardView({ read: { status: 'error' } }));
        }
    }, [vertical]);

    useEffect(() => {
        void load();
    }, [load]);

    const retry = () => void load();
    const toAsync = <T,>(
        state: OwnerWidgetState<T>,
        format: (data: T) => StatValue
    ): AsyncResult<StatValue> => {
        switch (state.status) {
            case 'loading':
                return { status: 'loading' };
            case 'error':
                return { status: 'error', retry };
            case 'locked':
                return {
                    status: 'locked',
                    reason: {
                        kind: 'plan',
                        feature: t(`account.ownerDashboard.${vertical}.trafficLockedFeature`),
                        description: t('account.ownerDashboard.trafficLockedDescription'),
                        plans: planNames.map((name) => ({ name })),
                        plansHref
                    }
                };
            case 'ready':
                return { status: 'ready', data: format(state.data) };
        }
    };

    const [listingsId, trafficId] = OWNER_DASHBOARD_WIDGETS[vertical];
    const listingsState = toAsync(view.listings, (counts) => ({
        value: counts.total,
        hint: t('account.ownerDashboard.listingsHint', undefined, {
            published: counts.published,
            draft: counts.draft
        })
    }));
    const trafficState = toAsync(view.traffic, (traffic) => ({
        value: traffic.total,
        hint: t('account.ownerDashboard.trafficHint', undefined, {
            days: traffic.windowDays,
            unique: traffic.unique
        })
    }));
    const publishHref = buildUrl({ locale, path: PUBLISH_PAGE_PATH_BY_VERTICAL[vertical] });

    return (
        <>
            <StatGrid helpId={`section:${vertical}.dashboard#stats`}>
                <StatCard
                    id={listingsId}
                    label={t(`account.ownerDashboard.${vertical}.listingsLabel`)}
                    state={listingsState}
                    locale={locale}
                    icon={<BriefcaseIcon size={20} />}
                    link={{
                        href: buildUrl({ locale, path: 'mi-cuenta/comercio' }),
                        label: t('account.ownerDashboard.manage')
                    }}
                />
                <StatCard
                    id={trafficId}
                    label={t('account.ownerDashboard.trafficLabel')}
                    state={trafficState}
                    locale={locale}
                    icon={<EyeIcon size={20} />}
                />
            </StatGrid>

            {view.isEmpty ? (
                <Section
                    title={t(`account.ownerDashboard.${vertical}.onboardingSection`)}
                    helpId={`section:${vertical}.dashboard#onboarding`}
                >
                    <EmptyState
                        variant="compact"
                        icon={<BriefcaseIcon size={32} />}
                        title={t(`account.ownerDashboard.${vertical}.onboardingTitle`)}
                        description={t(`account.ownerDashboard.${vertical}.onboardingDescription`)}
                        action={
                            <LinkButton href={publishHref}>
                                {t(`account.ownerDashboard.${vertical}.newListing`)}
                            </LinkButton>
                        }
                    />
                </Section>
            ) : null}
        </>
    );
}
