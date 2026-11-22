/**
 * @file HostDashboard.client.tsx
 * @description The host dashboard's live part (HOS-2474, D19 «sin duplicación»).
 *
 * Reads `GET /protected/host/dashboard` once and draws:
 * - a StatGrid with the host's properties and unread OWNER conversations, each
 *   card with its own error state («—» plus retry, never `0`, HOS-2424);
 * - an onboarding EmptyState for a host who has no property yet;
 * - a LockedState naming the catalog plans when the plan lacks the dashboard
 *   entitlement (HOS-2214: never a raw «Entitlement required»).
 *
 * The account plan summary is NOT here: it lives on the general dashboard.
 *
 * @example
 * ```astro
 * <HostDashboard client:load locale={locale} planNames={names} plansHref={href} />
 * ```
 */

import { BuildingIcon, ChatIcon } from '@repo/icons';
import { type JSX, useCallback, useEffect, useState } from 'react';
import {
    type AsyncResult,
    EmptyState,
    LinkButton,
    LockedState,
    Section,
    StatCard,
    StatGrid,
    type StatValue
} from '@/components/account/ui';
import {
    type HostDashboardOutcome,
    resolveHostDashboardOutcome
} from '@/lib/account/host-dashboard';
import { hostDashboardApi } from '@/lib/api/endpoints-protected';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { AnalyticsSection } from './AnalyticsSection.client';

/** Props of {@link HostDashboard}. */
export interface HostDashboardProps {
    /** Active UI locale for i18n and URL building. */
    readonly locale: SupportedLocale;
    /** Catalog names of the plans that grant the dashboard (read on the server). */
    readonly planNames: readonly string[];
    /** Where «Ver planes» goes. */
    readonly plansHref: string;
}

type HostState = { readonly kind: 'loading' } | HostDashboardOutcome;
type ReadyState = Extract<HostDashboardOutcome, { kind: 'ready' }>;

/**
 * Host dashboard island.
 *
 * @param props - See {@link HostDashboardProps}.
 * @returns The stats, the onboarding or the lock, and the analytics.
 */
export function HostDashboard({ locale, planNames, plansHref }: HostDashboardProps): JSX.Element {
    const t = createT(locale);
    const [state, setState] = useState<HostState>({ kind: 'loading' });

    const load = useCallback(async () => {
        setState({ kind: 'loading' });
        try {
            const result = await hostDashboardApi.get();
            setState(resolveHostDashboardOutcome({ result }));
        } catch {
            setState({ kind: 'error' });
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    if (state.kind === 'locked') {
        return (
            <Section
                title={t('host.dashboard.summaryTitle')}
                helpId="section:host.dashboard#locked"
            >
                <LockedState
                    locale={locale}
                    reason={{
                        kind: 'plan',
                        feature: t('host.dashboard.locked.feature'),
                        description: t('host.dashboard.locked.description'),
                        plans: planNames.map((name) => ({ name })),
                        plansHref
                    }}
                />
            </Section>
        );
    }

    const retry = () => void load();
    /** One card's state: an untrustworthy (`null`) value is an error, never a zero. */
    const cardState = (pick: (ready: ReadyState) => StatValue | null): AsyncResult<StatValue> => {
        if (state.kind === 'loading') return { status: 'loading' };
        if (state.kind === 'error') return { status: 'error', retry };
        const data = pick(state);
        return data === null ? { status: 'error', retry } : { status: 'ready', data };
    };

    const propertiesState = cardState(({ properties }) =>
        properties === null
            ? null
            : {
                  value: properties.total,
                  hint: t('host.dashboard.widgets.propertiesHint', undefined, {
                      published: properties.published,
                      draft: properties.draft
                  })
              }
    );
    const unreadState = cardState(({ unread }) => (unread === null ? null : { value: unread }));
    const isEmpty = state.kind === 'ready' && state.properties?.total === 0;

    return (
        <>
            <StatGrid helpId="section:host.dashboard#stats">
                <StatCard
                    id="hostProperties"
                    label={t('host.dashboard.widgets.properties')}
                    state={propertiesState}
                    locale={locale}
                    icon={<BuildingIcon size={20} />}
                    link={{
                        href: buildUrl({ locale, path: 'mi-cuenta/propiedades' }),
                        label: t('host.dashboard.widgets.manage')
                    }}
                />
                <StatCard
                    id="hostUnreadMessages"
                    label={t('host.dashboard.widgets.messages')}
                    state={unreadState}
                    locale={locale}
                    icon={<ChatIcon size={20} />}
                    link={{
                        // The OWNER inbox, never the guest one (HOS-2418).
                        href: buildUrl({ locale, path: 'mi-cuenta/consultas-propietario' }),
                        label: t('host.dashboard.widgets.viewAll')
                    }}
                />
            </StatGrid>

            {isEmpty ? (
                <Section
                    title={t('host.dashboard.onboarding.sectionTitle')}
                    helpId="section:host.dashboard#onboarding"
                >
                    <EmptyState
                        variant="compact"
                        icon={<BuildingIcon size={32} />}
                        title={t('host.dashboard.onboarding.title')}
                        description={t('host.dashboard.onboarding.description')}
                        action={
                            <LinkButton href={buildUrl({ locale, path: 'mi-cuenta/propiedades' })}>
                                {t('host.dashboard.onboarding.action')}
                            </LinkButton>
                        }
                    />
                </Section>
            ) : null}

            {state.kind === 'ready' && !isEmpty ? <AnalyticsSection locale={locale} /> : null}
        </>
    );
}
