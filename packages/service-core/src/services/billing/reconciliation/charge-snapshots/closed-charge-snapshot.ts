/** Immutable historical charge view. Refund, chargedBack and purpose are deliberately exposed so AC-12 comparisons can see later refunds and skip charges that returned all money. */
export interface ClosedChargeSnapshot {
    readonly chargeId: string;
    readonly providerCreatedAt: string;
    readonly status: 'pending' | 'approved' | 'rejected';
    readonly purpose: string;
    readonly authorizationId: string | null;
    readonly reference: string | null;
    readonly amountMinor: number;
    readonly currency: string;
    readonly refundedAmountMinor: number;
    readonly chargedBack: boolean;
}

/** Read-only source for charge snapshots proven closed at read time. */
export interface ClosedChargeSnapshots {
    find(input: {
        readonly chargeIds: readonly string[];
    }): Promise<readonly ClosedChargeSnapshot[]>;
}
