/**
 * The one error type a payment provider rejects with.
 */
import type { PaymentCapability } from './capabilities';

/**
 * Why a provider refused.
 *
 * - `INVALID_INPUT`: the request failed validation before reaching the provider.
 * - `NOT_FOUND`: no resource with that id.
 * - `REJECTED`: the provider refused the operation in this state.
 * - `INVALID_NOTICE`: a delivery that is not a notice this provider sends.
 * - `UNAVAILABLE`: the provider could not be reached; the outcome is unknown.
 * - `NOT_IMPLEMENTED`: the adapter does not implement this capability yet.
 */
export type PaymentProviderErrorCode =
    | 'INVALID_INPUT'
    | 'NOT_FOUND'
    | 'REJECTED'
    | 'INVALID_NOTICE'
    | 'UNAVAILABLE'
    | 'NOT_IMPLEMENTED';

/** Constructor input of `PaymentProviderError`. */
export interface PaymentProviderErrorInput {
    readonly code: PaymentProviderErrorCode;
    readonly capability: PaymentCapability;
    readonly message: string;
    readonly cause?: unknown;
}

/** A typed refusal from a payment provider. */
export class PaymentProviderError extends Error {
    readonly code: PaymentProviderErrorCode;
    readonly capability: PaymentCapability;

    /**
     * @param input.code - Why the provider refused
     * @param input.capability - The capability that was asked for
     * @param input.message - Human-readable detail
     * @param input.cause - The underlying error, when there is one
     */
    constructor(input: PaymentProviderErrorInput) {
        super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
        this.name = 'PaymentProviderError';
        this.code = input.code;
        this.capability = input.capability;
    }
}
