/**
 * The analytics half of every A5/A6 ending (HOS-1883 §5.3): which fact an ending owes. The
 * coverage-notice half stays in `addon-instance-a5.ts` (`emitAddonCoverageRemoved`), which G5
 * reads as A5's `via: notice`, and calls {@link emitAddonEndingFacts} after its notices.
 */
import type { AddonEndPath, AddonFact, AddonFactActorKind } from '../facts/addon-fact';
import type { BillingFactSink } from '../facts/billing-fact-sink';
import {
    type AddonFactListing,
    type AddonFactSnapshot,
    emitAddonFact,
    wholeSecondsBetween
} from './addon-fact-emit';
import type { CancelledAddon } from './addon-instance-a5';

const DAY_MS = 86_400_000;

/** What an A5/A6 act did to one instance, captured under its lock, for the ending fact. */
export interface AddonEnding {
    /** The state the instance was cancelled from. */
    readonly origin: 'PENDING_AUTHORIZATION' | 'ACTIVE';
    /** False when a permanent grant titles it: it is free (A1-bis, or an earlier S20). */
    readonly paid: boolean;
    /** What happened to its COMPLEMENTO in the same transaction; `null` without one. */
    readonly complement:
        | { readonly outcome: 'CANCELLED'; readonly from: string }
        | { readonly outcome: 'ALREADY_CANCELLED' | 'NOT_APPLICABLE' }
        | null;
    /** The instant of the act. */
    readonly endedAt: Date;
}

/**
 * Which ending a call site reports (HOS-1883 §5.2). It is a required parameter so every caller
 * states its path (T-5); the natural `FIXED_DAYS` expiry passes `NOT_AN_END` (T-4).
 */
export type AddonEndFact =
    | {
          readonly path: AddonEndPath;
          readonly actorKind: AddonFactActorKind;
          readonly billingFacts: BillingFactSink | undefined;
          readonly listing?: AddonFactListing;
      }
    | 'NOT_AN_END';

/**
 * The fact one ending owes, per HOS-1883 §5.3: a pending instance was a checkout that died; a
 * paid, live instance whose billing ended now (its complement cancelled in this act, or a
 * one-time instance) is `addon_cancelled`; a free instance, or one whose complement an earlier
 * S20 already ended, owes nothing.
 *
 * @param input.ending - What the act did
 * @param input.end - The call site's path and actor
 * @param input.anchored - The instance's anchored identity
 * @returns The fact, or `null`
 */
export function addonEndingFact(input: {
    readonly ending: AddonEnding;
    readonly end: Exclude<AddonEndFact, 'NOT_AN_END'>;
    readonly anchored: AddonFactSnapshot;
}): AddonFact | null {
    const { ending, end, anchored } = input;
    const common = {
        ...anchored.subject,
        actorKind: end.actorKind,
        occurredAt: ending.endedAt
    };
    if (ending.origin === 'PENDING_AUTHORIZATION') {
        // A pending complement is CANCELLED only by S20, which already reported this checkout
        // as abandoned (T-7): a second abandonment would count one funnel exit twice.
        if (ending.complement?.outcome === 'ALREADY_CANCELLED') return null;
        return {
            kind: 'ADDON_CHECKOUT_ABANDONED',
            ...common,
            reason: end.path === 'OWNER_WITHDREW' ? 'OWNER_WITHDREW' : 'CLOSED_BY_SYSTEM',
            secondsInPending: wholeSecondsBetween({
                from: anchored.createdAt,
                to: ending.endedAt
            })
        };
    }
    if (!ending.paid) return null;
    if (ending.complement !== null && ending.complement.outcome !== 'CANCELLED') return null;
    return {
        kind: 'ADDON_CANCELLED',
        ...common,
        path: end.path,
        wasScheduled: ending.complement?.from === 'CANCEL_SCHEDULED',
        ...(anchored.startsAt
            ? {
                  lifetimeDays: Math.max(
                      0,
                      Math.floor((ending.endedAt.getTime() - anchored.startsAt.getTime()) / DAY_MS)
                  )
              }
            : {})
    };
}

/**
 * After the caller's commit, the analytics fact each ending owes (HOS-1883 §5.3). Called by
 * `emitAddonCoverageRemoved` (A5's file), right after its coverage notices. Never throws.
 *
 * @param input.cancelled - What `runOrphanhood`/`applyA5`/`applyA6` cancelled
 * @param input.end - The call site's ending path, or `NOT_AN_END`
 */
export async function emitAddonEndingFacts(input: {
    readonly cancelled: readonly CancelledAddon[];
    readonly end: AddonEndFact;
}): Promise<void> {
    const end = input.end;
    if (end === 'NOT_AN_END') return;
    for (const addon of input.cancelled)
        await emitAddonFact({
            billingFacts: end.billingFacts,
            listing: end.listing,
            source: { instanceId: addon.instanceId },
            build: (anchored) => addonEndingFact({ ending: addon.ending, end, anchored })
        });
}
