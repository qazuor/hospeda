import type { PromotionWindow } from '@repo/schemas';
import { useEffect, useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { isPromotionWindowActive } from '@/lib/venue/promotion-window';

/** Cached card badge that swaps its static promotion label to «Now» in-browser. */
export function VenuePromoBadge({
    windows,
    vipOnly,
    locale
}: {
    readonly windows: readonly PromotionWindow[];
    readonly vipOnly: boolean;
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
            {active
                ? t('venue.card.promoNow', 'Ahora')
                : vipOnly
                  ? t('venue.card.promoVip', 'Promo VIP')
                  : t('venue.card.promo', 'Promo')}
        </span>
    );
}
