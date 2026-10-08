import { and, billingOptions, eq, getDb } from '@repo/db';

/** The commercial fields read from a version's billing option. */
export interface AnchoredBillingOption {
    readonly id: string;
    readonly planVersionId: string;
    readonly cycle: string;
    readonly amount: number;
    readonly currency: string;
}

/** Port for resolving a subscription's option inside its immutable version anchor. */
export interface BillingOptionReader {
    findByVersionAndId(args: {
        readonly planVersionId: string;
        readonly billingOptionId: string;
    }): Promise<AnchoredBillingOption | null>;
}

/** Database reader for billing options. Never looks up the current plan version. */
export const databaseBillingOptionReader: BillingOptionReader = {
    async findByVersionAndId({ planVersionId, billingOptionId }) {
        const rows = await getDb()
            .select({
                id: billingOptions.id,
                planVersionId: billingOptions.planVersionId,
                cycle: billingOptions.cycle,
                amount: billingOptions.amount,
                currency: billingOptions.currency
            })
            .from(billingOptions)
            .where(
                and(
                    eq(billingOptions.planVersionId, planVersionId),
                    eq(billingOptions.id, billingOptionId)
                )
            )
            .limit(1);
        return rows[0] ?? null;
    }
};

/** Read the price of a subscription from its anchored version (AC:B2:3). */
export async function readAnchoredBillingOption({
    subscription,
    reader = databaseBillingOptionReader
}: {
    readonly subscription: { readonly planVersionId: string; readonly billingOptionId: string };
    readonly reader?: BillingOptionReader;
}): Promise<AnchoredBillingOption | null> {
    return reader.findByVersionAndId({
        planVersionId: subscription.planVersionId,
        billingOptionId: subscription.billingOptionId
    });
}
