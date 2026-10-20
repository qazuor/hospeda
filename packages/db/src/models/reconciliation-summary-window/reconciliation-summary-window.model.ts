import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    reconciliationSummaryWindows,
    type SelectReconciliationSummaryWindow
} from '../../schemas/vertical/reconciliation-summary-window.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Fields captured when a reconciliation summary window opens. */
export interface OpenReconciliationSummaryWindowInput {
    readonly coversFrom: Date;
    readonly openedAt: Date;
    readonly closesAt: Date;
    readonly windowMinutes: number;
    readonly deadlinesVersion: number;
    readonly tx?: DrizzleClient;
}

/** One-time mark sent input. */
export interface MarkReconciliationSummaryWindowSentInput {
    readonly id: string;
    readonly sentAt: Date;
    readonly eventCount: number;
    readonly tx?: DrizzleClient;
}

/** Persistence operations for the append-only window's lifecycle. */
export class ReconciliationSummaryWindowModel {
    /** Returns the newest unsent window, if one exists. */
    async findOpen(
        input: { readonly tx?: DrizzleClient } = {}
    ): Promise<SelectReconciliationSummaryWindow | null> {
        const [row] = await (input.tx ?? getDb())
            .select()
            .from(reconciliationSummaryWindows)
            .where(isNull(reconciliationSummaryWindows.sentAt))
            .orderBy(desc(reconciliationSummaryWindows.coversFrom))
            .limit(1);
        return row ?? null;
    }

    /** Returns the newest window regardless of delivery state. */
    async findLatest(
        input: { readonly tx?: DrizzleClient } = {}
    ): Promise<SelectReconciliationSummaryWindow | null> {
        const [row] = await (input.tx ?? getDb())
            .select()
            .from(reconciliationSummaryWindows)
            .orderBy(desc(reconciliationSummaryWindows.coversFrom))
            .limit(1);
        return row ?? null;
    }

    /** Opens a unique window boundary; a concurrent winner produces null. */
    async open(
        input: OpenReconciliationSummaryWindowInput
    ): Promise<SelectReconciliationSummaryWindow | null> {
        const [row] = await (input.tx ?? getDb())
            .insert(reconciliationSummaryWindows)
            .values({
                coversFrom: input.coversFrom,
                openedAt: input.openedAt,
                closesAt: input.closesAt,
                windowMinutes: input.windowMinutes,
                deadlinesVersion: input.deadlinesVersion
            })
            .onConflictDoNothing({ target: reconciliationSummaryWindows.coversFrom })
            .returning();
        return row ?? null;
    }

    /** Marks a window sent once; returns false after another caller sent it. */
    async markSent(input: MarkReconciliationSummaryWindowSentInput): Promise<boolean> {
        const [row] = await (input.tx ?? getDb())
            .update(reconciliationSummaryWindows)
            .set({ sentAt: input.sentAt, eventCount: input.eventCount })
            .where(
                and(
                    eq(reconciliationSummaryWindows.id, input.id),
                    isNull(reconciliationSummaryWindows.sentAt)
                )
            )
            .returning({ id: reconciliationSummaryWindows.id });
        return row !== undefined;
    }
}

/** Shared reconciliation summary window model. */
export const reconciliationSummaryWindowModel = new ReconciliationSummaryWindowModel();
