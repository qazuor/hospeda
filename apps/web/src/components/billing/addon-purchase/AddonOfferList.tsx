import type { AddonOffersResponse } from '@repo/schemas';
import { OptionCard, OptionCardGrid } from '@/components/account/ui/OptionCard';
import { StatusPill } from '@/components/account/ui/StatusPill';
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
            <OptionCardGrid>
                {input.offers.map((offer) => {
                    const description = getAddonDescription({ offer, t: input.t });
                    const active = input.isActive?.(offer) === true;
                    return (
                        <OptionCard
                            key={offer.productId}
                            data-testid={`addon-offer-${offer.productId}`}
                            disabled={active}
                            onClick={() => input.onSelect(offer)}
                            title={getAddonName({ offer, t: input.t })}
                            description={description || undefined}
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
            </OptionCardGrid>
        </section>
    );
}
