import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    type COURTESY_CLOSE_REASONS,
    courtesyGrants
} from '../../schemas/vertical/courtesy-grant.dbschema.ts';
import {
    idempotencyKeys,
    type SelectIdempotencyKey
} from '../../schemas/vertical/idempotency-key.dbschema.ts';
import { manualPayments } from '../../schemas/vertical/manual-payment.dbschema.ts';
import {
    type InsertProviderLink,
    providerLinks,
    type SelectProviderLink
} from '../../schemas/vertical/provider-link.dbschema.ts';
import {
    LIVE_SUBSCRIPTION_STATUSES,
    type SelectSubscription,
    subscriptions
} from '../../schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Identity and immutable anchors for the new card subscription. */
export interface CreatePendingAuthorizationInput {
    readonly userId: string;
    readonly vertical: string;
    readonly planVersionId: string;
    readonly billingOptionId: string;
    readonly authorizationWindowDeadlineVersion: number;
    readonly authorizationWindowEndsAt: Date;
    /** Optional outer transaction; its caller must commit before the provider call. */
    readonly tx?: DrizzleClient;
}

/** A persisted row and its provider-call idempotency key. */
export interface PendingAuthorizationRow {
    readonly subscription: SelectSubscription;
    readonly idempotencyKey: string;
}

/** Subject of the CHARGE_DECLINED preapproval re-read in S1. */
export interface FindDeclinedInput {
    readonly userId: string;
    readonly vertical: string;
    readonly tx?: DrizzleClient;
}

export interface DeclinedWithProviderLink {
    readonly subscription: SelectSubscription;
    readonly providerLink: SelectProviderLink | null;
}

/** Subject of S1's live-commitment read (AC:B3:6). */
export interface FindLiveCommitmentInput {
    readonly userId: string;
    readonly vertical: string;
    readonly tx?: DrizzleClient;
}

/**
 * The one live principal commitment of a `user + vertical`, with the pieces S1
 * needs to decide whether it can be reused: its `PREAPPROVAL_CREATE` key and its
 * provider link. Both are nullable — a row can exist with no key (impossible in
 * S1's flow but honest in the model) or no link yet.
 */
export interface LiveCommitment {
    readonly subscription: SelectSubscription;
    readonly idempotencyKey: SelectIdempotencyKey | null;
    readonly providerLink: SelectProviderLink | null;
}

/** One principal authorization whose stored window has expired, with its provider mandate if any. */
export interface ExpiredAuthorizationWindow {
    readonly subscription: SelectSubscription;
    readonly providerLink: SelectProviderLink | null;
}

/** The caller supplies the decision instant and a bounded batch size. */
export interface FindExpiredAuthorizationWindowsInput {
    readonly now: Date;
    readonly limit: number;
    readonly tx?: DrizzleClient;
}

/** Conditional status transition at the caller's decision instant. */
export interface PendingAuthorizationTransitionInput {
    readonly subscriptionId: string;
    readonly now: Date;
    readonly tx?: DrizzleClient;
}

/** Provider result persisted after the external authorization call. */
export interface RecordAuthorizationResultInput {
    readonly idempotencyKey: string;
    readonly subscriptionId: string;
    readonly provider: InsertProviderLink['provider'];
    readonly providerId: InsertProviderLink['providerId'];
    /** Sanitized, application-owned result; never a raw provider response. */
    readonly result: Record<string, unknown>;
    readonly completedAt: Date;
    readonly tx?: DrizzleClient;
}

/** Result of S3's abandonment: whether the row was written and the courtesy balance that was closed. */
export interface AbandonPendingAuthorizationResult {
    /** `true` when the subscription row was transitioned. */
    readonly wrote: boolean;
    /** Sum of `balance_months` closed on `courtesy_grant`, or `null` when none was closed. */
    readonly closedCourtesyMonths: number | null;
}

