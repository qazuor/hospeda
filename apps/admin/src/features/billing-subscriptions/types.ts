/**
 * Subscription status types matching billing system
 */
export type SubscriptionStatus = 'active' | 'trialing' | 'cancelled' | 'past_due' | 'expired';

/**
 * Subscription data structure
 */
export interface Subscription {
    readonly id: string;
    readonly userId: string;
    readonly userName: string;
    readonly userEmail: string;
    readonly planSlug: string;
    readonly status: SubscriptionStatus;
    readonly startDate: string;
    readonly currentPeriodEnd: string;
    readonly monthlyAmount: number;
    readonly cancelAtPeriodEnd: boolean;
    readonly trialEnd?: string;
    readonly discountPercent?: number;
}

/**
 * Payment history entry
 */
export interface PaymentHistory {
    readonly id: string;
    readonly date: string;
    readonly amount: number;
    readonly status: 'paid' | 'pending' | 'failed';
}
