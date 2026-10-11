import { and, asc, eq, gt, inArray, isNotNull, isNull, notExists, notInArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from '../../client.ts';
import {
    courtesyGrants,
    type SelectCourtesyGrant
} from '../../schemas/vertical/courtesy-grant.dbschema.ts';
import {
    LIVE_SUBSCRIPTION_STATUSES,
    type SelectSubscription,
    subscriptions
} from '../../schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Input for one keyset page of live successors whose predecessor is no longer live. */
export interface ListOpenSuccessionsOnDeadPredecessorsPageInput {
    /** Exclusive id cursor for the successor row. */
    readonly afterSubscriptionId?: string;
    /** Maximum rows to return. */
    readonly limit: number;
    /** Optional transaction client. */
    readonly tx?: DrizzleClient;
}

/** A live successor and the non-live predecessor it replaces. */
export interface OpenSuccessionOnDeadPredecessorRow {
    /** Live row reached by the reconciliation inventory. */
    readonly successor: SelectSubscription;
    /** Predecessor that is no longer a live subscription. */
    readonly predecessor: SelectSubscription;
}

/** Input for one keyset page of deferred courtesies awaiting re-emission. */
export interface ListDeferredCourtesiesWithActiveSuccessorPageInput {
    /** Exclusive courtesy grant id cursor. */
    readonly afterCourtesyGrantId?: string;
    /** Maximum rows to return. */
    readonly limit: number;
    /** Optional transaction client. */
    readonly tx?: DrizzleClient;
}

/** A deferred courtesy, its predecessor subscription, and its ACTIVE successor. */
export interface DeferredCourtesyWithActiveSuccessorRow {
    /** Courtesy grant with a remaining balance that has not been closed. */
    readonly courtesyGrant: SelectCourtesyGrant;
    /** Subscription that owns the deferred courtesy. */
    readonly predecessor: SelectSubscription;
    /** ACTIVE successor expected to receive the courtesy re-emission. */
    readonly successor: SelectSubscription;
}

/** Input to find existing subscriptions without a live successor. */
export interface FindSubscriptionIdsWithoutLiveSuccessorInput {
    /** Candidate subscription ids. */
    readonly subscriptionIds: readonly string[];
    /** Optional transaction client. */
    readonly tx?: DrizzleClient;
}

/** Read-only queries that supply the first, second, and sixth zero-call checks. */
export class ReconciliationZeroCallModel {
    /**
     * Lists keyset pages of live successor subscriptions whose predecessor is no longer live.
     * "Live" means the six states in LIVE_SUBSCRIPTION_STATUSES; the successor is the subject
     * because it is the row reached by the sweep, including pending rows without provider links.
     * This supplies the first zero-call check, which records the succession on the successor
     * without reading from a provider.
     *
     * @param input Page limit, optional exclusive successor id cursor, and optional transaction.
     * @returns Successor and predecessor rows ordered by successor id.
     */
    async listOpenSuccessionsOnDeadPredecessorsPage(
        input: ListOpenSuccessionsOnDeadPredecessorsPageInput
    ): Promise<ReadonlyArray<OpenSuccessionOnDeadPredecessorRow>> {
        const predecessor = alias(subscriptions, 'predecessor');
        const db = input.tx ?? getDb();
        return db
            .select({ successor: subscriptions, predecessor })
            .from(subscriptions)
            .innerJoin(predecessor, eq(predecessor.id, subscriptions.succeedsId))
            .where(
                and(
                    isNotNull(subscriptions.succeedsId),
                    inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES),
                    notInArray(predecessor.status, [...LIVE_SUBSCRIPTION_STATUSES]),
                    input.afterSubscriptionId === undefined
                        ? undefined
                        : gt(subscriptions.id, input.afterSubscriptionId)
                )
            )
            .orderBy(asc(subscriptions.id))
            .limit(input.limit);
    }

    /**
     * Lists keyset pages of deferred courtesy grants with an open balance whose successor is ACTIVE.
     * The subject row is the courtesy grant owned by the predecessor; the result also includes
     * that predecessor and its ACTIVE successor. This supplies the sixth zero-call check for a
     * courtesy that S9 has not re-emitted, without reading from a provider.
     *
     * @param input Page limit, optional exclusive courtesy grant id cursor, and optional transaction.
     * @returns Courtesy grant, predecessor, and ACTIVE successor rows ordered by grant id.
     */
    async listDeferredCourtesiesWithActiveSuccessorPage(
        input: ListDeferredCourtesiesWithActiveSuccessorPageInput
    ): Promise<ReadonlyArray<DeferredCourtesyWithActiveSuccessorRow>> {
        const predecessor = alias(subscriptions, 'courtesy_predecessor');
        const successor = alias(subscriptions, 'courtesy_successor');
        const db = input.tx ?? getDb();
        return db
            .select({ courtesyGrant: courtesyGrants, predecessor, successor })
            .from(courtesyGrants)
            .innerJoin(predecessor, eq(predecessor.id, courtesyGrants.subscriptionId))
            .innerJoin(successor, eq(successor.id, predecessor.succeededById))
            .where(
                and(
                    isNotNull(courtesyGrants.balanceMonths),
                    isNull(courtesyGrants.balanceClosedAt),
                    isNotNull(predecessor.succeededById),
                    eq(successor.status, 'ACTIVE'),
                    input.afterCourtesyGrantId === undefined
                        ? undefined
                        : gt(courtesyGrants.id, input.afterCourtesyGrantId)
                )
            )
            .orderBy(asc(courtesyGrants.id))
            .limit(input.limit);
    }

    /**
     * Filters candidate subscriptions to those without a successor in a live state.
     * The subject row is each candidate subscription; the query returns its id only when no live
     * successor points to it. The second zero-call check uses this filter before resolving retained
     * payments by branch, so only payments on rows without a live successor are considered.
     *
     * @param input Candidate subscription ids and an optional transaction.
     * @returns IDs of existing candidates that have no live successor; empty for empty input.
     */
    async findSubscriptionIdsWithoutLiveSuccessor(
        input: FindSubscriptionIdsWithoutLiveSuccessorInput
    ): Promise<ReadonlyArray<string>> {
        if (input.subscriptionIds.length === 0) return [];
        const liveSuccessor = alias(subscriptions, 'live_successor');
        const db = input.tx ?? getDb();
        const rows = await db
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(
                and(
                    inArray(subscriptions.id, [...input.subscriptionIds]),
                    notExists(
                        db
                            .select({ id: liveSuccessor.id })
                            .from(liveSuccessor)
                            .where(
                                and(
                                    eq(liveSuccessor.succeedsId, subscriptions.id),
                                    inArray(liveSuccessor.status, [...LIVE_SUBSCRIPTION_STATUSES])
                                )
                            )
                    )
                )
            );
        return rows.map(({ id }) => id);
    }
}

/** Shared read-only zero-call reconciliation model. */
export const reconciliationZeroCallModel = new ReconciliationZeroCallModel();
