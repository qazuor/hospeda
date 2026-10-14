/**
 * The ports of the addon orphanhood (B/16 §4.2, AC:B5:25): what the predicate needs from
 * outside billing's own tables. Nothing from `@repo/db` is evaluated at module level.
 */
import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import type { SubscriptionPayments } from '../subscription/subscription-billing-ports';

/**
 * «Ancla viva» (glossary): a `permanent_grant_vertical` row whose grant has `revoked_at` null.
 * The third half of B/16 §4.2 asks whether one exists for a `(user, vertical)`.
 */
export interface LiveAnchorReader {
    /**
     * Whether `(userId, vertical)` holds a live anchor, read with the caller's transaction.
     * A read error throws: the predicate fails closed, never on a guessed answer.
     */
    hasLiveAnchor(input: {
        readonly userId: string;
        readonly vertical: string;
        readonly tx: DrizzleClient;
    }): Promise<boolean>;
}

/**
 * The truthful default before B9a (notas I-2): `permanent_grant` does not exist in this cut,
 * so no `(user, vertical)` holds a live anchor and the answer is «none» (precedent:
 * `coverage/billing-coverage.ts` `resolveCourtesyAndGrantSources`). B9a (B9a.1, `S13`) MUST
 * replace it with the real reader before granting the first grant: with grants in the
 * database this default fails toward CANCELLING an addon a grant relieves, which is
 * irreversible at the provider (PA-5).
 */
export const noLiveAnchors: LiveAnchorReader = {
    async hasLiveAnchor() {
        return false;
    }
};

/** Everything the orphanhood predicate and its candidates read from outside. */
export interface AddonOrphanhoodPorts {
    /** `políticaDeAddon`: the scope type of the ANCHORED version (contract §4.1). */
    readonly addonPolicy: VerticalsForBilling['addonPolicy'];
    /** `ficha`: the vertical and owner of the listing a `LISTING` instance targets. */
    readonly listing: VerticalsForBilling['listing'];
    /** Live anchors; defaults to {@link noLiveAnchors}. */
    readonly liveAnchors?: LiveAnchorReader;
    /** «Pagando» (B/16 §2.2); defaults to `creditedPaymentsFromLedger`. */
    readonly payments?: SubscriptionPayments;
}
