import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { users } from '../../schemas/user/user.dbschema.ts';
import { billingOptions } from '../../schemas/vertical/billing-option.dbschema.ts';
import {
    idempotencyKeys,
    type SelectIdempotencyKey
} from '../../schemas/vertical/idempotency-key.dbschema.ts';
import { plans, planVersions } from '../../schemas/vertical/plan-catalog.dbschema.ts';
import {
    providerLinks,
    type SelectProviderLink
} from '../../schemas/vertical/provider-link.dbschema.ts';
import {
    type SelectSubscription,
    subscriptions
} from '../../schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { reconciliationInventoryModel } from '../reconciliation-inventory/reconciliation-inventory.model.ts';

/** Input for a bounded keyset page of pending card creations. */
export interface ListPendingCreationPageInput {
    readonly now: Date;
    readonly afterSubscriptionId?: string;
    readonly limit: number;
    readonly tx?: DrizzleClient;
}

/** One pending creation and the persistence context needed to call the provider. */
export interface PendingCreationRow {
    readonly subscription: SelectSubscription;
    readonly providerLink: SelectProviderLink | null;
    readonly newestCreateKey: SelectIdempotencyKey | null;
    readonly userEmail: string | null;
    readonly payerEmail: string | null;
    readonly planName: string;
}

/** Input for minting a persisted key before retrying an external creation. */
export interface MintCreateKeyIfUnlinkedInput {
    readonly subscriptionId: string;
    readonly createdAt: Date;
    readonly tx?: DrizzleClient;
}

/** Input for completing the creation key a recovered authorization answers (HOS-1725). */
export interface CompleteNewestCreateKeyInput {
    readonly subscriptionId: string;
    /** Sanitized, application-owned result; never a raw provider response. */
    readonly result: Record<string, unknown>;
    readonly completedAt: Date;
    readonly tx: DrizzleClient;
}

/** Read model and narrow key writer used by the creation sweep. */
export class CreationSweepModel {
    /**
     * Lists pending PRINCIPAL/CARD rows whose authorization window is still open.
     * Linked rows remain candidates because duplicate creations can arrive while
     * the local row is pending; ACTIVE rows belong to the portfolio sweep (B11.1),
     * which reads them by provider id.
     */
    async listPendingCreationPage(
        input: ListPendingCreationPageInput
    ): Promise<ReadonlyArray<PendingCreationRow>> {
        const db = input.tx ?? getDb();
        const newestKey = sql`${idempotencyKeys.key} = (
            SELECT newest.key FROM idempotency_key AS newest
            WHERE newest.subject_id = ${subscriptions.id}
              AND newest.operation = 'PREAPPROVAL_CREATE'
            ORDER BY newest.created_at DESC, newest.key DESC
            LIMIT 1
        )`;
        return db
            .select({
                subscription: subscriptions,
                providerLink: providerLinks,
                newestCreateKey: idempotencyKeys,
                userEmail: users.email,
                payerEmail: sql<
                    string | null
                >`coalesce(${subscriptions.declaredPayerEmail}, ${users.email})`,
                planName: plans.name
            })
            .from(subscriptions)
            .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
            .leftJoin(
                idempotencyKeys,
                and(
                    eq(idempotencyKeys.subjectId, subscriptions.id),
                    eq(idempotencyKeys.operation, 'PREAPPROVAL_CREATE'),
                    newestKey
                )
            )
            .leftJoin(users, eq(users.id, subscriptions.userId))
            .innerJoin(billingOptions, eq(billingOptions.id, subscriptions.billingOptionId))
            .innerJoin(planVersions, eq(planVersions.id, billingOptions.planVersionId))
            .innerJoin(plans, eq(plans.id, planVersions.planId))
            .where(
                and(
                    eq(subscriptions.class, 'PRINCIPAL'),
                    eq(subscriptions.status, 'PENDING_AUTHORIZATION'),
                    eq(subscriptions.paymentMethod, 'CARD'),
                    or(
                        isNull(subscriptions.authorizationWindowEndsAt),
                        gt(subscriptions.authorizationWindowEndsAt, input.now)
                    ),
                    input.afterSubscriptionId === undefined
                        ? undefined
                        : gt(subscriptions.id, input.afterSubscriptionId)
                )
            )
            .orderBy(asc(subscriptions.id))
            .limit(input.limit);
    }

    /**
     * Locks and rechecks a pending unlinked row, then persists a fresh creation key.
     * The caller's transaction is reused or a local one commits before the provider call.
     */
    async mintCreateKeyIfUnlinked(
        input: MintCreateKeyIfUnlinkedInput
    ): Promise<{ readonly key: string } | null> {
        const write = async (tx: DrizzleClient): Promise<{ readonly key: string } | null> => {
            const locked = await reconciliationInventoryModel.lockSubscriptionForLink({
                subscriptionId: input.subscriptionId,
                tx
            });
            if (
                locked?.subscription.status !== 'PENDING_AUTHORIZATION' ||
                locked.providerLink !== null
            ) {
                return null;
            }
            const key = randomUUID();
            await tx.insert(idempotencyKeys).values({
                key,
                operation: 'PREAPPROVAL_CREATE',
                subjectId: input.subscriptionId,
                createdAt: input.createdAt
            });
            return { key };
        };
        return input.tx ? write(input.tx) : getDb().transaction(write);
    }

    /**
     * Completes the subscription's NEWEST `PREAPPROVAL_CREATE` key with `result`, only while it
     * is still incomplete (HOS-1725).
     *
     * "Newest" is the order `SubscriptionModel.findLiveCommitment` reads (`created_at DESC, key
     * DESC`), so the key completed here is exactly the one S1's reuse decides on. Older keys of
     * dead attempts are left as they are: nothing reads them. A key that is already completed
     * (an `applied: false` creation, or a concurrent writer) is never overwritten.
     *
     * Run it inside the caller's transaction, after locking the subscription, so the key and the
     * provider link it describes commit together.
     *
     * @param input.subscriptionId - The subject of the key
     * @param input.result - The sanitized, application-owned result to store
     * @param input.completedAt - The caller's decision instant
     * @param input.tx - The caller's transaction
     * @returns `true` when a key was completed
     */
    async completeNewestCreateKey(input: CompleteNewestCreateKeyInput): Promise<boolean> {
        const [newest] = await input.tx
            .select({ key: idempotencyKeys.key, completedAt: idempotencyKeys.completedAt })
            .from(idempotencyKeys)
            .where(
                and(
                    eq(idempotencyKeys.subjectId, input.subscriptionId),
                    eq(idempotencyKeys.operation, 'PREAPPROVAL_CREATE')
                )
            )
            .orderBy(desc(idempotencyKeys.createdAt), desc(idempotencyKeys.key))
            .limit(1)
            .for('update');
        if (!newest || newest.completedAt !== null) return false;
        const completed = await input.tx
            .update(idempotencyKeys)
            .set({ result: input.result, completedAt: input.completedAt })
            .where(and(eq(idempotencyKeys.key, newest.key), isNull(idempotencyKeys.completedAt)))
            .returning({ key: idempotencyKeys.key });
        return completed.length === 1;
    }
}

/** Shared creation sweep persistence model. */
export const creationSweepModel = new CreationSweepModel();
