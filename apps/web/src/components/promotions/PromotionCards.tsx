/**
 * @file PromotionCards.tsx
 * @description The visible and blurred promotion cards of the free / VIP model
 * (HOS-2589 §7.4, §7.6, §9). Shared by the detail-page island and the
 * `/promociones/` island.
 *
 * - A visible card shows the promotion; a «Solo VIP» one (seen by a VIP) carries
 *   the VIP badge as a mark of exclusivity (AC-13).
 * - A locked card shows only what the API sent: the discount value and type and a
 *   server-generated placeholder in place of the place name, blurred. It is a
 *   focusable `aria-disabled` button with an accessible name; click, Enter or
 *   Space opens the upsell dialog and never navigates (AC-9).
 */

import { CrownIcon, LockIcon } from '@repo/icons';
import type {
    PromotionLockedItem,
    PromotionVisibilityItem,
    PromotionVisibleItem
} from '@repo/schemas';
import { formatCalendarDate } from '@repo/utils';
import { useState } from 'react';
import { PromotionWindowStatus } from '@/components/venue/PromotionWindowStatus.client';
import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { formatPromotionWindow } from '@/lib/venue/promotion-window';
import styles from './PromotionCards.module.css';
import { PromotionUpsellDialog } from './PromotionUpsellDialog';

/** Props of {@link PromotionCards}. */
export interface PromotionCardsProps {
    readonly locale: SupportedLocale;
    readonly items: readonly PromotionVisibilityItem[];
    readonly freeQuota: number | null;
    readonly vipPlanName: string | null;
    /** Show (and link) the place of each visible card: on for the listing page. */
    readonly showPlace: boolean;
}

/**
 * Formats the discount headline of any card from its type and value only.
 *
 * @param input - Discount fields, the free text of a visible special offer, locale.
 * @returns The headline.
 */
export function formatPromotionHeadline(input: {
    readonly discountType: string;
    readonly discountValue: number;
    readonly specialOfferText: string | null;
    readonly locale: SupportedLocale;
}): string {
    const { t } = createTranslations(input.locale);
    switch (input.discountType) {
        case 'percentage':
            return t('common.promotions.percentOff', undefined, { value: input.discountValue });
        case 'fixed':
            return t('common.promotions.amountOff', undefined, {
                value: formatPrice({ amount: input.discountValue, locale: input.locale })
            });
        case 'free_night':
            return t('common.promotions.discountTypes.free_night');
        default:
            return input.specialOfferText ?? t('common.promotions.discountTypes.special_offer');
    }
}

function placeHref(input: {
    readonly locale: SupportedLocale;
    readonly item: PromotionVisibleItem;
}): string | null {
    if (!input.item.place) return null;
    const section = input.item.entityType === 'venue' ? 'comer-y-salir' : 'alojamientos';
    return buildUrl({ locale: input.locale, path: `${section}/${input.item.place.slug}` });
}

function VisibleCard({
    locale,
    item,
    showPlace
}: {
    readonly locale: SupportedLocale;
    readonly item: PromotionVisibleItem;
    readonly showPlace: boolean;
}) {
    const { t, tPlural } = createTranslations(locale);
    const href = showPlace ? placeHref({ locale, item }) : null;
    const validUntil = item.validUntil
        ? formatCalendarDate({
              value: item.validUntil.toISOString(),
              locale,
              options: { dateStyle: 'long' }
          })
        : null;
    return (
        <article
            className={styles.card}
            data-promotion-card="visible"
        >
            <div className={styles.cardTop}>
                <p className={styles.headline}>
                    {formatPromotionHeadline({
                        discountType: item.discountType,
                        discountValue: item.discountValue,
                        specialOfferText: item.description,
                        locale
                    })}
                </p>
                {item.audience === 'vip' ? (
                    <span className={styles.vipBadge}>
                        <CrownIcon
                            size="xs"
                            aria-hidden="true"
                        />
                        {t('common.promotions.vipBadge')}
                    </span>
                ) : null}
            </div>
            <h3 className={styles.title}>{item.title}</h3>
            {item.discountType !== 'special_offer' && item.description ? (
                <p className={styles.description}>{item.description}</p>
            ) : null}
            {item.window ? (
                <p className={styles.meta}>
                    <span>{formatPromotionWindow({ window: item.window, locale })}</span>
                    <PromotionWindowStatus
                        window={item.window}
                        validFrom={item.validFrom}
                        validUntil={item.validUntil}
                        locale={locale}
                    />
                </p>
            ) : null}
            <p className={styles.meta}>
                {item.minNights === null ? null : (
                    <span>{tPlural('common.promotions.minNights', item.minNights)}</span>
                )}
                {validUntil ? (
                    <span>
                        {t('common.promotions.validUntil', undefined, { date: validUntil })}
                    </span>
                ) : null}
            </p>
            {href && item.place ? (
                <a
                    className={styles.placeLink}
                    href={href}
                >
                    {t('common.promotions.viewPlace', undefined, { name: item.place.name })}
                </a>
            ) : null}
        </article>
    );
}

function LockedCard({
    locale,
    item,
    onOpen
}: {
    readonly locale: SupportedLocale;
    readonly item: PromotionLockedItem;
    readonly onOpen: () => void;
}) {
    const { t } = createTranslations(locale);
    const name =
        item.audience === 'vip'
            ? t('common.promotions.lockedVipName')
            : t('common.promotions.lockedHiddenName');
    return (
        <button
            type="button"
            className={`${styles.card} ${styles.locked}`}
            aria-disabled="true"
            aria-label={name}
            aria-haspopup="dialog"
            data-promotion-card="locked"
            onClick={onOpen}
        >
            <span className={styles.cardTop}>
                <span className={styles.headline}>
                    {formatPromotionHeadline({
                        discountType: item.discountType,
                        discountValue: item.discountValue,
                        specialOfferText: null,
                        locale
                    })}
                </span>
                {item.audience === 'vip' ? (
                    <span className={styles.vipBadge}>
                        <CrownIcon
                            size="xs"
                            aria-hidden="true"
                        />
                        {t('common.promotions.vipBadge')}
                    </span>
                ) : null}
            </span>
            <span className={styles.typeLabel}>
                {t(`common.promotions.discountTypes.${item.discountType}`)}
            </span>
            <span
                className={styles.placeholder}
                aria-hidden="true"
            >
                {item.placeholderName}
            </span>
            <span className={styles.lockRow}>
                <LockIcon
                    size="sm"
                    aria-hidden="true"
                />
                <span>{name}</span>
            </span>
        </button>
    );
}

/**
 * Renders a grid of visible and locked cards plus the upsell dialog.
 *
 * @param props - See {@link PromotionCardsProps}.
 * @returns The card list.
 */
export function PromotionCards({
    locale,
    items,
    freeQuota,
    vipPlanName,
    showPlace
}: PromotionCardsProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    return (
        <>
            <ul className={styles.grid}>
                {items.map((item) => (
                    <li key={item.kind === 'visible' ? item.id : item.key}>
                        {item.kind === 'visible' ? (
                            <VisibleCard
                                locale={locale}
                                item={item}
                                showPlace={showPlace}
                            />
                        ) : (
                            <LockedCard
                                locale={locale}
                                item={item}
                                onOpen={() => setDialogOpen(true)}
                            />
                        )}
                    </li>
                ))}
            </ul>
            <PromotionUpsellDialog
                locale={locale}
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                freeQuota={freeQuota}
                vipPlanName={vipPlanName}
            />
        </>
    );
}
