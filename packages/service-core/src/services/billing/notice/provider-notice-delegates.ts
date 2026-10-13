import type { Clock } from '@repo/billing-verticals-contract';
import type { PaymentProvider } from '@repo/payments';
import type { CoverageNotices } from '../payment/payment-ports.js';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port.js';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service.js';
import {
    type SuccessionCloser,
    unimplementedSuccessionCloser
} from '../subscription/subscription-billing-ports.js';
import { mirrorProviderCancellationOnGrace } from './mirror-cancelled-on-grace.js';
import {
    type MirrorDelegateInput,
    type MirrorDelegates,
    unregisteredMirrorDelegates
} from './provider-notice-ports.js';

/** Ports of {@link createProviderNoticeMirrorDelegates} (HOS-1676 H-5). */
export interface ProviderNoticeMirrorDelegatesPorts {
    /** The provider; read by id by the `LIVE_PREAPPROVAL_ON_CLOSED_ROW` handler (HOS-1676 run 2). */
    readonly provider: PaymentProvider;
    /** The injected clock. */
    readonly clock: Clock;
    /** The mail before cancelling an authorization (HOS-1676 run 2). */
    readonly beforeCancelNotice: BeforeCancelNotice;
    /** Receives the post-commit coverage notices; defaults to the unwired logger. */
    readonly coverageNotices?: CoverageNotices;
    /** Hangs payments from reconciliation marks (HOS-1676 run 2). */
    readonly markPayments?: ReconciliationMarkPayments;
    /** S18's interface (B8b); defaults to `unimplementedSuccessionCloser`, like the receiver. */
    readonly successionCloser?: SuccessionCloser;
}

/**
 * The registered handlers of the `B/03` §10.1 grid cells that the receiver delegates
 * (HOS-1676 H-5).
 *
 * - `CANCELLED_ON_GRACE` → {@link mirrorProviderCancellationOnGrace} (branch 5, HOS-1561 H7).
 *   Its `NOT_APPLICABLE` (the row left grace in between: a race) does not throw: the delegate
 *   returns and the receiver answers `DELEGATED`; the function already logs it.
 * - Every other pair stays unregistered and throws `MIRROR_PAIR_NOT_REGISTERED` (H-1): they
 *   belong to other pieces (S10, the pause B7.3, S3).
 *
 * Nothing from `@repo/db` is evaluated when this module loads.
 *
 * @param ports - Provider, clock, the notice before cancelling and the optional listeners
 * @returns The `MirrorDelegates` to hand to `processProviderNotice`
 */
export function createProviderNoticeMirrorDelegates(
    ports: ProviderNoticeMirrorDelegatesPorts
): MirrorDelegates {
    return {
        async delegate(input: MirrorDelegateInput): Promise<void> {
            switch (input.pair) {
                case 'CANCELLED_ON_GRACE': {
                    await mirrorProviderCancellationOnGrace(
                        { subscriptionId: input.subscriptionId, readAt: input.readAt },
                        {
                            clock: ports.clock,
                            successionCloser:
                                ports.successionCloser ?? unimplementedSuccessionCloser,
                            coverageNotices: ports.coverageNotices
                        }
                    );
                    return;
                }
                // HOS-1676 run 2
                case 'LIVE_PREAPPROVAL_ON_CLOSED_ROW':
                case 'RESUME_MIRROR':
                case 'PROVIDER_PAUSE_IS_ARREARS':
                case 'CANCELLED_ON_PAUSE':
                case 'CANCELLED_WHILE_PENDING':
                    return unregisteredMirrorDelegates.delegate(input);
                default: {
                    const unreachable: never = input.pair;
                    throw new Error(`Unknown mirror pair ${String(unreachable)}`);
                }
            }
        }
    };
}
