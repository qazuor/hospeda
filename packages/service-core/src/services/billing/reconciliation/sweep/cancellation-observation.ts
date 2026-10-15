import {
    type ActStart,
    type AuthorizationSnapshot,
    assertFreshForAct,
    type ProviderRead
} from '@repo/payments';
import {
    type CancellationSeenAnnotator,
    recordAuthorizationSeenAlive,
    recordCancellationSeen
} from '../../subscription/subscription-billing-ports.js';

/** Input for recording what an authorization re-read observed. */
export interface ObserveAuthorizationReadInput {
    readonly read: ProviderRead<AuthorizationSnapshot>;
    readonly act: ActStart;
    readonly subscriptionId: string;
    readonly annotator: CancellationSeenAnnotator;
    readonly previouslySeenAt: Date | null;
}

/**
 * Validates an authorization read against its act and records its cancellation observation through
 * B4's shared annotator. A live state clears an earlier observation only when the page contained
 * one; an empty page needs no write. Annotation errors are logged and swallowed by the port helpers.
 *
 * @param input The authorization read, act, subscription and B4 annotator.
 * @returns Whether the authorization was cancelled and the provider's read instant.
 * @throws If the read predates the act.
 */
export async function observeAuthorizationRead(
    input: ObserveAuthorizationReadInput
): Promise<{ readonly cancelled: boolean; readonly readAt: Date }> {
    const { snapshot, readAt } = assertFreshForAct({ read: input.read, act: input.act });
    if (snapshot.status === 'cancelled') {
        await recordCancellationSeen({
            annotator: input.annotator,
            subscriptionId: input.subscriptionId,
            seenAt: readAt
        });
        return { cancelled: true, readAt };
    }
    if (input.previouslySeenAt !== null)
        await recordAuthorizationSeenAlive({
            annotator: input.annotator,
            subscriptionId: input.subscriptionId,
            seenAt: readAt
        });
    return { cancelled: false, readAt };
}
