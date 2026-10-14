/**
 * Causes and retry paths for a rejected first charge during signup.
 * The status_detail map is deliberately populated only with values measured or
 * named by DEC-MP-004; unknown values keep the generic HOS-1675 copy. The old
 * resolve-reason.ts maps checkout UI translation keys and is a separate concern
 * that this map does not reuse or modify.
 */
export type SignupDeclinedCause = 'PROVIDER_RISK' | 'PAYMENT_METHOD' | 'UNKNOWN';

export type SignupDeclinedRetry = 'NEW_SIGNUP' | 'FINISH_SUCCESSOR_CHECKOUT';

export const SIGNUP_DECLINED_CAUSE_BY_STATUS_DETAIL: Readonly<
    Record<string, Exclude<SignupDeclinedCause, 'UNKNOWN'>>
> = Object.freeze({
    // DEC-MP-004 probe 49 measured this provider risk rejection.
    cc_rejected_high_risk: 'PROVIDER_RISK',
    // DEC-MP-004 probe 49 measured this payment-method rejection.
    payment_method_not_ready: 'PAYMENT_METHOD',
    // DEC-MP-004 names insufficient funds; MP's code is documented in resolve-reason.ts:55-56.
    cc_rejected_insufficient_amount: 'PAYMENT_METHOD',
    // DEC-MP-004 names expiry; MP's code is documented in resolve-reason.ts:88.
    cc_rejected_bad_filled_date: 'PAYMENT_METHOD'
});

export function resolveSignupDeclinedMessage({
    declineReason,
    successionPredecessor
}: {
    readonly declineReason: string | null;
    readonly successionPredecessor: boolean;
}): { readonly cause: SignupDeclinedCause; readonly retry: SignupDeclinedRetry } {
    const mappedCause =
        declineReason !== null &&
        Object.hasOwn(SIGNUP_DECLINED_CAUSE_BY_STATUS_DETAIL, declineReason)
            ? (SIGNUP_DECLINED_CAUSE_BY_STATUS_DETAIL[declineReason] as Exclude<
                  SignupDeclinedCause,
                  'UNKNOWN'
              >)
            : undefined;
    const cause = mappedCause ?? 'UNKNOWN';

    return {
        cause,
        retry: successionPredecessor ? 'FINISH_SUCCESSOR_CHECKOUT' : 'NEW_SIGNUP'
    };
}
