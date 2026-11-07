/** Grace-period copy for blocking plan changes by payment method. */
export const GRACE_PLAN_CHANGE_KEY: Record<'CARD' | 'MANUAL', string> = {
    CARD: 'account.subscription.mine.graceChangePlan.CARD',
    MANUAL: 'account.subscription.mine.graceChangePlan.MANUAL'
};

/** Base plural key for a deferred courtesy balance and its payment condition. */
export const DEFERRED_COURTESY_KEY = 'account.subscription.mine.deferredCourtesy';