/** Minimal S1 persistence model; no BaseModelImpl CRUD surface. */
export class SubscriptionModel {
    /** Writes the PENDING_AUTHORIZATION row and key in one transaction. */
    async createPendingAuthorization(
        input: CreatePendingAuthorizationInput
    ): Promise<PendingAuthorizationRow> {
        const write = async (tx: DrizzleClient): Promise<PendingAuthorizationRow> => {
            const [subscription] = await tx
                .insert(subscriptions)
                .values({
                    userId: input.userId,
                    vertical: input.vertical,
                    planVersionId: input.planVersionId,
                    billingOptionId: input.billingOptionId,
                    paymentMethod: 'CARD',
                    status: 'PENDING_AUTHORIZATION',
                    class: 'PRINCIPAL',
                    authorizationWindowDeadlineVersion: input.authorizationWindowDeadlineVersion,
                    authorizationWindowEndsAt: input.authorizationWindowEndsAt
                })
                .returning();
            if (!subscription) throw new Error('Subscription insert returned no row');
            const idempotencyKey = randomUUID();
            await tx.insert(idempotencyKeys).values({
                key: idempotencyKey,
                operation: 'PREAPPROVAL_CREATE',
                subjectId: subscription.id
            });
            return { subscription, idempotencyKey };
        };
        return input.tx ? write(input.tx) : getDb().transaction(write);
    }

    /** Reads at most `limit` principal pending rows whose stored window ended by `now`; null windows do not qualify. */
    async findExpiredAuthorizationWindows(
        input: FindExpiredAuthorizationWindowsInput
    ): Promise<ExpiredAuthorizationWindow[]> {
        const db = input.tx ?? getDb();
        return db
            .select({ subscription: subscriptions, providerLink: providerLinks })
            .from(subscriptions)
            .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
            .where(
                and(
                    eq(subscriptions.class, 'PRINCIPAL'),
                    eq(subscriptions.status, 'PENDING_AUTHORIZATION'),
                    lte(subscriptions.authorizationWindowEndsAt, input.now)
                )
            )
            .limit(input.limit);
    }

    /** S2 persistence: activates only a still-pending row, returning false when another actor moved it. */
    async activatePendingAuthorization(
        input: PendingAuthorizationTransitionInput
    ): Promise<boolean> {
        const db = input.tx ?? getDb();
        const rows = await db
            .update(subscriptions)
            .set({ status: 'ACTIVE', updatedAt: input.now })
            .where(
                and(
                    eq(subscriptions.id, input.subscriptionId),
                    eq(subscriptions.status, 'PENDING_AUTHORIZATION')
                )
            )
            .returning({ id: subscriptions.id });
        return rows.length > 0;
    }

    /** S3 persistence: abandons only a pending row, closes its awaiting manual payment, and closes a deferred courtesy in the same transaction. */
    async abandonPendingAuthorization(
        input: PendingAuthorizationTransitionInput
    ): Promise<AbandonPendingAuthorizationResult> {
        const write = async (tx: DrizzleClient): Promise<AbandonPendingAuthorizationResult> => {
            const [row] = await tx
                .update(subscriptions)
                .set({ status: 'ABANDONED', updatedAt: input.now })
                .where(
                    and(
                        eq(subscriptions.id, input.subscriptionId),
                        eq(subscriptions.status, 'PENDING_AUTHORIZATION')
                    )
                )
                .returning({ paymentMethod: subscriptions.paymentMethod });
            if (!row) return { wrote: false, closedCourtesyMonths: null };
            if (row.paymentMethod === 'MANUAL') {
                await tx
                    .update(manualPayments)
                    .set({ status: 'DECLARED_UNPAID', updatedAt: input.now })
                    .where(
                        and(
                            eq(manualPayments.subscriptionId, input.subscriptionId),
                            eq(manualPayments.status, 'AWAITING')
                        )
                    );
            }
            // Close a deferred courtesy whose predecesora was this abandoned row.
            // S18 is the sole writer of `balance_months`; the grant points at the
            // predecesora (`subscription_id`), reached via `succeeded_by_id` on the
            // row that just left PENDING_AUTHORIZATION.
            const grantResult = await tx
                .update(courtesyGrants)
                .set({
                    balanceClosedAt: input.now,
                    closeReason:
                        'VENTANA_DE_AUTORIZACION_VENCIDA' satisfies (typeof COURTESY_CLOSE_REASONS)[number]
                })
                .where(
                    and(
                        isNotNull(courtesyGrants.balanceMonths),
                        isNull(courtesyGrants.balanceClosedAt),
                        inArray(
                            courtesyGrants.subscriptionId,
                            tx
                                .select({ id: subscriptions.id })
                                .from(subscriptions)
                                .where(eq(subscriptions.succeededById, input.subscriptionId))
                        )
                    )
                )
                .returning({ balanceMonths: courtesyGrants.balanceMonths });
            const totalMonths = grantResult.reduce((sum, g) => sum + (g.balanceMonths ?? 0), 0);
            return {
                wrote: true,
                closedCourtesyMonths: grantResult.length > 0 ? totalMonths : null
            };
        };
        return input.tx ? write(input.tx) : getDb().transaction(write);
    }

