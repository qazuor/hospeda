import { z } from 'zod';

/**
 * The payment methods a plan version can declare (HOS-2196). It mirrors the closed set of
 * `subscription.payment_method`: a recurring card preapproval, or an installment the team records
 * by hand (bank transfer, cash).
 */
export const PLAN_PAYMENT_METHODS = ['CARD', 'MANUAL'] as const;

/** One payment method a plan version can accept. */
export const PlanPaymentMethodSchema = z.enum(PLAN_PAYMENT_METHODS);
export type PlanPaymentMethod = z.infer<typeof PlanPaymentMethodSchema>;

/**
 * The methods a plan version accepts, as stored in `plan_version.payment_methods`. Never empty and
 * without repeats: a plan that accepts nothing cannot be sold.
 */
export const PlanPaymentMethodsSchema = z
    .array(PlanPaymentMethodSchema)
    .min(1)
    .refine((methods) => new Set(methods).size === methods.length, {
        message: 'Payment methods must not repeat'
    });
export type PlanPaymentMethods = z.infer<typeof PlanPaymentMethodsSchema>;

/** Whether a plan version accepts the given payment method. */
export function acceptsPaymentMethod({
    paymentMethods,
    method
}: {
    readonly paymentMethods: readonly string[];
    readonly method: PlanPaymentMethod;
}): boolean {
    return paymentMethods.includes(method);
}

/**
 * Whether the public checkout (`?opcion=`) may start a card subscription on a plan version. A plan
 * that also accepts manual payment is sold by the team (administrative action 6, PDR §17.3), so
 * only a card-only plan is self-service. Single source for the API guard and the web notice.
 */
export function isSelfServiceCardCheckout({
    paymentMethods
}: {
    readonly paymentMethods: readonly string[];
}): boolean {
    return (
        acceptsPaymentMethod({ paymentMethods, method: 'CARD' }) &&
        !acceptsPaymentMethod({ paymentMethods, method: 'MANUAL' })
    );
}
