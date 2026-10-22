import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { idempotencyKeys } from '../../schemas/vertical/idempotency-key.dbschema.ts';
import { providerLinks } from '../../schemas/vertical/provider-link.dbschema.ts';
import { subscriptions } from '../../schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import type { LiveCommitment } from './subscription.model.ts';

/** Input for reading one pending-attempt candidate and its newest creation key. */
export interface FindPendingAttemptByIdInput {
    readonly subscriptionId: string;
    readonly tx?: DrizzleClient;
}

/** Reads a subscription by id with its newest creation key and provider link, regardless of status. */
export async function findPendingAttemptById(
    input: FindPendingAttemptByIdInput
): Promise<LiveCommitment | null> {
    const db = input.tx ?? getDb();
    const [row] = await db
        .select({
            subscription: subscriptions,
            idempotencyKey: idempotencyKeys,
            providerLink: providerLinks
        })
        .from(subscriptions)
        .leftJoin(
            idempotencyKeys,
            and(
                eq(idempotencyKeys.subjectId, subscriptions.id),
                eq(idempotencyKeys.operation, 'PREAPPROVAL_CREATE')
            )
        )
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, input.subscriptionId))
        .orderBy(desc(idempotencyKeys.createdAt), desc(idempotencyKeys.key))
        .limit(1);
    return row ?? null;
}
