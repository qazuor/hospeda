import {
    type SelectSubscription,
    subscriptions
} from '../../schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Creates a pending manual commitment without a provider creation key. */
export async function createManualPendingAuthorization(input: {
    readonly userId: string;
    readonly vertical: string;
    readonly planVersionId: string;
    readonly billingOptionId: string;
    readonly authorizationWindowDeadlineVersion: number;
    readonly authorizationWindowEndsAt: Date;
    readonly tx: DrizzleClient;
}): Promise<SelectSubscription> {
    const [row] = await input.tx
        .insert(subscriptions)
        .values({
            userId: input.userId,
            vertical: input.vertical,
            planVersionId: input.planVersionId,
            billingOptionId: input.billingOptionId,
            paymentMethod: 'MANUAL',
            class: 'PRINCIPAL',
            status: 'PENDING_AUTHORIZATION',
            authorizationWindowDeadlineVersion: input.authorizationWindowDeadlineVersion,
            authorizationWindowEndsAt: input.authorizationWindowEndsAt
        })
        .returning();
    if (!row) throw new Error('Manual subscription insert returned no row');
    return row;
}
