import type { DrizzleClient } from '@repo/db';
import { eq, inArray, subscriptionScheduledChanges, subscriptions } from '@repo/db';
import { vi } from 'vitest';
import type { ScheduledChangeApplier } from '../../../../src/services/billing/subscription/subscription-billing-ports.js';
import { getServiceTestDb } from '../helpers.js';

/**
 * Seeds the row's entry in `subscription_scheduled_change` (TEST:B7:16, AC:B7:28). The
 * target pair is the row's own plan version and billing option, which satisfies the
 * composite FK to `billing_option`; what S38 does with it is B8b's.
 */
export async function seedScheduledChange(input: {
    readonly subscriptionId: string;
    readonly effectiveAt: Date;
}) {
    const db = getServiceTestDb();
    const [own] = await db
        .select({
            planVersionId: subscriptions.planVersionId,
            billingOptionId: subscriptions.billingOptionId
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId));
    if (!own?.planVersionId || !own.billingOptionId)
        throw new Error('Subscription to schedule a change on has no plan version');
    const [change] = await db
        .insert(subscriptionScheduledChanges)
        .values({
            subscriptionId: input.subscriptionId,
            targetPlanVersionId: own.planVersionId,
            targetBillingOptionId: own.billingOptionId,
            effectiveAt: input.effectiveAt
        })
        .returning();
    if (!change) throw new Error('Could not seed the scheduled change');
    return change;
}

/** The queue entries of the given rows (what the cases assert S7 left untouched). */
export async function scheduledChangesOf(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, subscriptionId));
}

/** Deletes the queue entries of the given rows; runs before the rows are retired. */
export async function deleteScheduledChanges(subscriptionIds: readonly string[]): Promise<void> {
    if (subscriptionIds.length === 0) return;
    await getServiceTestDb()
        .delete(subscriptionScheduledChanges)
        .where(inArray(subscriptionScheduledChanges.subscriptionId, [...subscriptionIds]));
}

/** What the spy applier saw when S38 was called. */
export interface ScheduledChangeApplySeen {
    readonly subscriptionId: string;
    /** The row's status read with the received `tx` (inside the act). */
    readonly statusInTx: string | undefined;
    /** The row's status read OUTSIDE the transaction (what is committed). */
    readonly statusCommitted: string | undefined;
}

/**
 * A `ScheduledChangeApplier` spy (TEST:B7:16, AC:B7:28; molde `spySuccessionCloser`): when
 * called it reads the row's status with the `tx` it received and from a separate
 * connection. Seeing S7's write in the `tx` but not outside proves the call happens in
 * S7's act: same transaction, before the commit.
 */
export function spyScheduledChangeApplier(): {
    readonly applier: ScheduledChangeApplier;
    readonly seen: ScheduledChangeApplySeen[];
} {
    const seen: ScheduledChangeApplySeen[] = [];
    const statusOf = async (db: DrizzleClient, subscriptionId: string) => {
        const [row] = await db
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId));
        return row?.status;
    };
    const applier: ScheduledChangeApplier = {
        applyScheduledChange: vi.fn(async ({ subscriptionId, tx }) => {
            const statusInTx = await statusOf(tx, subscriptionId);
            const statusCommitted = await statusOf(getServiceTestDb(), subscriptionId);
            seen.push({ subscriptionId, statusInTx, statusCommitted });
        })
    };
    return { applier, seen };
}