    /** Reads every declined row and its mandate id for S1's by-id re-read. */
    async findDeclinedWithProviderLinks(
        input: FindDeclinedInput
    ): Promise<DeclinedWithProviderLink[]> {
        const db = input.tx ?? getDb();
        return db
            .select({ subscription: subscriptions, providerLink: providerLinks })
            .from(subscriptions)
            .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
            .where(
                and(
                    eq(subscriptions.userId, input.userId),
                    eq(subscriptions.vertical, input.vertical),
                    eq(subscriptions.status, 'CHARGE_DECLINED')
                )
            );
    }

    /**
     * Reads the live principal commitment of a `user + vertical` — the row the
     * partial unique index `uq_subscription_commitment_origin` protects — with
     * its `PREAPPROVAL_CREATE` idempotency key and its provider link.
     *
     * The live statuses come from `LIVE_SUBSCRIPTION_STATUSES`, so
     * `PENDING_AUTHORIZATION` is included: the row that occupies the lock before
     * the provider call is the one S1 must find (AC:B3:6).
     */
    async findLiveCommitment(input: FindLiveCommitmentInput): Promise<LiveCommitment | null> {
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
            .where(
                and(
                    eq(subscriptions.userId, input.userId),
                    eq(subscriptions.vertical, input.vertical),
                    eq(subscriptions.class, 'PRINCIPAL'),
                    isNull(subscriptions.succeedsId),
                    inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES])
                )
            )
            .limit(1);
        return row ?? null;
    }

    /** Atomically records the mandate id and completes its idempotency key. */
    async recordAuthorizationResult(
        input: RecordAuthorizationResultInput
    ): Promise<SelectProviderLink> {
        const write = async (tx: DrizzleClient): Promise<SelectProviderLink> => {
            const [providerLink] = await tx
                .insert(providerLinks)
                .values({
                    subscriptionId: input.subscriptionId,
                    provider: input.provider,
                    providerId: input.providerId
                })
                .returning();
            if (!providerLink) throw new Error('Provider link insert returned no row');
            const completed = await tx
                .update(idempotencyKeys)
                .set({ result: input.result, completedAt: input.completedAt })
                .where(
                    and(
                        eq(idempotencyKeys.key, input.idempotencyKey),
                        eq(idempotencyKeys.operation, 'PREAPPROVAL_CREATE'),
                        eq(idempotencyKeys.subjectId, input.subscriptionId)
                    )
                )
                .returning({ key: idempotencyKeys.key });
            if (completed.length !== 1) throw new Error('Expected one matching idempotency key');
            return providerLink;
        };
        return input.tx ? write(input.tx) : getDb().transaction(write);
    }
}

export const subscriptionModel = new SubscriptionModel();
