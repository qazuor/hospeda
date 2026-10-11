import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    reconciliationSweepRuns,
    type SelectReconciliationSweepRun
} from '../../schemas/vertical/reconciliation-sweep-run.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Input for opening one sweep run. */
export interface OpenReconciliationSweepRunInput {
    readonly correlationId: string;
    readonly startedAt: Date;
    readonly tx?: DrizzleClient;
}

/** Input for closing one still-open sweep run. */
export interface CloseReconciliationSweepRunInput {
    readonly id: string;
    readonly finishedAt: Date;
    readonly rowsRead: number;
    readonly rowsFailed: number;
    readonly tx?: DrizzleClient;
}

/** Input for finding a sweep run by identity. */
export interface FindReconciliationSweepRunInput {
    readonly id: string;
    readonly tx?: DrizzleClient;
}

/** Read-only registry of sweep run boundaries and outcomes. */
export class ReconciliationSweepRunModel {
    /** Inserts and returns an open run; the caller supplies the injected-clock instant. */
    async open(input: OpenReconciliationSweepRunInput): Promise<SelectReconciliationSweepRun> {
        const db = input.tx ?? getDb();
        const [row] = await db
            .insert(reconciliationSweepRuns)
            .values({ correlationId: input.correlationId, startedAt: input.startedAt })
            .returning();
        if (!row) throw new Error('Reconciliation sweep run insert returned no row');
        return row;
    }

    /** Closes only an open run and returns null if it is already closed or missing. */
    async close(
        input: CloseReconciliationSweepRunInput
    ): Promise<SelectReconciliationSweepRun | null> {
        const db = input.tx ?? getDb();
        const [row] = await db
            .update(reconciliationSweepRuns)
            .set({
                finishedAt: input.finishedAt,
                rowsRead: input.rowsRead,
                rowsFailed: input.rowsFailed
            })
            .where(
                and(
                    eq(reconciliationSweepRuns.id, input.id),
                    isNull(reconciliationSweepRuns.finishedAt)
                )
            )
            .returning();
        return row ?? null;
    }

    /** Finds one run by id, or null when it does not exist. */
    async findById(
        input: FindReconciliationSweepRunInput
    ): Promise<SelectReconciliationSweepRun | null> {
        const db = input.tx ?? getDb();
        const [row] = await db
            .select()
            .from(reconciliationSweepRuns)
            .where(eq(reconciliationSweepRuns.id, input.id))
            .limit(1);
        return row ?? null;
    }
}

/**
 * «una corrida es completa si tiene fin y ninguna fila fallida» (B11.md:1142-1188).
 * @param input.finishedAt - The recorded end instant, or null while open.
 * @param input.rowsFailed - Number of failed inventory rows.
 * @returns Whether the run completed every row without failure.
 */
export function isReconciliationSweepRunComplete(input: {
    readonly finishedAt: Date | null;
    readonly rowsFailed: number;
}): boolean {
    return input.finishedAt !== null && input.rowsFailed === 0;
}

/** Shared reconciliation sweep run persistence model. */
export const reconciliationSweepRunModel = new ReconciliationSweepRunModel();
