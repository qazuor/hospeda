import type { PaymentCapability } from './capabilities';
import { PaymentProviderError } from './errors';
import type { TrafficClass } from './traffic-context';

/** Internal state for a queued governor acquisition. */
export interface GovernorWaiter {
    readonly trafficClass: TrafficClass;
    readonly capability: PaymentCapability;
    readonly maxWaitMs: number;
    readonly startedAt: number;
    readonly resolve: () => void;
    readonly reject: (error: PaymentProviderError) => void;
    readonly signal?: AbortSignal;
    cancelTimer?: () => void;
    abort?: () => void;
}

/** Create the typed transient refusal returned before a governed request is sent. */
export function paymentProviderRejection(args: {
    readonly capability: PaymentCapability;
    readonly remainingMs: number;
    readonly message?: string;
}): PaymentProviderError {
    return new PaymentProviderError({
        code: 'UNAVAILABLE',
        capability: args.capability,
        message: args.message ?? 'Mercado Pago traffic governor: request wait exceeded',
        transient: {
            kind: 'RATE_LIMITED',
            retryAfterSeconds: Math.max(1, Math.ceil(args.remainingMs / 1000))
        },
        governorRejected: true
    });
}
