import type { SelectSubscription } from '@repo/db';
import type { SignupNoticeResponse } from '@repo/schemas';
import { createCutExpectedAmountPolicy, readLivePromos } from '@repo/service-core';

/** The promo block of a signup-notice plan (HOS-2382). */
export type SignupNoticePromo = NonNullable<SignupNoticeResponse['plan']['promo']>;

/**
 * Resolves the promo applied to a pending subscription, so the checkout can
 * show what the provider will actually charge instead of the list price.
 *
 * The amount comes from the expected-amount policy with the `AUTHORIZATION`
 * purpose (what the provider charges next, the same figure the reconciliation
 * sweep compares), never from web-side arithmetic. Returns `null` when the
 * subscription has no live discount, or when its amount is not comparable.
 */
export async function readPendingPromo(input: {
    readonly subscription: SelectSubscription;
}): Promise<SignupNoticePromo | null> {
    const live = await readLivePromos({ subscriptionId: input.subscription.id });
    if (live.length === 0) return null;
    const expected = await createCutExpectedAmountPolicy().expectedAmount({
        subscription: input.subscription,
        purpose: { kind: 'AUTHORIZATION' }
    });
    if (expected.kind !== 'COMPARABLE') return null;
    const finite = live.flatMap((promo) =>
        promo.remainingCharges === null ? [] : [promo.remainingCharges]
    );
    return {
        codes: live.map((promo) => promo.code),
        amount: expected.amountMinor,
        chargesLeft: finite.length > 0 ? Math.min(...finite) : null
    };
}
