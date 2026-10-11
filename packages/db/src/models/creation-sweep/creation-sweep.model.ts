import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt, isNull, or, sql } from 'drizzle-orm';
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
    readonly planName: string;
}

/** Input for minting a persisted key before retrying an external creation. */
export interface MintCreateKeyIfUnlinkedInput {
    readonly subscriptionId: string;
    readonly createdAt: Date;
    readonly tx?: DrizzleClient;
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
            ORDER BY newest.created_at DESC
            LIMIT 1
        )`;
        return db
            .select({
                subscription: subscriptions,
                providerLink: providerLinks,
                newestCreateKey: idempotencyKeys,
                userEmail: users.email,
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
}

/** Shared creation sweep persistence model. */
export const creationSweepModel = new CreationSweepModel();
