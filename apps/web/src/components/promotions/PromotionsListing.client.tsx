/**
 * @file PromotionsListing.client.tsx
 * @description The list of the public `/{lang}/promociones/` page (HOS-2589 D-2).
 *
 * The page SSR renders only the shell; this island reads
 * `GET /public/owner-promotions/listing` per page with the session cookie and the
 * session-stable `listing` seed, so a free reader keeps the same pick on every page
 * for the whole browser session (AC-31). States: loading, error with retry, empty,
 * and the cards with previous/next pagination.
 *
 * Hydration: `client:load`.
 */

import type { PromotionListingResponse } from '@repo/schemas';
import { useCallback, useEffect, useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { getPromotionSeed } from '@/lib/promotions/promotion-seed';
import { fetchListingPromotions } from '@/lib/promotions/visible-promotions-api';
import { PromotionCards } from './PromotionCards';
import styles from './PromotionCards.module.css';
import { useVipPlanName } from './use-promotion-policy';

/** Cards per page. */
export const PROMOTIONS_PAGE_SIZE = 12;

/** Props of {@link PromotionsListing}. */
export interface PromotionsListingProps {
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
}

type ListingState =
    | { readonly kind: 'loading' }
    | { readonly kind: 'error' }
    | { readonly kind: 'ready'; readonly data: PromotionListingResponse };

/**
 * The promotions listing island.
 *
 * @param props - See {@link PromotionsListingProps}.
 * @returns The list region.
 */
export function PromotionsListing({ locale, apiUrl }: PromotionsListingProps) {
    const { t } = createTranslations(locale);
    const [page, setPage] = useState(1);
    const [state, setState] = useState<ListingState>({ kind: 'loading' });

    const load = useCallback(
        async (target: number): Promise<void> => {
            setState({ kind: 'loading' });
            const { seed } = getPromotionSeed({ context: 'listing' });
            const result = await fetchListingPromotions({
                apiUrl,
                page: target,
                pageSize: PROMOTIONS_PAGE_SIZE,
                seed
            });
            setState(result.ok ? { kind: 'ready', data: result.data } : { kind: 'error' });
        },
        [apiUrl]
    );

    useEffect(() => {
        void load(page);
    }, [load, page]);

    const hasLocked =
        state.kind === 'ready' && state.data.items.some((item) => item.kind === 'locked');
    const { vipPlanName } = useVipPlanName({ apiUrl, enabled: hasLocked });

    if (state.kind === 'loading') {
        return (
            <p
                className={styles.status}
                aria-busy="true"
            >
                {t('common.loading')}
            </p>
        );
    }
    if (state.kind === 'error') {
        return (
            <div
                className={styles.section}
                role="alert"
            >
                <p className={styles.status}>{t('common.promotions.loadError')}</p>
                <div>
                    <button
                        type="button"
                        className={styles.pageButton}
                        onClick={() => void load(page)}
                    >
                        {t('common.retry')}
                    </button>
                </div>
            </div>
        );
    }

    const { items, meta, pagination } = state.data;
    if (items.length === 0) {
        return <p className={styles.status}>{t('common.promotions.page.empty')}</p>;
    }

    return (
        <div
            className={styles.section}
            data-testid="promotions-listing"
        >
            <PromotionCards
                locale={locale}
                items={items}
                freeQuota={meta.freeQuota}
                vipPlanName={vipPlanName}
                showPlace
            />
            {pagination.totalPages > 1 ? (
                <nav
                    className={styles.pagination}
                    aria-label={t('common.promotions.page.paginationLabel')}
                >
                    <button
                        type="button"
                        className={styles.pageButton}
                        disabled={pagination.page <= 1}
                        onClick={() => setPage(pagination.page - 1)}
                    >
                        {t('common.promotions.page.previous')}
                    </button>
                    <span>
                        {t('common.promotions.page.pageStatus', undefined, {
                            page: pagination.page,
                            total: pagination.totalPages
                        })}
                    </span>
                    <button
                        type="button"
                        className={styles.pageButton}
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => setPage(pagination.page + 1)}
                    >
                        {t('common.promotions.page.next')}
                    </button>
                </nav>
            ) : null}
        </div>
    );
}
