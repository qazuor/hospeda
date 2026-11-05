/**
 * @file VenueOpenNowBadge.client.tsx
 * @description Client island that renders the venue card's "open now" badge
 * (HOS-1787 leaf 6.3, AC:6:7).
 *
 * The listing HTML is edge-cached, so a badge rendered on the server would stay
 * frozen for the whole TTL of the page. This island therefore renders NOTHING on
 * the server and on the first client render, computes once after mounting from
 * the browser clock (in the venue's time zone, never the visitor's), and only
 * then paints the badge. It sits on `position: absolute` over the card image, so
 * appearing after hydration does not move the layout.
 *
 * No interval on purpose: the status is computed at hydration time and the next
 * navigation recalculates it.
 */

import { useEffect, useState } from 'react';
import type { VenueOpeningHoursEntry } from '@/data/types';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { computeOpenNowInZone } from '@/lib/venue/open-now-in-zone';
import styles from './VenueOpenNowBadge.module.css';

interface VenueOpenNowBadgeProps {
    /** Active locale for the badge label. */
    readonly locale: SupportedLocale;
    /** The full week map from the API response. */
    readonly openingHours: Record<string, VenueOpeningHoursEntry>;
}

/**
 * Renders the "open now" / "closed now" badge after hydration.
 *
 * The initial state is `null` (nothing rendered) so the SSR HTML carries no
 * badge; the effect computes the status once on mount. A `null` result — no
 * opening-hours data for today — also renders nothing.
 */
export function VenueOpenNowBadge({ locale, openingHours }: VenueOpenNowBadgeProps) {
    const [status, setStatus] = useState<boolean | null>(null);

    useEffect(() => {
        setStatus(computeOpenNowInZone({ openingHours, now: new Date() }));
    }, [openingHours]);

    if (status === null) return null;

    const t = createT(locale);
    const label = status
        ? t('venue.card.openNow', 'Abierto ahora')
        : t('venue.card.closedNow', 'Cerrado ahora');

    return <div className={cn(styles.badge, status ? styles.open : styles.closed)}>{label}</div>;
}
