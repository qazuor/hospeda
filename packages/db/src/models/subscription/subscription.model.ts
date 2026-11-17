import { randomUUID } from 'node:crypto';
import {
    and,
    desc,
    eq,
    gt,
    inArray,
    isNotNull,
    isNull,
    lt,
    lte,
    ne,
    notInArray,
    or,
    sql
} from 'drizzle-orm';
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
import { subscriptionScheduledChanges } from '../../schemas/vertical/scheduled-change.dbschema.ts';
import {
    LIVE_SUBSCRIPTION_STATUSES,
    type SelectSubscription,
    type SUBSCRIPTION_STATUSES,
    subscriptions
} from '../../schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { reconciliationInventoryModel } from '../reconciliation-inventory/reconciliation-inventory.model.ts';

/** Identity and immutable anchors for the new card subscription. */
export interface CreatePendingAuthorizationInput {
    readonly userId: string;
    readonly vertical: string;
    readonly planVersionId: string;
    readonly billingOptionId: string;
    readonly authorizationWindowDeadlineVersion: number;
    readonly authorizationWindowEndsAt: Date;
    readonly declaredPayerEmail?: string;
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
 * Statuses of a checkout that never produced a paying subscription: authorization
 * never completed, was abandoned, or the first charge was declined (S16,
 * record-charge-fact.service.ts). They do not count as subscription history.
 */
const NEVER_COMPLETED_CHECKOUT_STATUSES = [
    'PENDING_AUTHORIZATION',
    'ABANDONED',
    'CHARGE_DECLINED'
] as const satisfies readonly (typeof SUBSCRIPTION_STATUSES)[number][];

/** Input for checking whether a user has ever had a subscription in a vertical. */
export interface ExistsAnyForUserInput {
    readonly userId: string;
    readonly vertical: string;
    readonly tx?: DrizzleClient;
}

/** Input for copying the provider's next payment date onto an active subscription. */
export interface SyncNextChargeAtInput {
    readonly subscriptionId: string;
    readonly nextChargeAt: Date;
    readonly now: Date;
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
    /**
     * HOS-2223: the provider's next payment date from the re-read that authorized S2.
     * Written only forward (`GREATEST`), so it never undoes a later date P1 already wrote.
     * Omitted or null leaves the column untouched.
     */
    readonly nextChargeAt?: Date | null;
}

/** Input for S39/S40's conditional close of a pending card signup attempt. */
export interface AbandonReplacedPendingAuthorizationInput {
    readonly subscriptionId: string;
    readonly now: Date;
    readonly tx: DrizzleClient;
    readonly predecessorId?: string;
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

/** Input for conditionally recording a rejected preapproval creation. */
export interface RecordCreationRejectedInput {
    readonly idempotencyKey: string;
    readonly subscriptionId: string;
    readonly result: Record<string, unknown>;
    readonly completedAt: Date;
    readonly tx?: DrizzleClient;
}

/** Input for minting a replacement key after a provider-rejected creation. */
export interface MintKeyAfterRejectedCreationInput {
    readonly subscriptionId: string;
    readonly rejectedKey: string;
    readonly declaredPayerEmail?: string;
    readonly createdAt: Date;
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
    /**
     * Checks subscription history for a user and vertical, including lapsed and
     * superseded rows. Pending checkout, abandoned attempts, and a declined
     * first charge do not count as subscription history for new-user eligibility.
     */
    async existsAnyForUser(input: ExistsAnyForUserInput): Promise<boolean> {
        const db = input.tx ?? getDb();
        const [row] = await db
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(
                and(
                    eq(subscriptions.userId, input.userId),
                    eq(subscriptions.vertical, input.vertical),
                    notInArray(subscriptions.status, [...NEVER_COMPLETED_CHECKOUT_STATUSES])
                )
            )
            .limit(1);
        return row !== undefined;
    }

    /** Completes the exact creation key once, without creating a provider link. */
    async recordCreationRejected(input: RecordCreationRejectedInput): Promise<boolean> {
        const db = input.tx ?? getDb();
        const rows = await db
            .update(idempotencyKeys)
            .set({ result: input.result, completedAt: input.completedAt })
            .where(
                and(
                    eq(idempotencyKeys.key, input.idempotencyKey),
                    eq(idempotencyKeys.operation, 'PREAPPROVAL_CREATE'),
                    eq(idempotencyKeys.subjectId, input.subscriptionId),
                    isNull(idempotencyKeys.completedAt)
                )
            )
            .returning({ key: idempotencyKeys.key });
        return rows.length === 1;
    }

    /** Locks the rejected pending row and creates its next attempt key atomically. */
    async mintKeyAfterRejectedCreation(
        input: MintKeyAfterRejectedCreationInput
    ): Promise<{ readonly key: string } | null> {
        return getDb().transaction(async (tx) => {
            const locked = await reconciliationInventoryModel.lockSubscriptionForLink({
                subscriptionId: input.subscriptionId,
                tx
            });
            if (
                locked?.subscription.status !== 'PENDING_AUTHORIZATION' ||
                locked.providerLink !== null
            )
                return null;
            const [latest] = await tx
                .select({ key: idempotencyKeys.key, createdAt: idempotencyKeys.createdAt })
                .from(idempotencyKeys)
                .where(
                    and(
                        eq(idempotencyKeys.subjectId, input.subscriptionId),
                        eq(idempotencyKeys.operation, 'PREAPPROVAL_CREATE')
                    )
                )
                .orderBy(desc(idempotencyKeys.createdAt), desc(idempotencyKeys.key))
                .limit(1);
            if (latest?.key !== input.rejectedKey) return null;
            if (input.declaredPayerEmail !== undefined) {
                await tx
                    .update(subscriptions)
                    .set({ declaredPayerEmail: input.declaredPayerEmail })
                    .where(eq(subscriptions.id, input.subscriptionId));
            }
            const key = randomUUID();
            const createdAt =
                latest.createdAt && input.createdAt <= latest.createdAt
                    ? new Date(latest.createdAt.getTime() + 1)
                    : input.createdAt;
            await tx.insert(idempotencyKeys).values({
                key,
                operation: 'PREAPPROVAL_CREATE',
                subjectId: input.subscriptionId,
                createdAt
            });
            return { key };
        });
    }

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
                    declaredPayerEmail: input.declaredPayerEmail ?? null,
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

