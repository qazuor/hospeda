/**
 * A5's provider half (AC:B5:27), moved out of `addon-instance-a5.ts` (which re-exports it) so
 * that file stays under the 500-line limit after HOS-1883.
 */
import type { Clock } from '@repo/billing-verticals-contract';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import {
    type CancelOurAuthorizationOutcome,
    cancelOurAuthorization
} from '../reconciliation/cancel-our-authorization';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation,
    recordAuthorizationSeenAlive,
    recordCancellationSeen
} from '../subscription/subscription-billing-ports';
import type { CancelledAddon } from './addon-instance-a5';

const logger = createLogger('addon-instance-a5');

/** Ports of {@link cancelAddonComplementsAtProvider}; `cancellationSeen` defaults to the no-op. */
export interface AddonProviderCancellationPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly cancellationSeen?: CancellationSeenAnnotator;
}

/** One complement's provider half; `escalated` when our notice is undeliverable and it called. */
export interface AddonProviderCancellationResult {
    readonly subscriptionId: string;
    readonly cancelCall: 'SENT' | 'NOT_NEEDED' | 'NOTICE_PENDING' | 'FAILED';
    readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
}

/** What each outcome of the shared cancellation helper means for A5. Exhaustive. */
const CALL_BY_OUTCOME: Readonly<
    Record<CancelOurAuthorizationOutcome, AddonProviderCancellationResult['cancelCall']>
> = {
    ALREADY_CANCELLED: 'NOT_NEEDED',
    NOTICE_PENDING: 'NOTICE_PENDING',
    CALL_FAILED: 'FAILED',
    CONFIRMED: 'SENT',
    SENT_UNCONFIRMED: 'SENT'
};

/**
 * A5's provider half (AC:B5:27), after the commit, in no transaction: per decided complement, a
 * re-read by id and its annotation, then `cancelOurAuthorization` with `ADDON_CANCELLED` (notice
 * first, ONE call). Never throws nor undoes: the sweep retries the decision, same kind (I-1).
 *
 * @param input.cancelled - What `runOrphanhood`/`applyA5` cancelled
 * @param ports - Provider, clock, our notice and the optional seen-annotator
 * @returns `{ results }`: one per complement with a recorded decision
 */
export async function cancelAddonComplementsAtProvider(
    input: { readonly cancelled: readonly CancelledAddon[] },
    ports: AddonProviderCancellationPorts
): Promise<{ readonly results: readonly AddonProviderCancellationResult[] }> {
    const { provider, clock } = ports;
    const annotator = ports.cancellationSeen ?? noCancellationSeenAnnotation;
    const results: AddonProviderCancellationResult[] = [];
    for (const { providerCancellation: target } of input.cancelled) {
        if (!target) continue;
        const { subscriptionId, authorizationId } = target;
        try {
            const act = { kind: 'decision' as const, startedAt: clock.now() };
            actStartInstant({ act });
            const read = await provider.readAuthorization({ authorizationId });
            const { snapshot, readAt } = assertFreshForAct({ read, act });
            const annotate =
                snapshot.status === 'cancelled'
                    ? recordCancellationSeen
                    : recordAuthorizationSeenAlive;
            await annotate({ annotator, subscriptionId, seenAt: readAt });
            let notice: Awaited<ReturnType<BeforeCancelNotice['beforeCancel']>> | undefined;
            const beforeCancelNotice: BeforeCancelNotice = {
                beforeCancel: async (args) => {
                    notice = await ports.beforeCancelNotice.beforeCancel(args);
                    return notice;
                }
            };
            const { outcome } = await cancelOurAuthorization(
                { ...target, kind: 'ADDON_CANCELLED', prior: { read, act } },
                { provider, clock, beforeCancelNotice }
            );
            if (outcome === 'CONFIRMED')
                await recordCancellationSeen({ annotator, subscriptionId, seenAt: clock.now() });
            const cancelCall = CALL_BY_OUTCOME[outcome];
            const escalated =
                notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED' ? notice : undefined;
            if (escalated)
                logger.warn({ subscriptionId, notice }, 'A5 notice undeliverable; called');
            results.push({ subscriptionId, cancelCall, ...(escalated ? { escalated } : {}) });
        } catch (error) {
            logger.error({ subscriptionId, error }, 'A5 provider cancel failed; the sweep retries');
            results.push({ subscriptionId, cancelCall: 'FAILED' });
        }
    }
    return { results };
}
