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
import { computeOpenStatusInZone } from '@/lib/venue/open-now-in-zone';
import type { VenueOpenStatusDetail } from '@/lib/venue-hours';
import styles from './VenueOpenNowBadge.module.css';

interface VenueOpenNowBadgeProps {
    /** Active locale for the badge label. */
    readonly locale: SupportedLocale;
    /** The full week map from the API response. */
    readonly openingHours: Record<string, VenueOpeningHoursEntry>;
    /**
     * `card` (default) is the `position: absolute` overlay on a listing card;
     * `inline` flows in the document, for the venue detail header.
     */
    readonly variant?: 'card' | 'inline';
}

/**
 * Renders the "open now" / "opens at HH:MM" / "closed" badge after hydration.
 *
 * The initial state is `null` (nothing rendered) so the SSR HTML carries no
 * badge; the effect computes the status once on mount. A `null` result — no
 * opening-hours data for today — also renders nothing.
 */
export function VenueOpenNowBadge({
    locale,
    openingHours,
    variant = 'card'
}: VenueOpenNowBadgeProps) {
    const [detail, setDetail] = useState<VenueOpenStatusDetail | null>(null);

    useEffect(() => {
        setDetail(computeOpenStatusInZone({ openingHours, now: new Date() }));
    }, [openingHours]);

    if (detail === null) return null;

    const t = createT(locale);
    let label: string;
    let tone: string;
    if (detail.status === 'open') {
        label = t('venue.card.openNow', 'Abierto ahora');
        tone = styles.open;
    } else if (detail.status === 'opensToday') {
        label = t('venue.card.opensAt', 'Abre a las {{time}}', { time: detail.opensAt });
        tone = styles.opensSoon;
    } else {
        label = t('venue.card.closedNow', 'Cerrado');
        tone = styles.closed;
    }

    return (
        <div
            className={cn(
                styles.badge,
                tone,
                // The detail header sizes every badge in its row the same (HOS-2520).
                variant === 'inline' && styles.inline,
                variant === 'inline' && 'listing-header-badge'
            )}
        >
            {label}
        </div>
    );
}
