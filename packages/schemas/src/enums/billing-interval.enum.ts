/**
 * Billing interval enum
 * Defines the billing frequency options for subscriptions and products
 */
export enum BillingIntervalEnum {
    /** Billed monthly */
    MONTHLY = 'monthly',
    /** Billed quarterly (every 3 months) */
    QUARTERLY = 'quarterly',
    /** Billed semi-annually (every 6 months) */
    SEMI_ANNUAL = 'semi_annual',
    /** Billed annually (every 12 months) */
    ANNUAL = 'annual',
    /** One-time payment */
    ONE_TIME = 'one_time'
}
