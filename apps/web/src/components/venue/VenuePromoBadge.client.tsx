import type { PromotionWindow } from '@repo/schemas';
import { useEffect, useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { isPromotionWindowActive } from '@/lib/venue/promotion-window';

/**
 * Cached card «Promo» badge that swaps its label to «Now» in-browser. The «VIP»
 * badge is a separate static badge (HOS-2589 D-6).
 */
export function VenuePromoBadge({
    windows,
    locale
}: {
    readonly windows: readonly PromotionWindow[];
    readonly locale: SupportedLocale;
}) {
    const [active, setActive] = useState(false);
    useEffect(() => {
        const now = new Date();
        setActive(windows.some((window) => isPromotionWindowActive({ window, now })));
    }, [windows]);
    const t = createT(locale);
    return (
        <span
            className={['venue-card__promo-badge', active && 'venue-card__promo-badge--active']
                .filter(Boolean)
                .join(' ')}
        >
            {active ? t('venue.card.promoNow', 'Ahora') : t('venue.card.promo', 'Promo')}
        </span>
    );
}
