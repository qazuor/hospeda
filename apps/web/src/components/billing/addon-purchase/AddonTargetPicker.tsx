import type { ListingNoticesItem } from '@repo/schemas';
import type { createTranslations } from '@/lib/i18n';
import styles from './AddonPurchase.module.css';

/** One eligible listing with the vertical that supplied its publication state. */
export type AddonTarget = ListingNoticesItem & { readonly vertical: string };
type Translate = ReturnType<typeof createTranslations>['t'];

/** Select one listing without interpreting its publication state locally. */
export function AddonTargetPicker(input: {
    readonly items: readonly AddonTarget[];
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
            <div className={styles.grid}>
                {input.items.map((item) => (
                    <button
                        key={item.listingId}
                        type="button"
                        className={styles.card}
                        data-testid={`addon-target-${item.listingId}`}
                        data-publication-status={item.publicationStatus}
                        onClick={() => input.onSelect(item)}
                    >
                        <span>{item.listingId}</span>
                        <span>
                            {input.t(`billing.addonPurchase.status.${item.publicationStatus}`)}
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
}
