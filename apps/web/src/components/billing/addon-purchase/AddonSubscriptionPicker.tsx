import { Alert } from '@/components/account/ui/Alert';
import { LinkButton } from '@/components/account/ui/LinkButton';
import { OptionCard, OptionCardGrid } from '@/components/account/ui/OptionCard';
import { StatusPill } from '@/components/account/ui/StatusPill';
import type { AddonSubscriptionTarget } from '@/lib/billing/addon-purchase';
import type { createTranslations, SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './AddonPurchase.module.css';

type Translate = ReturnType<typeof createTranslations>['t'];

/** Select the principal subscription a `VERTICAL_SUBSCRIPTION` addon hangs from. */
export function AddonSubscriptionPicker(input: {
    readonly items: readonly AddonSubscriptionTarget[];
    readonly isActive?: (item: AddonSubscriptionTarget) => boolean;
    readonly onSelect: (item: AddonSubscriptionTarget) => void;
    /** Where the owner goes to pick a plan when no subscription can carry the addon. */
    readonly plansHref: string;
    /**
     * HOS-2599: why the list is empty. `INACTIVE`: the account has a compatible subscription
     * that is not active now, so the copy points at it instead of claiming the owner has no
     * plan. `NONE` (default): no compatible subscription at all.
     */
    readonly emptyReason?: 'INACTIVE' | 'NONE';
    readonly locale: SupportedLocale;
    readonly t: Translate;
}) {
    const inactive = input.emptyReason === 'INACTIVE';
    return (
        <section
            className={styles.section}
            aria-label={input.t('billing.addonPurchase.chooseSubscription')}
        >
            <h2>{input.t('billing.addonPurchase.chooseSubscription')}</h2>
            {input.items.length === 0 && (
                // HOS-2426: an empty list is a dead end unless it says why and what to do next.
                <div
                    data-testid="addon-no-subscriptions"
                    data-reason={inactive ? 'INACTIVE' : 'NONE'}
                >
                    <Alert
                        tone="info"
                        locale={input.locale}
                        title={input.t('billing.addonPurchase.noSubscriptions')}
                        action={
                            <LinkButton
                                variant="secondary"
                                size="sm"
                                href={
                                    inactive
                                        ? buildUrl({
                                              locale: input.locale,
                                              path: 'mi-cuenta/suscripcion'
                                          })
                                        : input.plansHref
                                }
                                data-testid="addon-no-subscriptions-plans"
                            >
                                {input.t(
                                    inactive
                                        ? 'billing.addonPurchase.noSubscriptionsInactiveCta'
                                        : 'billing.addonPurchase.noSubscriptionsCta'
                                )}
                            </LinkButton>
                        }
                    >
                        {input.t(
                            inactive
                                ? 'billing.addonPurchase.noSubscriptionsInactiveBody'
                                : 'billing.addonPurchase.noSubscriptionsBody'
                        )}
                    </Alert>
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
