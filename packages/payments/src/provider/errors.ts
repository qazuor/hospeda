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
 * - `UNSUPPORTED`: the provider answered with a resource shape this adapter does not support.
 * - `NOT_IMPLEMENTED`: the adapter does not implement this capability yet.
 */
export type PaymentProviderErrorCode =
    | 'INVALID_INPUT'
    | 'NOT_FOUND'
    | 'REJECTED'
    | 'INVALID_NOTICE'
    | 'UNAVAILABLE'
    | 'UNSUPPORTED'
    | 'NOT_IMPLEMENTED';

/**
 * A transient provider failure the caller may retry later (HOS-1968).
 *
 * - `RATE_LIMITED`: the provider throttled the request (HTTP 429). It refused before
 *   processing, so nothing was created on its side.
 * - `UNAVAILABLE`: a 5xx answer or a transport failure (network, timeout). The outcome
 *   of a write is unknown.
 *
 * `retryAfterSeconds` is the provider's own `Retry-After`, when it sent one.
 */
export interface TransientProviderFailure {
    readonly kind: 'RATE_LIMITED' | 'UNAVAILABLE';
    readonly retryAfterSeconds?: number;
}

/** Constructor input of `PaymentProviderError`. */
export interface PaymentProviderErrorInput {
    readonly code: PaymentProviderErrorCode;
    readonly capability: PaymentCapability;
    readonly message: string;
    readonly cause?: unknown;
    readonly incompleteRead?: boolean;
    readonly providerStatus?: string;
    readonly providerCadence?: string;
    readonly transient?: TransientProviderFailure;
}

/** A typed refusal from a payment provider. */
export class PaymentProviderError extends Error {
    readonly code: PaymentProviderErrorCode;
    readonly capability: PaymentCapability;
    /** The provider answered with a record it is still writing; reading again later is expected to succeed (HOS-1747). */
    readonly incompleteRead: boolean;
    /** The provider's status for an unsupported resource shape, when available. */
    readonly providerStatus?: string;
    /** The provider's billing cadence for an unsupported authorization, as the provider spelled it, when available. */
    readonly providerCadence?: string;
    /** Set when the failure is transient and worth retrying later (HOS-1968). */
    readonly transient?: TransientProviderFailure;

    /**
     * @param input.code - Why the provider refused
     * @param input.capability - The capability that was asked for
     * @param input.message - Human-readable detail
     * @param input.cause - The underlying error, when there is one
     * @param input.incompleteRead - Whether the provider returned a record still being written
     * @param input.providerStatus - The provider's status for an unsupported resource shape
     * @param input.providerCadence - The provider's billing cadence for an unsupported authorization, as the provider spelled it
     * @param input.transient - Set when the failure is transient (rate limit, 5xx, transport)
     */
    constructor(input: PaymentProviderErrorInput) {
        super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
        this.name = 'PaymentProviderError';
        this.code = input.code;
        this.capability = input.capability;
        this.incompleteRead = input.incompleteRead ?? false;
        this.providerStatus = input.providerStatus;
        this.providerCadence = input.providerCadence;
        this.transient = input.transient;
    }
}
