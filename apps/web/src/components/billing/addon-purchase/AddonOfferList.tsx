import type { AddonOffersResponse } from '@repo/schemas';
import { useState } from 'react';
import { FilterChips } from '@/components/account/ui/FilterChips';
import { OptionCard } from '@/components/account/ui/OptionCard';
import { StatusPill } from '@/components/account/ui/StatusPill';
import { ADDON_CATEGORIES, resolveAddonCategory } from '@/lib/billing/addon-category';
import { ADDON_CATEGORY_ICONS } from '@/lib/billing/addon-category-icons';
import { getAddonDescription, getAddonName } from '@/lib/billing/addon-purchase';
import { formatPrice } from '@/lib/format-utils';
import type { createTranslations, SupportedLocale } from '@/lib/i18n';
import styles from './AddonPurchase.module.css';

type Offer = AddonOffersResponse['items'][number];
type Translate = ReturnType<typeof createTranslations>['t'];

/** Select a saleable addon product. */
export function AddonOfferList(input: {
    readonly offers: readonly Offer[];
    readonly locale: SupportedLocale;
    readonly isActive?: (offer: Offer) => boolean;
    readonly onSelect: (offer: Offer) => void;
    readonly t: Translate;
}) {
    const [category, setCategory] = useState<string | null>('all');
    const categories = ADDON_CATEGORIES.filter((id) =>
        input.offers.some((offer) => resolveAddonCategory(offer) === id)
    );
    const visibleOffers = input.offers.filter(
        (offer) => !category || category === 'all' || resolveAddonCategory(offer) === category
    );
    return (
        <section
            className={styles.section}
            aria-label={input.t('billing.addonPurchase.chooseOffer')}
        >
            <h2>{input.t('billing.addonPurchase.chooseOffer')}</h2>
            {input.offers.length === 0 && <p>{input.t('billing.addonPurchase.noOffers')}</p>}
            <FilterChips
                label={input.t('billing.addonPurchase.filterCategory')}
                value={category ?? 'all'}
                onChange={setCategory}
                items={[
                    {
                        value: 'all',
                        label: input.t('billing.addonPurchase.allCategories'),
                        exclusive: true
                    },
                    ...categories.map((id) => ({
                        value: id,
                        label: input.t(`billing.addonPurchase.category.${id}`)
                    }))
                ]}
            />
            {(['packs', 'boosts'] as const).map((group) => {
                const grouped = visibleOffers.filter(
                    (offer) =>
                        (offer.scopeType === 'VERTICAL_SUBSCRIPTION' &&
                        offer.chargeKind === 'PERIODICO'
                            ? 'packs'
                            : 'boosts') === group
                );
                if (grouped.length === 0) return null;
                return (
                    <div
                        key={group}
                        className={styles.section}
                    >
                        <h3 className={styles.groupTitle}>
                            {input.t(`billing.addonPurchase.group.${group}`)}
                        </h3>
                        <div className={styles.offerGrid}>
                            {grouped.map((offer) => {
                                const description = getAddonDescription({ offer, t: input.t });
                                const active = input.isActive?.(offer) === true;
                                const offerCategory = resolveAddonCategory(offer);
                                const Icon = ADDON_CATEGORY_ICONS[offerCategory];
                                const renewal = offer.cycle
                                    ? input.t(`billing.addonPurchase.cycle.${offer.cycle}`)
                                    : offer.validityDays
                                      ? input.t(
                                            offer.validityDays === 1
                                                ? 'billing.addonPurchase.days_one'
                                                : 'billing.addonPurchase.days_other',
                                            undefined,
                                            { count: offer.validityDays }
                                        )
                                      : input.t('billing.addonPurchase.oneTimeSummary');
                                return (
                                    <OptionCard
                                        key={offer.productId}
                                        data-testid={`addon-offer-${offer.productId}`}
                                        aria-disabled={active || undefined}
                                        onClick={() => {
                                            if (!active) input.onSelect(offer);
                                        }}
                                        title={
                                            <span className={styles.offerHeading}>
                                                <span className={styles.category}>
                                                    <Icon
                                                        size={20}
                                                        aria-hidden={true}
                                                    />
                                                    {input.t(
                                                        `billing.addonPurchase.category.${offerCategory}`
                                                    )}
                                                </span>
                                                <span className={styles.offerTitle}>
                                                    {getAddonName({ offer, t: input.t })}
                                                </span>
                                            </span>
                                        }
                                        description={description || undefined}
                                        meta={
                                            <span className={styles.offerPrice}>
                                                {formatPrice({
                                                    amount: offer.price / 100,
                                                    currency: offer.currency,
                                                    locale: input.locale
                                                })}{' '}
                                                · {renewal}
                                            </span>
                                        }
                                        badge={
                                            active ? (
                                                <StatusPill tone="success">
                                                    {input.t('billing.addonPurchase.active')}
                                                </StatusPill>
                                            ) : undefined
                                        }
                                    />
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </section>
    );
}
