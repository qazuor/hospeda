/**
 * Payment utility functions
 * @module payments/utils/payment
 */

import { BillingCycleEnum, type PriceCurrencyEnum } from '@repo/schemas';

/**
 * Calculates the next billing date based on current date and billing cycle
 * @param currentDate - Current billing date
 * @param billingCycle - Billing cycle (monthly or yearly)
 * @returns Next billing date
 */
export const calculateNextBillingDate = (
    currentDate: Date,
    billingCycle: BillingCycleEnum
): Date => {
    const nextDate = new Date(currentDate);

    switch (billingCycle) {
        case BillingCycleEnum.MONTHLY:
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
        case BillingCycleEnum.YEARLY:
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        default:
            throw new Error(`Unsupported billing cycle: ${billingCycle}`);
    }

    return nextDate;
};

/**
 * Calculates yearly price with discount
 * @param monthlyPrice - Monthly price
 * @param discountPercentage - Discount percentage (0-100)
 * @returns Yearly price with discount applied
 */
export const calculateYearlyPrice = (monthlyPrice: number, discountPercentage = 0): number => {
    if (monthlyPrice < 0) {
        throw new Error('Monthly price cannot be negative');
    }

    if (discountPercentage < 0 || discountPercentage > 100) {
        throw new Error('Discount percentage must be between 0 and 100');
    }

    const yearlyPrice = monthlyPrice * 12;
    const discountAmount = (yearlyPrice * discountPercentage) / 100;
    return yearlyPrice - discountAmount;
};

/**
 * Formats currency amount for display
 * @param amount - Amount to format
 * @param currency - Currency code
 * @param locale - Locale for formatting (defaults to 'es-AR')
 * @returns Formatted currency string
 */
export const formatCurrency = (
    amount: number,
    currency: PriceCurrencyEnum,
    locale = 'es-AR'
): string => {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

/**
 * Validates if a price is valid (positive number)
 * @param price - Price to validate
 * @returns True if price is valid
 */
export const isValidPrice = (price: number): boolean => {
    return typeof price === 'number' && price > 0 && Number.isFinite(price);
};

/**
 * Generates a unique external reference for payments
 * @param prefix - Optional prefix for the reference
 * @param suffix - Optional suffix for additional context
 * @returns Unique external reference string
 */
export const generateExternalReference = (prefix = 'PAY', suffix?: string): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const parts = [prefix, timestamp, random];
    if (suffix) {
        parts.push(suffix.substring(0, 8)); // Limit suffix length
    }
    return parts.join('_').toUpperCase();
};

/**
 * Checks if a payment status indicates success
 * @param status - Payment status to check
 * @returns True if payment is successful
 */
export const isPaymentSuccessful = (status: string): boolean => {
    return status === 'approved' || status === 'authorized';
};

/**
 * Calculates subscription end date based on start date and max billing cycles
 * @param startDate - Subscription start date
 * @param billingCycle - Billing cycle
 * @param maxBillingCycles - Maximum number of billing cycles (optional)
 * @returns End date or undefined if no limit
 */
export const calculateSubscriptionEndDate = (
    startDate: Date,
    billingCycle: BillingCycleEnum,
    maxBillingCycles?: number
): Date | undefined => {
    if (!maxBillingCycles || maxBillingCycles <= 0) {
        return undefined;
    }

    const endDate = new Date(startDate);

    switch (billingCycle) {
        case BillingCycleEnum.MONTHLY:
            endDate.setMonth(endDate.getMonth() + maxBillingCycles);
            break;
        case BillingCycleEnum.YEARLY:
            endDate.setFullYear(endDate.getFullYear() + maxBillingCycles);
            break;
        default:
            throw new Error(`Unsupported billing cycle: ${billingCycle}`);
    }

    return endDate;
};

/**
 * Checks if a subscription is expiring soon
 * @param endDate - Subscription end date
 * @param warningDays - Number of days before expiration to warn (default: 7)
 * @returns True if subscription is expiring within warning period
 */
export const isSubscriptionExpiringSoon = (endDate: Date, warningDays = 7): boolean => {
    const now = new Date();
    const warningDate = new Date(endDate);
    warningDate.setDate(warningDate.getDate() - warningDays);

    return now >= warningDate && now < endDate;
};
