import { and, type DrizzleClient, eq, getDb, isNull, lt, providerLinks } from '@repo/db';
import type { CancellationSeenAnnotator } from './subscription-billing-ports.js';

/**
 * Builds the real «anotar la cancelación vista» over `provider_link.cancelled_seen_at`
 * (AC:B4:11; DEC-ARCH-017📌12; B/02 §2.2).
 *
 * - `annotateCancellationSeen` writes the instant of the FIRST re-read that saw the authorization
 *   `cancelled` and never moves it afterwards, whoever calls it (the notice handler, S16, S6 or
 *   the sweep) and in whatever order.
 * - `clearCancellationSeen` empties it only when the live re-read is newer than the recorded
 *   cancellation (AC:B4:5): an older live read does not erase a cancellation seen after it.
 *
 * A subscription without a `provider_link` (a manual payer) is a silent no-op for both. Nothing
 * from `@repo/db` is evaluated until a method runs, so modules that mock `@repo/db` can import it.
 *
 * @param input.db - Optional client (e.g. a transaction); defaults to `getDb()` at call time.
 * @returns The annotator.
 */
export function createProviderLinkCancellationSeen(
    input: { readonly db?: DrizzleClient } = {}
): CancellationSeenAnnotator {
    const client = (): DrizzleClient => input.db ?? getDb();
    return {
        async annotateCancellationSeen({ subscriptionId, seenAt }) {
            await client()
                .update(providerLinks)
                .set({ cancelledSeenAt: seenAt })
                .where(
                    and(
                        eq(providerLinks.subscriptionId, subscriptionId),
                        isNull(providerLinks.cancelledSeenAt)
                    )
                );
        },
        async clearCancellationSeen({ subscriptionId, seenAliveAt }) {
            await client()
                .update(providerLinks)
                .set({ cancelledSeenAt: null })
                .where(
                    and(
                        eq(providerLinks.subscriptionId, subscriptionId),
                        lt(providerLinks.cancelledSeenAt, seenAliveAt)
                    )
                );
        }
    };
}

/** The real cancellation-seen annotator over the default database client (AC:B4:11). */
export const providerLinkCancellationSeen: CancellationSeenAnnotator =
    createProviderLinkCancellationSeen();
