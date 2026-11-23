import { OptionCard, OptionCardGrid } from '@/components/account/ui/OptionCard';
import { StatusPill } from '@/components/account/ui/StatusPill';
import type { AddonSubscriptionTarget } from '@/lib/billing/addon-purchase';
import type { createTranslations } from '@/lib/i18n';
import styles from './AddonPurchase.module.css';

type Translate = ReturnType<typeof createTranslations>['t'];

/** Select the principal subscription a `VERTICAL_SUBSCRIPTION` addon hangs from. */
export function AddonSubscriptionPicker(input: {
    readonly items: readonly AddonSubscriptionTarget[];
    readonly isActive?: (item: AddonSubscriptionTarget) => boolean;
    readonly onSelect: (item: AddonSubscriptionTarget) => void;
    /** Where the owner goes to pick a plan when no subscription can carry the addon. */
    readonly plansHref: string;
    readonly t: Translate;
}) {
    return (
        <section
            className={styles.section}
            aria-label={input.t('billing.addonPurchase.chooseSubscription')}
        >
            <h2>{input.t('billing.addonPurchase.chooseSubscription')}</h2>
            {input.items.length === 0 && (
                // HOS-2426: an empty list is a dead end unless it says why and what to do next.
                <div
                    className={styles.notice}
                    data-testid="addon-no-subscriptions"
                >
                    <p>
                        <strong>{input.t('billing.addonPurchase.noSubscriptions')}</strong>
                    </p>
                    <p>{input.t('billing.addonPurchase.noSubscriptionsBody')}</p>
                    <a
                        href={input.plansHref}
                        data-testid="addon-no-subscriptions-plans"
                    >
                        {input.t('billing.addonPurchase.noSubscriptionsCta')}
                    </a>
                </div>
            )}
            <OptionCardGrid>
                {input.items.map((item) => (
                    <OptionCard
                        key={item.id}
                        data-testid={`addon-subscription-${item.id}`}
                        disabled={input.isActive?.(item) === true}
                        onClick={() => input.onSelect(item)}
                        title={item.planName}
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
