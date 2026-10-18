import type { OwnSubscriptionStatus } from './self-cancel';

/** Shared AU notice text; B8b removes it and HOS-1621 reuses it on pricing (AC:B13a:7). */
export const PLAN_CHANGE_UNAVAILABLE_KEY = 'account.subscription.mine.planChangeUnavailable';

/** Statuses that show the cut's plan-change notice. */
export const PLAN_CHANGE_UNAVAILABLE: Record<OwnSubscriptionStatus, boolean> = {
    ACTIVE: true,
    GRACE_PERIOD: false,
    SUSPENDED: false,
    CANCEL_SCHEDULED: false
};

/** Base plural key for a deferred courtesy balance and its payment condition. */
export const DEFERRED_COURTESY_KEY = 'account.subscription.mine.deferredCourtesy';
