/**
 * Records whether this system decided a subscription amount mutation. At this
 * cut no transition (S30 in B9b, S37 in B12, S10 in B8b) mutates the amount or
 * records its decision. The first writer's sheet supplies the real reader.
 * With this default, every amount divergence opens MOT:5 immediately.
 */
export interface AmountMutationDecisions {
    findLatest(input: { readonly subscriptionId: string }): Promise<{
        readonly transition: 'S30' | 'S37' | 'S10';
        readonly decidedAt: Date;
    } | null>;
}

/** No amount-mutating transition has registered a decision at this cut. */
export const noAmountMutationDecisions: AmountMutationDecisions = {
    async findLatest() {
        return null;
    }
};
