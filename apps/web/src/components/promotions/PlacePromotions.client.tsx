/**
 * @file PlacePromotions.client.tsx
 * @description Per-reader promotions of one accommodation or venue (HOS-2589 §7.6).
 *
 * The detail pages are session-blind and cached, so they carry no promotion data:
 * this island reads `GET /public/owner-promotions/visible` with the session cookie
 * and the session-stable seed of this place, then renders the visible and blurred
 * cards. It renders nothing while loading, on a failed read, or when the place has
 * no active promotion.
 *
 * Hydration: `client:idle` (it renders nothing until the read settles, so a
 * `client:visible` mount would have no box to observe and never hydrate).
 */

import type { PromotionVisibleResponse } from '@repo/schemas';
import { useEffect, useId, useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { getPromotionSeed } from '@/lib/promotions/promotion-seed';
import { fetchVisiblePromotions } from '@/lib/promotions/visible-promotions-api';
import { PromotionCards } from './PromotionCards';
import styles from './PromotionCards.module.css';
import { useVipPlanName } from './use-promotion-policy';

/** Props of {@link PlacePromotions}. */
export interface PlacePromotionsProps {
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
    readonly entityType: 'accommodation' | 'venue';
    readonly entityId: string;
}

/**
 * Promotions section of a detail page.
 *
 * @param props - See {@link PlacePromotionsProps}.
 * @returns The section, or nothing.
 */
export function PlacePromotions({ locale, apiUrl, entityType, entityId }: PlacePromotionsProps) {
    const { t } = createTranslations(locale);
    const headingId = useId();
    const [data, setData] = useState<PromotionVisibleResponse | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async (): Promise<void> => {
            const { seed } = getPromotionSeed({ context: `${entityType}:${entityId}` });
            const result = await fetchVisiblePromotions({ apiUrl, entityType, entityId, seed });
            if (!cancelled && result.ok) setData(result.data);
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [apiUrl, entityType, entityId]);

    const hasLocked =
        data?.items.some((item) => item.kind === 'locked' || item.audience === 'vip') ?? false;
    const { vipPlanName } = useVipPlanName({ apiUrl, enabled: hasLocked });

    if (!data || data.items.length === 0) return null;

    return (
        <section
            className={styles.section}
            aria-labelledby={headingId}
            data-testid="place-promotions"
        >
            <h2
                id={headingId}
                className={styles.sectionTitle}
            >
                {t('common.promotions.sectionTitle')}
            </h2>
            <PromotionCards
                locale={locale}
                items={data.items}
                freeQuota={data.meta.freeQuota}
                vipPlanName={vipPlanName}
                showPlace={false}
            />
        </section>
    );
}
