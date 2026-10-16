/**
 * Records whether this system decided a subscription amount mutation. S30 in
 * B9b records its decision; S37 and S10 may add further writers later.
 */
export interface AmountMutationDecisions {
    findLatest(input: { readonly subscriptionId: string }): Promise<{
        readonly transition: 'S30' | 'S37' | 'S10';
        readonly decidedAt: Date;
    } | null>;
}

/** No amount-mutation decision reader is registered. */
export const noAmountMutationDecisions: AmountMutationDecisions = {
    async findLatest() {
        return null;
    }
};
