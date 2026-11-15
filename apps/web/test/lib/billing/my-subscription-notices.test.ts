import { expect, it } from 'vitest';
import { GRACE_PLAN_CHANGE_KEY } from '../../../src/lib/billing/my-subscription-notices';

it('exposes grace plan-change keys for card and manual payments', () => {
    expect(GRACE_PLAN_CHANGE_KEY).toEqual({
        CARD: 'account.subscription.mine.graceChangePlan.CARD',
        MANUAL: 'account.subscription.mine.graceChangePlan.MANUAL'
    });
});
