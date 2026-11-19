import type { AddonSubscriptionTarget } from '@/lib/billing/addon-purchase';
import type { createTranslations } from '@/lib/i18n';
import styles from './AddonPurchase.module.css';

type Translate = ReturnType<typeof createTranslations>['t'];

/** Select the principal subscription a `VERTICAL_SUBSCRIPTION` addon hangs from. */
export function AddonSubscriptionPicker(input: {
    readonly items: readonly AddonSubscriptionTarget[];
    readonly isActive?: (item: AddonSubscriptionTarget) => boolean;
    readonly onSelect: (item: AddonSubscriptionTarget) => void;
    readonly t: Translate;
}) {
    return (
        <section
            className={styles.section}
            aria-label={input.t('billing.addonPurchase.chooseSubscription')}
        >
            <h2>{input.t('billing.addonPurchase.chooseSubscription')}</h2>
            {input.items.length === 0 && <p>{input.t('billing.addonPurchase.noSubscriptions')}</p>}
            <div className={styles.grid}>
                {input.items.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={styles.card}
                        data-testid={`addon-subscription-${item.id}`}
                        disabled={input.isActive?.(item) === true}
                        onClick={() => input.onSelect(item)}
                    >
                        <strong>{item.planName}</strong>
                        {input.isActive?.(item) && (
                            <span className={styles.activeBadge}>
                                {input.t('billing.addonPurchase.active')}
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </section>
    );
}
