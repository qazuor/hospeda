import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    reconciliationMarks,
    type SelectReconciliationMark
} from '../../schemas/vertical/reconciliation-mark.dbschema.ts';
import { reconciliationMarkPayments } from '../../schemas/vertical/reconciliation-mark-payment.dbschema.ts';
import type { ReconciliationMarkReason } from '../../schemas/vertical/reconciliation-mark-reasons.ts';
import type { DrizzleClient } from '../../types.ts';

/** Exactly one subject for a reconciliation mark (B3.md AC:B3:16). */
export type ReconciliationMarkSubject =
    | { readonly kind: 'SUBSCRIPTION'; readonly subscriptionId: string }
    | { readonly kind: 'ADDON_INSTANCE'; readonly addonInstanceId: string };

/** Input to open a reason on one subject (B3.md AC:B3:13). */
export interface InsertOpenReconciliationMarkInput {
    readonly subject: ReconciliationMarkSubject;
    readonly reason: ReconciliationMarkReason;
    readonly placedAt?: Date;
    readonly tx?: DrizzleClient;
}

/** Input to find an open mark by subject and reason (B3.md AC:B3:13). */
export interface FindOpenReconciliationMarkInput {
    readonly subject: ReconciliationMarkSubject;
    readonly reason: ReconciliationMarkReason;
    readonly tx?: DrizzleClient;
}

/** Input to list open marks for a subject (B3.md AC:B3:15). */
export interface ListOpenReconciliationMarkInput {
    readonly subject: ReconciliationMarkSubject;
    readonly tx?: DrizzleClient;
}

/** Input to find or bump one mark by id (B3.md AC:B3:13–15). */
export interface ReconciliationMarkIdInput {
    readonly markId: string;
    readonly tx?: DrizzleClient;
}

/** Input to ask whether a payment ever hung on a mark of one reason (HOS-1605 H6). */
export interface HasPaymentHungOnReasonInput {
    readonly subscriptionId: string;
    readonly paymentId: string;
    readonly reason: ReconciliationMarkReason;
    readonly tx?: DrizzleClient;
}

/** Optimistic lift of exactly one mark (B3.md AC:B3:15). */
export interface LiftReconciliationMarkInput extends ReconciliationMarkIdInput {
    readonly expectedVersion: number;
    readonly liftedBy: string;
    readonly now: Date;
}

/** Outcome of one optimistic lift (B3.md AC:B3:15). */
export type LiftReconciliationMarkResult =
    | { readonly outcome: 'LIFTED'; readonly mark: SelectReconciliationMark }
    | { readonly outcome: 'VERSION_CONFLICT' }
    | { readonly outcome: 'NOT_OPEN' };

/** Minimal persistence model for marks, without BaseModelImpl (B3.md AC:B3:13–16). */
export class ReconciliationMarkModel {
    /** Inserts one open mark; leaves FK and unique errors to the service. */
    async insertOpen(input: InsertOpenReconciliationMarkInput): Promise<SelectReconciliationMark> {
        const db = input.tx ?? getDb();
        const [mark] = await db
            .insert(reconciliationMarks)
            .values({
                reason: input.reason,
                ...(input.subject.kind === 'SUBSCRIPTION'
                    ? { subscriptionId: input.subject.subscriptionId }
                    : { addonInstanceId: input.subject.addonInstanceId }),
                ...(input.placedAt === undefined ? {} : { placedAt: input.placedAt })
            })
            .returning();
        if (!mark) throw new Error('Reconciliation mark insert returned no row');
        return mark;
    }

