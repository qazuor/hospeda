import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct } from '@repo/payments';
import {
    type CancelOurAuthorizationOutcome,
    cancelOurAuthorization
} from '../reconciliation/cancel-our-authorization';
import {
    noCancellationSeenAnnotation,
    recordAuthorizationSeenAlive,
    recordCancellationSeen
} from '../subscription/subscription-billing-ports';
import type {
    AddonProviderCancellationPorts,
    AddonProviderCancellationResult,
    CancelledAddon
} from './addon-instance-a5';

const logger = createLogger('addon-instance-a6-provider');
const CALL_BY_OUTCOME: Readonly<
    Record<CancelOurAuthorizationOutcome, AddonProviderCancellationResult['cancelCall']>
> = {
    ALREADY_CANCELLED: 'NOT_NEEDED',
    NOTICE_PENDING: 'NOTICE_PENDING',
    CALL_FAILED: 'FAILED',
    CONFIRMED: 'SENT',
    SENT_UNCONFIRMED: 'SENT'
};

/** After A6 commits, re-read by id and send its own notice before cancelling. */
export async function cancelAddonComplementAtProviderForA6(
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
            let notice:
                | Awaited<
                      ReturnType<
                          AddonProviderCancellationPorts['beforeCancelNotice']['beforeCancel']
                      >
                  >
                | undefined;
            const { outcome } = await cancelOurAuthorization(
                {
                    ...target,
                    kind: 'ADDON_LISTING_PURGED',
                    prior: { read, act }
                },
                {
                    provider,
                    clock,
                    beforeCancelNotice: {
                        beforeCancel: async (args) => {
                            notice = await ports.beforeCancelNotice.beforeCancel(args);
                            return notice;
                        }
                    }
                }
            );
            if (outcome === 'CONFIRMED')
                await recordCancellationSeen({ annotator, subscriptionId, seenAt: clock.now() });
            const cancelCall = CALL_BY_OUTCOME[outcome];
            const escalated =
                notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED' ? notice : undefined;
            if (escalated)
                logger.warn({ subscriptionId, notice }, 'A6 notice undeliverable; called');
            results.push({ subscriptionId, cancelCall, ...(escalated ? { escalated } : {}) });
        } catch (error) {
            logger.error({ subscriptionId, error }, 'A6 provider cancel failed; the sweep retries');
            results.push({ subscriptionId, cancelCall: 'FAILED' });
        }
    }
    return { results };
}
