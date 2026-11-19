/**
 * Recognises the notice of an authorization the provider watch battery created (HOS-1512, owner
 * decision on the webhook noise, option 1). The battery creates a pending preapproval with no card
 * in each run and cancels it in the same run; the provider notifies each one. Without this, the
 * unknown-authorization path would write a receipt tombstone and a `TRANSICION_NO_DECLARADA` mark
 * for every run, every day.
 *
 * @module services/billing/notice/watch-battery-notice
 */
import type { Clock } from '@repo/billing-verticals-contract';
import { providerWatchRunModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    actStartInstant,
    assertFreshForAct,
    isWatchReference,
    type PaymentProvider
} from '@repo/payments';
import type { UnknownAuthorizationArrival } from '../reconciliation/handle-unknown-authorization.service.js';

const logger = createLogger('watch-battery-notice');

/**
 * Whether a notice for an authorization with no `provider_link` is one of the battery's, to drop.
 *
 * All three must hold, in this order:
 * 1. It is an AUTHORIZATION arrival. A battery authorization never charges, so the charge of one is
 *    a real event and takes the normal path, loudly.
 * 2. A battery run RECORDED this very id (`provider_watch_run`). That is the decision; a reference
 *    that only looks like the battery's (`hospeda-watch-…`) proves nothing, since anyone can write
 *    one. The lookup is a database read, so a real notice costs no extra provider read.
 * 3. The authorization, RE-READ by id (never the notice body), carries a watch reference.
 *
 * A read that fails leaves the notice to the normal path, which re-reads it and answers for it.
 *
 * @param input.authorizationId - The provider id with no `provider_link`
 * @param input.arrival - What arrived
 * @param ports.provider - The provider, for the re-read by id
 * @param ports.clock - The clock the freshness of that read is judged against
 * @returns The run that created it when the notice is to be dropped, `null` otherwise
 */
export async function watchBatteryNoticeToDrop(
    input: { readonly authorizationId: string; readonly arrival: UnknownAuthorizationArrival },
    ports: { readonly provider: PaymentProvider; readonly clock: Clock }
): Promise<{ readonly runId: string } | null> {
    if (input.arrival.kind !== 'AUTHORIZATION') return null;
    const recorded = await providerWatchRunModel.findRunRecordingProviderId({
        providerId: input.authorizationId
    });
    if (recorded === null) return null;
    // The decision reads the provider's state as every decision does: a fresh read by id (G17).
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    let reference: string;
    try {
        const read = await ports.provider.readAuthorization({
            authorizationId: input.authorizationId
        });
        reference = assertFreshForAct({ read, act }).snapshot.reference;
    } catch {
        return null;
    }
    if (!isWatchReference(reference)) return null;
    logger.info(
        { authorizationId: input.authorizationId, runId: recorded.runId },
        'Notice of a provider watch battery authorization dropped: no tombstone and no mark'
    );
    return recorded;
}
