import type { PromotionWindow } from '@repo/schemas';
import { useEffect, useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { isPromotionLive } from '@/lib/venue/promotion-window';

/** Client-only status label for one scheduled venue promotion. */
export function PromotionWindowStatus({
    window,
    validFrom,
    validUntil,
    locale
}: {
    readonly window: PromotionWindow;
    readonly validFrom: string | Date;
    readonly validUntil?: string | Date | null;
    readonly locale: SupportedLocale;
}) {
    const [live, setLive] = useState(false);
    useEffect(() => {
        setLive(isPromotionLive({ promo: { window, validFrom, validUntil }, now: new Date() }));
    }, [window, validFrom, validUntil]);
    if (!live) return null;
    return (
        <span className="venue-promotion-now">
            {createT(locale)('venue.detail.promotions.window.now', 'Ahora')}
        </span>
    );
}
