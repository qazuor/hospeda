import { and, eq, exists, gt, isNull, ne, or, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { payments } from '../../schemas/vertical/payment.dbschema.ts';
import { providerLinks } from '../../schemas/vertical/provider-link.dbschema.ts';
import { subscriptions } from '../../schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import type { ExpiredAuthorizationWindow } from './subscription.model.ts';

/**
 * Reads pending principal authorizations with a provider link and a locally
 * succeeded payment. Only SUCCEEDED counts because refunded or disputed facts
 * no longer represent an eligible credited signup. Expired windows are left to
 * the expiry path, which already reads and resolves those authorizations.
 */
export async function findCreditedPendingAuthorizations(input: {
    readonly now: Date;
    readonly limit: number;
    readonly tx?: DrizzleClient;
}): Promise<ExpiredAuthorizationWindow[]> {
    const db = input.tx ?? getDb();
    return db
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(subscriptions)
        .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(
            and(
                eq(subscriptions.class, 'PRINCIPAL'),
                eq(subscriptions.status, 'PENDING_AUTHORIZATION'),
                ne(subscriptions.paymentMethod, 'MANUAL'),
                or(
                    isNull(subscriptions.authorizationWindowEndsAt),
                    gt(subscriptions.authorizationWindowEndsAt, input.now)
                ),
                exists(
                    db
                        .select({ one: sql`1` })
                        .from(payments)
                        .where(
                            and(
                                eq(payments.subscriptionId, subscriptions.id),
                                eq(payments.status, 'SUCCEEDED')
                            )
                        )
                )
            )
        )
        .orderBy(subscriptions.createdAt)
        .limit(input.limit) as Promise<ExpiredAuthorizationWindow[]>;
}