    /** S2 persistence: activates only a still-pending row, returning false when another actor moved it; copies the provider's next charge date forward when given (HOS-2223). */
    async activatePendingAuthorization(
        input: PendingAuthorizationTransitionInput
    ): Promise<boolean> {
        const db = input.tx ?? getDb();
        const rows = await db
            .update(subscriptions)
            .set({
                status: 'ACTIVE',
                updatedAt: input.now,
                ...(input.nextChargeAt
                    ? {
                          // GREATEST ignores NULL: a missing date takes the provider's.
                          nextChargeAt: sql`greatest(${subscriptions.nextChargeAt}, ${input.nextChargeAt.toISOString()}::timestamptz)`
                      }
                    : {})
            })
            .where(
                and(
                    eq(subscriptions.id, input.subscriptionId),
                    eq(subscriptions.status, 'PENDING_AUTHORIZATION')
                )
            )
            .returning({ id: subscriptions.id });
        return rows.length > 0;
    }

    /**
     * HOS-1685: the sweep's copy of the provider's next payment date; a conditional write that
     * never moves a row out of `ACTIVE` and never rewrites an equal value (B11.md:250).
     *
     * HOS-2223: it never writes a stale read either, meaning a provider date that is EARLIER
     * than the stored one AND already elapsed (`<= now`). Right after the first charge the
     * provider can still report the first-charge instant (PA-3), and copying it would undo the
     * date P1 advanced. A later date, or an earlier one still in the future (the provider
     * correcting its own anchor), keeps winning: the sweep still aligns the row with MP.
     *
     * HOS-2310: when the sweep writes, a not-yet-due migration-born queued change
     * (`plan_migration_subscription_id` set, `effective_at > now`) is realigned to the new
     * next charge date inside the same transaction, so it still applies at the new charge
     * instant. Elapsed changes and client-initiated changes stay untouched, and when the
     * write loses the race the queue is left exactly as it was.
     */
    async syncNextChargeAt(input: SyncNextChargeAtInput): Promise<boolean> {
        const write = async (db: DrizzleClient): Promise<boolean> => {
            const providerDateIsFuture = input.nextChargeAt.getTime() > input.now.getTime();
            const rows = await db
                .update(subscriptions)
                // Same shape as the other writers here; the global updated_at trigger
                // (extras/002) replaces the value with NOW() on every real write.
                .set({ nextChargeAt: input.nextChargeAt, updatedAt: input.now })
                .where(
                    and(
                        eq(subscriptions.id, input.subscriptionId),
                        eq(subscriptions.status, 'ACTIVE'),
                        or(
                            isNull(subscriptions.nextChargeAt),
                            providerDateIsFuture
                                ? ne(subscriptions.nextChargeAt, input.nextChargeAt)
                                : lt(subscriptions.nextChargeAt, input.nextChargeAt)
                        )
                    )
                )
                .returning({ id: subscriptions.id });
            if (rows.length === 0) return false;
            // Realignment only after the row actually moved: only migration-born changes
            // that are still ahead of `now` and currently anchored to another instant.
            await db
                .update(subscriptionScheduledChanges)
                .set({ effectiveAt: input.nextChargeAt })
                .where(
                    and(
                        eq(subscriptionScheduledChanges.subscriptionId, input.subscriptionId),
                        isNotNull(subscriptionScheduledChanges.planMigrationSubscriptionId),
                        gt(subscriptionScheduledChanges.effectiveAt, input.now),
                        ne(subscriptionScheduledChanges.effectiveAt, input.nextChargeAt)
                    )
                );
            return true;
        };
        return input.tx ? write(input.tx) : getDb().transaction(write);
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

    /**
     * S39 closes a replaced pending card signup; S40 closes one cancelled by
     * the person. S39 also replaces an unapplied successor of the just-admitted
     * predecessor (HOS-2218). Neither transition closes courtesy balances or installments.
     */
    async abandonReplacedPendingAuthorization(
        input: AbandonReplacedPendingAuthorizationInput
    ): Promise<{ wrote: boolean }> {
        const rows = await input.tx
            .update(subscriptions)
            .set({ status: 'ABANDONED', updatedAt: input.now })
            .where(
                and(
                    eq(subscriptions.id, input.subscriptionId),
                    eq(subscriptions.status, 'PENDING_AUTHORIZATION'),
                    eq(subscriptions.class, 'PRINCIPAL'),
                    input.predecessorId === undefined
                        ? isNull(subscriptions.succeedsId)
                        : eq(subscriptions.succeedsId, input.predecessorId)
                )
            )
            .returning({ id: subscriptions.id });
        return { wrote: rows.length > 0 };
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
     * When the creation sweep mints another key for this row, the newest key
     * decides which attempt is reused.
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
            // The key tie-break matches `CreationSweepModel.completeNewestCreateKey`, so the
            // key the creation sweep completes is the one this read returns (HOS-1725).
            .orderBy(desc(idempotencyKeys.createdAt), desc(idempotencyKeys.key))
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
