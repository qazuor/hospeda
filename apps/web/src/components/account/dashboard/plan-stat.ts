/**
 * The «plan» KPI of the account dashboards (HOS-2473, HOS-2664): the current
 * plan plus ONE next-step line, read from the real `/user/stats` payload and the
 * real trial summaries. Shared by the general dashboard and the host dashboard so
 * both cards say the same thing from the same code.
 *
 * @module components/account/dashboard/plan-stat
 */

import type { TrialSummaryResponse, UserStatsResponse } from '@repo/schemas';
import type { StatValue } from '@/components/account/ui';
import { resolveDashboardNextStep } from '@/lib/account/dashboard-next-step';
import { resolveSubscriptionStatText } from '@/lib/account/general-dashboard';
import { publishApi } from '@/lib/api/endpoints-protected';
import type { createT, SupportedLocale } from '@/lib/i18n';
import { formatNoticeInstant } from '@/lib/listing/listing-notices';

/** A trial read that takes longer than this is left out (the card keeps the free label). */
const TRIAL_READ_TIMEOUT_MS = 3000;

/** Reads every vertical's trial; a failure or timeout leaves that vertical out. Never rejects. */
export async function readTrialSummaries(): Promise<readonly TrialSummaryResponse[]> {
    const reads = await Promise.all(
        (['accommodation', 'venue', 'experience'] as const).map(async (vertical) => {
            try {
                const result = await Promise.race([
                    publishApi.trialSummary({ vertical }),
                    new Promise<null>((resolve) => {
                        setTimeout(() => resolve(null), TRIAL_READ_TIMEOUT_MS);
                    })
                ]);
                return result?.ok ? [result.data] : [];
            } catch {
                return [];
            }
        })
    );
    return reads.flat();
}

/** What {@link resolvePlanStat} returns: the card value and whether the link says «all». */
export interface PlanStat {
    readonly stat: StatValue;
    /** True when the account holds several subscriptions. */
    readonly viewAll: boolean;
}

/**
 * Builds the plan card's value from the stats read.
 *
 * @param input.stats - The `/user/stats` payload.
 * @param input.planNames - Catalog plan names by slug (read on the server).
 * @param input.locale - Active locale.
 * @param input.t - Translator for `locale`.
 * @returns The value (plan, one next-step line, detail) and the link flavour.
 */
export async function resolvePlanStat({
    stats,
    planNames,
    locale,
    t
}: {
    readonly stats: UserStatsResponse;
    readonly planNames: Readonly<Record<string, string>>;
    readonly locale: SupportedLocale;
    readonly t: ReturnType<typeof createT>;
}): Promise<PlanStat> {
    const needsTrial =
        stats.plan === null &&
        stats.activeSubscriptionsCount < 2 &&
        (stats.subscriptions?.length ?? 0) < 2;
    const trialSummaries = needsTrial ? await readTrialSummaries() : [];
    const text = resolveSubscriptionStatText({
        stats,
        planNames,
        trialSummaries,
        t,
        formatDate: (iso) => formatNoticeInstant({ iso, locale })
    });
    return {
        viewAll: text.viewAll,
        stat: {
            value: text.value,
            nextStep: resolveDashboardNextStep({
                kind: 'subscription',
                locale,
                text,
                trialSummaries,
                now: Date.now()
            }),
            detail:
                [text.hint, ...text.rows.map((row) => `${row.plan} · ${row.status}`), text.action]
                    .filter(Boolean)
                    .join('; ') || undefined
        }
    };
}
