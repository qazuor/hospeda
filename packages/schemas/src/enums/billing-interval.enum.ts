/**
 * Billing interval enum for recurring subscriptions
 * Defines the frequency of recurring billing cycles
 */
export enum BillingIntervalEnum {
    /** Monthly billing cycle */
    MONTH = 'month',
    /** Yearly billing cycle */
    YEAR = 'year',
    /** Bi-yearly (24 months) billing cycle */
    BIYEAR = 'biyear'
}
