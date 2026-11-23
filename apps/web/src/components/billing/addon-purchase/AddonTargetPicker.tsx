import type { ListingNoticesItem } from '@repo/schemas';
import { OptionCard, OptionCardGrid } from '@/components/account/ui/OptionCard';
import { StatusPill } from '@/components/account/ui/StatusPill';
import type { createTranslations } from '@/lib/i18n';
import styles from './AddonPurchase.module.css';

/** One eligible listing with the vertical that supplied its publication state. */
export type AddonTarget = ListingNoticesItem & { readonly vertical: string };
type Translate = ReturnType<typeof createTranslations>['t'];

/** Select one listing without interpreting its publication state locally. */
export function AddonTargetPicker(input: {
    readonly items: readonly AddonTarget[];
    readonly isActive?: (item: AddonTarget) => boolean;
    readonly onSelect: (item: AddonTarget) => void;
    readonly t: Translate;
}) {
    return (
        <section
            className={styles.section}
            aria-label={input.t('billing.addonPurchase.chooseTarget')}
        >
            <h2>{input.t('billing.addonPurchase.chooseTarget')}</h2>
            {input.items.length === 0 && <p>{input.t('billing.addonPurchase.noTargets')}</p>}
            <OptionCardGrid>
                {input.items.map((item) => (
                    <OptionCard
                        key={item.listingId}
                        data-testid={`addon-target-${item.listingId}`}
                        data-publication-status={item.publicationStatus}
                        disabled={input.isActive?.(item) === true}
                        onClick={() => input.onSelect(item)}
                        title={item.name}
                        meta={input.t(`billing.addonPurchase.status.${item.publicationStatus}`)}
                        badge={
                            input.isActive?.(item) ? (
                                <StatusPill tone="success">
                                    {input.t('billing.addonPurchase.active')}
                                </StatusPill>
                            ) : undefined
                        }
                    />
                ))}
            </OptionCardGrid>
        </section>
    );
}