    /** Reads one mark, including a lifted mark, or null. */
    async findById(input: ReconciliationMarkIdInput): Promise<SelectReconciliationMark | null> {
        const db = input.tx ?? getDb();
        const [mark] = await db
            .select()
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.id, input.markId))
            .limit(1);
        return mark ?? null;
    }

    /** Reads the open mark for one subject and reason, or null. */
    async findOpen(
        input: FindOpenReconciliationMarkInput
    ): Promise<SelectReconciliationMark | null> {
        const db = input.tx ?? getDb();
        const [mark] = await db
            .select()
            .from(reconciliationMarks)
            .where(
                and(
                    input.subject.kind === 'SUBSCRIPTION'
                        ? eq(reconciliationMarks.subscriptionId, input.subject.subscriptionId)
                        : eq(reconciliationMarks.addonInstanceId, input.subject.addonInstanceId),
                    eq(reconciliationMarks.reason, input.reason),
                    isNull(reconciliationMarks.liftedAt)
                )
            )
            .limit(1);
        return mark ?? null;
    }

    /** Lists all open marks for one subject, oldest first. */
    async listOpen(input: ListOpenReconciliationMarkInput): Promise<SelectReconciliationMark[]> {
        const db = input.tx ?? getDb();
        return db
            .select()
            .from(reconciliationMarks)
            .where(
                and(
                    input.subject.kind === 'SUBSCRIPTION'
                        ? eq(reconciliationMarks.subscriptionId, input.subject.subscriptionId)
                        : eq(reconciliationMarks.addonInstanceId, input.subject.addonInstanceId),
                    isNull(reconciliationMarks.liftedAt)
                )
            )
            .orderBy(asc(reconciliationMarks.placedAt), asc(reconciliationMarks.id));
    }

    /** Bumps only an open mark when S14 attaches a payment (B3.md AC:B3:13). */
    async bumpOpenVersion(input: ReconciliationMarkIdInput): Promise<boolean> {
        const db = input.tx ?? getDb();
        const rows = await db
            .update(reconciliationMarks)
            .set({ version: sql`${reconciliationMarks.version} + 1` })
            .where(
                and(eq(reconciliationMarks.id, input.markId), isNull(reconciliationMarks.liftedAt))
            )
            .returning({ id: reconciliationMarks.id });
        return rows.length === 1;
    }

    /**
     * Whether this payment ever hung on a mark of this reason on this
     * subscription, OPEN OR LIFTED. It deliberately does not filter `lifted_at`
     * (HOS-1605 H6): a payment that already had its reason-17 mark does not
     * reopen it every day once a person lifted it.
     */
    async hasPaymentHungOnReason(input: HasPaymentHungOnReasonInput): Promise<boolean> {
        const db = input.tx ?? getDb();
        const [row] = await db
            .select({ id: reconciliationMarkPayments.id })
            .from(reconciliationMarkPayments)
            .innerJoin(
                reconciliationMarks,
                eq(reconciliationMarks.id, reconciliationMarkPayments.markId)
            )
            .where(
                and(
                    eq(reconciliationMarkPayments.paymentId, input.paymentId),
                    eq(reconciliationMarks.subscriptionId, input.subscriptionId),
                    eq(reconciliationMarks.reason, input.reason)
                )
            )
            .limit(1);
        return row !== undefined;
    }

    /** Lifts one open mark at the expected version; a read distinguishes stale from closed. */
    async lift(input: LiftReconciliationMarkInput): Promise<LiftReconciliationMarkResult> {
        const db = input.tx ?? getDb();
        const [mark] = await db
            .update(reconciliationMarks)
            .set({
                liftedAt: input.now,
                liftedBy: input.liftedBy,
                version: sql`${reconciliationMarks.version} + 1`
            })
            .where(
                and(
                    eq(reconciliationMarks.id, input.markId),
                    isNull(reconciliationMarks.liftedAt),
                    eq(reconciliationMarks.version, input.expectedVersion)
                )
            )
            .returning();
        if (mark) return { outcome: 'LIFTED', mark };
        const existing = await this.findById({ markId: input.markId, tx: db });
        return existing?.liftedAt === null
            ? { outcome: 'VERSION_CONFLICT' }
            : { outcome: 'NOT_OPEN' };
    }
}

/** Shared reconciliation mark persistence model. */
export const reconciliationMarkModel = new ReconciliationMarkModel();
