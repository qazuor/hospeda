import type { AddonOffersResponse } from '@repo/schemas';
import { getAddonDescription, getAddonName } from '@/lib/billing/addon-purchase';
import type { createTranslations } from '@/lib/i18n';
import styles from './AddonPurchase.module.css';

type Offer = AddonOffersResponse['items'][number];
type Translate = ReturnType<typeof createTranslations>['t'];

/** Select a saleable addon product. */
export function AddonOfferList(input: {
    readonly offers: readonly Offer[];
    readonly isActive?: (offer: Offer) => boolean;
    readonly onSelect: (offer: Offer) => void;
    readonly t: Translate;
}) {
    return (
        <section
            className={styles.section}
            aria-label={input.t('billing.addonPurchase.chooseOffer')}
        >
            <h2>{input.t('billing.addonPurchase.chooseOffer')}</h2>
            {input.offers.length === 0 && <p>{input.t('billing.addonPurchase.noOffers')}</p>}
            <div className={styles.grid}>
                {input.offers.map((offer) => {
                    const description = getAddonDescription({ offer, t: input.t });
                    const active = input.isActive?.(offer) === true;
                    return (
                        <button
                            key={offer.productId}
                            type="button"
                            className={styles.card}
                            data-testid={`addon-offer-${offer.productId}`}
                            disabled={active}
                            onClick={() => input.onSelect(offer)}
                        >
                            <strong>{getAddonName({ offer, t: input.t })}</strong>
                            {description && <span>{description}</span>}
                            {active && (
                                <span className={styles.activeBadge}>
                                    {input.t('billing.addonPurchase.active')}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
