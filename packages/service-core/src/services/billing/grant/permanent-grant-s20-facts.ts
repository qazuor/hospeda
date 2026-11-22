/**
 * The add-on facts of a COMMITTED S20 (HOS-1883 §5.2, O-5, T-6, T-7). Called only by the three
 * committing grant acts, after their commit and right after `cancelS20AtProvider`. Never from
 * `runS20InTransaction`: that function also runs inside the grant preview's dry-run, which must
 * emit nothing (AC-21).
 */
import {
    type AddonFactListing,
    emitAddonFact,
    wholeSecondsBetween
} from '../addon/addon-fact-emit';
import type { BillingFactSink } from '../facts/billing-fact-sink';
import type { S20Row } from './permanent-grant-s20';

/**
 * Per committed S20 row: an `ACTIVE` instance became free under the grant
 * (`addon_granted_free{S20_CONVERSION}`, never `addon_cancelled`); a `PENDING_AUTHORIZATION` one
 * was never paid, and its checkout died (`addon_checkout_abandoned{CLOSED_BY_SYSTEM}`, T-7). The
 * admin's id, the grant id and the anchor id are never emitted (§6): `actor_kind` is the only
 * trace of the act.
 *
 * @param input.rows - `S20Result.rows` of the committed act
 * @param input.now - The instant of the act
 * @param input.billingFacts - The sink
 * @param input.listing - Optional listing reader for a `LISTING` add-on's vertical
 */
export async function emitS20GrantedFreeFacts(input: {
    readonly rows: readonly Pick<S20Row, 'instanceId' | 'instanceStatus' | 'subscriptionId'>[];
    readonly now: Date;
    readonly billingFacts: BillingFactSink;
    readonly listing?: AddonFactListing;
}): Promise<void> {
    for (const row of input.rows)
        await emitAddonFact({
            billingFacts: input.billingFacts,
            listing: input.listing,
            source: { instanceId: row.instanceId },
            build: (anchored) => {
                if (row.instanceStatus === 'PENDING_AUTHORIZATION')
                    return {
                        kind: 'ADDON_CHECKOUT_ABANDONED',
                        ...anchored.subject,
                        actorKind: 'SYSTEM',
                        occurredAt: input.now,
                        reason: 'CLOSED_BY_SYSTEM',
                        secondsInPending: wholeSecondsBetween({
                            from: anchored.createdAt,
                            to: input.now
                        })
                    };
                // The instance is free now: its cancelled COMPLEMENTO travels only as the
                // previous subscription, never as the live `subscription_id`.
                const { subscriptionId: _cancelled, ...subject } = anchored.subject;
                return {
                    kind: 'ADDON_GRANTED_FREE',
                    ...subject,
                    actorKind: 'ADMIN',
                    occurredAt: input.now,
                    source: 'S20_CONVERSION',
                    previousAmountMinor: anchored.amountMinor,
                    ...(anchored.cycle ? { previousCycle: anchored.cycle } : {}),
                    previousSubscriptionId: row.subscriptionId
                };
            }
        });
}
