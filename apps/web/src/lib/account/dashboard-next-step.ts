/** Pure selection of a single useful KPI line from data already read by the dashboard. */
import type { TrialSummaryResponse } from '@repo/schemas';
import type { SubscriptionStatText } from '@/lib/account/general-dashboard';
import { resolveDashboardTrialStat } from '@/lib/billing/dashboard-plan-stat';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';

/** Inputs for the account-level KPI context selector. */
export type DashboardNextStepInput = {
    readonly locale: SupportedLocale;
} & (
    | { readonly kind: 'favorites'; readonly count: number }
    | { readonly kind: 'reviews'; readonly count: number }
    | {
          readonly kind: 'subscription';
          readonly text: SubscriptionStatText;
          readonly trialSummaries: readonly TrialSummaryResponse[];
          /** Injected time makes trial countdowns deterministic. */
          readonly now: number;
      }
);

/** Returns exactly one localized next step, or a context line when no action is known. */
export function resolveDashboardNextStep(input: DashboardNextStepInput): string {
    const { t, tPlural } = createTranslations(input.locale);
    if (input.kind === 'favorites') {
        return input.count > 0
            ? tPlural('account.pages.dashboard.stats.favoritesNext', input.count)
            : t('account.pages.dashboard.stats.favoritesEmpty');
    }
    if (input.kind === 'reviews') {
        return input.count > 0
            ? tPlural('account.pages.dashboard.stats.reviewsNext', input.count)
            : t('account.pages.dashboard.stats.reviewsEmpty');
    }
    const { text } = input;
    if (text.action) return text.action;
    // Paid subscriptions have no end date in this payload; never invent one.
    const trial = resolveDashboardTrialStat({ summaries: input.trialSummaries });
    if (trial.kind === 'trial' && trial.endsAt) {
        const remaining = Date.parse(trial.endsAt) - input.now;
        if (Number.isFinite(remaining) && remaining >= 0) {
            const days = Math.ceil(remaining / 86_400_000);
            return days === 0
                ? t('account.pages.dashboard.stats.trialEndsToday')
                : tPlural('account.pages.dashboard.stats.trialNext', days);
        }
    }
    if (text.hint) return text.hint;
    if (text.rows.length > 0) {
        return text.rows.map((row) => `${row.plan} · ${row.status}`).join('; ');
    }
    return t('account.pages.dashboard.stats.planContext');
}
