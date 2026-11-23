/**
 * HOS-1883 (owner decision on I1): the add-on fact of a COMPLEMENTO cancelled at the provider and
 * mirrored by `processProviderNotice` (ACTIVE → CANCELLED). Nobody else reports this end: the
 * instance stays ACTIVE with a cancelled complement, so a later A5 sees `ALREADY_CANCELLED` and
 * owes nothing (§5.3). It is `addon_cancelled{path:'PROVIDER_CANCELLED', actor_kind:'SYSTEM'}`:
 * the notice cannot tell whether the payer or the provider cancelled. Never throws (P-9).
 */
import { addonInstances, eq, getDb } from '@repo/db';
import { createLogger } from '@repo/logger';
import { type AddonFactListing, emitAddonFact } from '../addon/addon-fact-emit';
import type { BillingFactSink } from '../facts/billing-fact-sink';

const logger = createLogger('complement-provider-cancelled-fact');
const DAY_MS = 86_400_000;

/**
 * Emits `addon_cancelled{PROVIDER_CANCELLED}` after the mirror committed. The caller calls it
 * only when its guarded `UPDATE … WHERE status = 'ACTIVE'` returned the row (P-3'); this emits
 * only for a COMPLEMENTO whose instance is paid (no grant title) and still `ACTIVE`.
 *
 * @param input.subscriptionClass - The class of the row the mirror cancelled
 * @param input.subscriptionId - That row
 * @param input.cancelledAt - The instant the mirror wrote
 * @param input.billingFacts - The sink
 * @param input.listing - Optional listing reader for a `LISTING` add-on's vertical
 */
export async function emitComplementProviderCancelledFact(input: {
    readonly subscriptionClass: string;
    readonly subscriptionId: string;
    readonly cancelledAt: Date;
    readonly billingFacts: BillingFactSink | undefined;
    readonly listing?: AddonFactListing;
}): Promise<void> {
    if (input.subscriptionClass !== 'COMPLEMENTO') return;
    try {
        const [instance] = await getDb()
            .select({ status: addonInstances.status, titleAnchorId: addonInstances.titleAnchorId })
            .from(addonInstances)
            .where(eq(addonInstances.complementSubscriptionId, input.subscriptionId))
            .limit(1);
        if (instance?.status !== 'ACTIVE' || instance.titleAnchorId !== null) return;
    } catch (error) {
        logger.error(
            { subscriptionId: input.subscriptionId, error },
            'Add-on read failed; addon_cancelled not emitted'
        );
        return;
    }
    await emitAddonFact({
        billingFacts: input.billingFacts,
        listing: input.listing,
        source: { complementSubscriptionId: input.subscriptionId },
        build: (anchored) => ({
            kind: 'ADDON_CANCELLED',
            ...anchored.subject,
            actorKind: 'SYSTEM',
            occurredAt: input.cancelledAt,
            path: 'PROVIDER_CANCELLED',
            wasScheduled: false,
            ...(anchored.startsAt
                ? {
                      lifetimeDays: Math.max(
                          0,
                          Math.floor(
                              (input.cancelledAt.getTime() - anchored.startsAt.getTime()) / DAY_MS
                          )
                      )
                  }
                : {})
        })
    });
}
