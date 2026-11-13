/** Grace-period copy for blocking plan changes by payment method. */
export const GRACE_PLAN_CHANGE_KEY: Record<'CARD' | 'MANUAL', string> = {
    CARD: 'account.subscription.mine.graceChangePlan.CARD',
    MANUAL: 'account.subscription.mine.graceChangePlan.MANUAL'
};

/** Base plural key for a deferred courtesy balance and its payment condition. */
export const DEFERRED_COURTESY_KEY = 'account.subscription.mine.deferredCourtesy';

/** Courtesy months lost when changing from monthly to a longer billing cycle. */
export function totalCourtesyMonths({
    row,
    deferredCourtesies
}: {
    readonly row: { readonly vertical: string; readonly liveCourtesyMonths?: number };
    readonly deferredCourtesies: readonly {
        readonly vertical: string;
        readonly balanceMonths: number;
    }[];
}): number {
    return (
        (row.liveCourtesyMonths ?? 0) +
        deferredCourtesies
            .filter((courtesy) => courtesy.vertical === row.vertical)
            .reduce((total, courtesy) => total + courtesy.balanceMonths, 0)
    );
}
