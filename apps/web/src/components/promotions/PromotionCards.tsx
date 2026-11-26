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

import { LockIcon } from '@repo/icons';
import type {
    PromotionLockedItem,
    PromotionVisibilityItem,
    PromotionVisibleItem
} from '@repo/schemas';
import { formatCalendarDate } from '@repo/utils';
import { PlanBadge } from '@/components/shared/ui/PlanBadge';
import { PromotionWindowStatus } from '@/components/venue/PromotionWindowStatus.client';
import { useSession } from '@/lib/auth-client';
import { buildLoginRedirect } from '@/lib/auth-redirect';
import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { isRedundantText } from '@/lib/is-redundant-text';
import { buildUrl } from '@/lib/urls';
import { formatPromotionWindow } from '@/lib/venue/promotion-window';
import styles from './PromotionCards.module.css';

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
    vipPlanName,
    locale,
    item,
    showPlace
}: {
    readonly vipPlanName: string | null;
    readonly locale: SupportedLocale;
    readonly item: PromotionVisibleItem;
    readonly showPlace: boolean;
}) {
    const { t, tPlural } = createTranslations(locale);
    const href = showPlace ? placeHref({ locale, item }) : null;
    const headline = formatPromotionHeadline({
        discountType: item.discountType,
        discountValue: item.discountValue,
        specialOfferText: null,
        locale
    });
    const title = isRedundantText({ a: item.title, b: item.description })
        ? (item.description ?? item.title)
        : item.title;
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
                <h3 className={styles.title}>{title || headline}</h3>
                {item.audience === 'vip' ? <PlanBadge name={vipPlanName} /> : null}
            </div>
            {item.description && !isRedundantText({ a: item.description, b: title }) ? (
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
                    {t(
                        item.entityType === 'venue'
                            ? 'common.promotions.viewVenue'
                            : 'common.promotions.viewAccommodation'
                    )}
                </a>
            ) : null}
        </article>
    );
}

function LockedCard({
    vipPlanName,
    locale,
    item,
    guest
}: {
    readonly vipPlanName: string | null;
    readonly locale: SupportedLocale;
    readonly item: PromotionLockedItem;
    readonly guest: boolean;
}) {
    const { t } = createTranslations(locale);
    const vip = item.audience === 'vip';
    const name =
        vip && vipPlanName
            ? t('common.promotions.lockedPlanName', undefined, { plan: vipPlanName })
            : t(
                  vip || guest
                      ? 'common.promotions.lockedHiddenName'
                      : 'common.promotions.quotaReached'
              );
    return (
        <article
            className={`${styles.card} ${styles.locked}`}
            data-promotion-card="locked"
            data-promotion-audience={item.audience}
        >
            <h3 className={styles.lockRow}>
                <LockIcon
                    size="lg"
                    aria-hidden="true"
                />
                <span>{name}</span>
            </h3>
            <span
                className={styles.placeholder}
                aria-hidden="true"
            />
            <a
                className={styles.placeLink}
                href={
                    guest
                        ? buildLoginRedirect({
                              locale,
                              currentUrl:
                                  typeof window === 'undefined'
                                      ? `/${locale}/promociones/`
                                      : window.location.pathname
                          })
                        : buildUrl({ locale, path: 'planes/turistas/precios' })
                }
            >
                {guest
                    ? t('common.auth.signIn')
                    : vipPlanName
                      ? t('common.promotions.explorePlan', undefined, { plan: vipPlanName })
                      : t('common.promotions.viewPlans')}
            </a>
        </article>
    );
}

/**
 * Renders a grid of visible and locked cards plus the upsell dialog.
 *
 * @param props - See {@link PromotionCardsProps}.
 * @returns The card list.
 */
export function PromotionCards({ locale, items, vipPlanName, showPlace }: PromotionCardsProps) {
    const { data: session } = useSession();
    return (
        <>
            <ul className={styles.grid}>
                {items.map((item) => (
                    <li key={item.kind === 'visible' ? item.id : item.key}>
                        {item.kind === 'visible' ? (
                            <VisibleCard
                                vipPlanName={vipPlanName}
                                locale={locale}
                                item={item}
                                showPlace={showPlace}
                            />
                        ) : (
                            <LockedCard
                                vipPlanName={vipPlanName}
                                locale={locale}
                                item={item}
                                guest={!session?.user}
                            />
                        )}
                    </li>
                ))}
            </ul>
        </>
    );
}
