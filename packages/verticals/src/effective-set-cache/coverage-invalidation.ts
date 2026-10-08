import type { BillingForVerticals, Unsubscribe } from '@repo/billing-verticals-contract';

/** Subscribes to the coverage notice, which billing emits after commit. */
export function subscribeCoverageInvalidation(args: {
    readonly billing: Pick<BillingForVerticals, 'onCoverageChanged'>;
    readonly cache: { invalidateUser(input: { readonly userId: string }): Promise<void> };
}): Unsubscribe {
    return args.billing.onCoverageChanged((event) =>
        args.cache.invalidateUser({ userId: event.userId })
    );
}
