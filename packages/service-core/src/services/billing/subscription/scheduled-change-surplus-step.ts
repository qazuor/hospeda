import type { VerticalEnum } from '@repo/schemas';

/** Reconciles publication surplus after an applied scheduled plan change. */
export interface SurplusStep {
    /** Applies the owner's keep selection to the new effective publication limit. */
    reconcile(input: {
        readonly userId: string;
        readonly vertical: VerticalEnum;
        readonly keepListingIds: readonly string[];
    }): Promise<void>;
}
