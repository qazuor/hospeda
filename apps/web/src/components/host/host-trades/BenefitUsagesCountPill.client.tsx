/**
 * @file BenefitUsagesCountPill.client.tsx
 * @description Pending-usage count for the account nav (HOS-376 T-047, §6.6).
 *
 * Modelled on `WhatsNewCountPill`, with ONE deliberate difference that is the
 * whole point of the badge: it clears when the usage is RESOLVED, never when the
 * page is seen. There is no "mark as seen" call here and there must never be —
 * a pending usage that disappears from the badge because the host glanced at the
 * list is still a usage somebody is waiting on, and the entire feature exists
 * because that wait is where the funnel breaks (§R-4).
 *
 * It counts exactly the rows `/usages/pending` lists, from the same definition
 * in the model, so the badge and the list underneath it cannot disagree.
 */

import { useCallback, useEffect, useState } from 'react';
import { hostTradesApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './BenefitUsagesPanel.module.css';

/**
 * Announced on `window` when a usage is confirmed, rejected or un-rejected.
 *
 * The badge and the panel are separate islands with no shared store, so this is
 * how resolving a row on the page drops the count in the navigation without a
 * reload. Exported so both sides name the same string.
 */
export const BENEFIT_USAGES_UPDATED_EVENT = 'hospeda:benefit-usages-updated';

/** Above this the glyph is capped; the label still carries the real number. */
const GLYPH_CAP = 99;

interface BenefitUsagesCountPillProps {
    readonly locale: SupportedLocale;
}

/**
 * Renders the pending-usage count as a compact inline pill.
 *
 * @param props - Component props.
 * @param props.locale - Active locale for the accessible label.
 * @returns The pill, or `null` when nothing is pending or the count is unknown.
 */
export function BenefitUsagesCountPill({ locale }: BenefitUsagesCountPillProps) {
    const { t } = createTranslations(locale);
    const [count, setCount] = useState(0);

    const readCount = useCallback(async () => {
        const result = await hostTradesApi.countPendingUsages();
        // A failed read renders nothing rather than a zero: claiming "nothing
        // pending" to a host who has three is worse than showing no badge.
        setCount(result.ok ? result.data.count : 0);
    }, []);

    useEffect(() => {
        void readCount();

        const onResolved = () => {
            void readCount();
        };
        window.addEventListener(BENEFIT_USAGES_UPDATED_EVENT, onResolved);
        return () => window.removeEventListener(BENEFIT_USAGES_UPDATED_EVENT, onResolved);
    }, [readCount]);

    if (count <= 0) {
        return null;
    }

    const label = t(
        'host-trades.usages.badge.pendingCount',
        '{{count}} usos esperan tu confirmación',
        { count: String(count) }
    );

    return (
        <span
            aria-label={label}
            className={styles.countPill}
            role="status"
        >
            {count > GLYPH_CAP ? `${GLYPH_CAP}+` : count}
        </span>
    );
}
