/**
 * @file TrialRemainingDaysBanner.client.tsx
 * @description "Your trial is running and N days are left", on every pricing
 * page. HOS-1233 T-020 / AC-7 / AC-8 / AC-10.
 *
 * Before this, the pricing page rendered identically for somebody who never
 * tried, somebody on day 2 of their trial, and somebody who already burned it
 * (§2.2). This is the only thing on the page that can tell them apart.
 *
 * ## It is an ISLAND, and that is an architecture decision (OQ-2 → F-8)
 *
 * The five `/planes/…/precios/` pages are edge-cached (`CACHE_TAG_PRICING`) and
 * must not parse the session: a personalised response in a shared cache serves
 * one visitor's trial to the next, which is the exact failure
 * `test/pages/cacheable-pages-are-session-blind.guard.test.ts` exists to
 * prevent. So the day count is resolved in the browser, after hydration, and
 * the server-rendered HTML says nothing about the visitor. The cost is a flash
 * of no-banner; the alternative was taking a conversion-critical page out of
 * the cache.
 *
 * This is also why it does not follow the SSR-first principle the rest of this
 * app's islands do (`apps/web/CLAUDE.md`): there IS no server-rendered value to
 * seed from, by design. Nothing here is indexable content — a crawler reading
 * the raw HTML correctly sees a page with no trial banner, because a crawler
 * has no trial.
 *
 * ## Three states, and only one of them renders
 *
 * - Not authenticated, or the page's audience has no trial scope (aliados) —
 *   nothing renders and nothing is fetched. `?productDomain=partner` is a 400,
 *   not an unused escape hatch.
 * - The clock is unresolved, failed, or reports no running trial — nothing
 *   renders. AC-9's direction for a READ: an unknown clock never renders a
 *   trial promise. AC-8's: no banner and no day count, never "0 días".
 * - A trial is running with a real day count — the banner renders.
 */

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { fetchTrialClock } from '@/lib/billing/trial-clock';
import type { TrialClockReading } from '@/lib/billing/trial-start-branch';
import { resolveTrialScopeForAudience } from '@/lib/billing/trial-start-branch';
import type { PricingAudience } from '@/lib/billing-i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './TrialRemainingDaysBanner.module.css';

/**
 * Props for {@link TrialRemainingDaysBanner}.
 */
export interface TrialRemainingDaysBannerProps {
    /** Current locale for translations. */
    readonly locale: SupportedLocale;
    /**
     * The audience of the page this banner sits on. Decides WHICH vertical's
     * clock is read — a host's trial must never be announced on the traveller
     * page — and whether one is read at all.
     */
    readonly audience: PricingAudience;
}

/**
 * Renders the remaining-days banner, or nothing at all.
 *
 * @param props - Locale and the page's audience.
 * @returns The banner element, or `null` in every state that has no running
 *   trial to report.
 */
export function TrialRemainingDaysBanner({
    locale,
    audience
}: TrialRemainingDaysBannerProps): JSX.Element | null {
    const { data: session, isPending: sessionPending } = useSession();
    const [reading, setReading] = useState<TrialClockReading | null>(null);

    const { t, tPlural } = createTranslations(locale);
    const isAuthenticated = !sessionPending && Boolean(session?.user);
    const trialScope = resolveTrialScopeForAudience({ audience });

    useEffect(() => {
        if (!isAuthenticated || trialScope === null) {
            setReading(null);
            return;
        }
        let cancelled = false;
        fetchTrialClock({ productDomain: trialScope }).then((clock) => {
            if (!cancelled) setReading(clock);
        });
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, trialScope]);

    const daysRemaining = reading?.daysRemaining ?? null;
    // Every condition is required and none is redundant. `reading?.isOnTrial
    // === true` covers BOTH the unresolved read (`reading` is `null`) and an
    // elapsed or unstarted trial; `> 0` is F-9's rule — a day count is optional
    // and never zero, so a contradictory payload (a running trial reporting no
    // days) renders no banner rather than "te quedan 0 días".
    const shouldRender =
        reading?.isOnTrial === true && typeof daysRemaining === 'number' && daysRemaining > 0;

    if (!shouldRender) {
        return null;
    }

    return (
        <aside
            className={styles.banner}
            data-testid="trial-remaining-days-banner"
        >
            <p className={styles.message}>
                {tPlural('pricing.trialBanner.message', daysRemaining, {
                    count: daysRemaining
                })}
            </p>
            <p className={styles.hint}>{t('pricing.trialBanner.hint')}</p>
        </aside>
    );
}
