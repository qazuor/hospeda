import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    type ProviderWatchAccount,
    type ProviderWatchOutcome,
    providerWatchRuns,
    providerWatchShapeBaselines,
    type SelectProviderWatchRun,
    type SelectProviderWatchShapeBaseline
} from '../../schemas/vertical/provider-watch-run.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { platformSettingsModel } from '../platform/platform-settings.model.ts';

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function unionOf(...lists: readonly unknown[]): unknown[] {
    return [...new Set(lists.flatMap((list) => (Array.isArray(list) ? list : [])))];
}

/**
 * Merges the measurements stored while the run was running with the ones it closes with. The
 * closing record wins on every field, except that the `writeKeys` (and the `providerIds`) recorded
 * apart are kept: they are never erased by a record that did not carry them.
 */
function mergeMeasurements(args: {
    readonly stored: unknown;
    readonly closing: Record<string, unknown>;
}): Record<string, unknown> {
    const stored = asRecord(args.stored);
    const merged: Record<string, unknown> = { ...stored };
    for (const [id, closing] of Object.entries(args.closing)) {
        const before = asRecord(stored[id]);
        const after = asRecord(closing);
        const writeKeys = unionOf(before['writeKeys'], after['writeKeys']);
        const providerIds = unionOf(before['providerIds'], after['providerIds']);
        merged[id] = {
            ...before,
            ...after,
            ...(writeKeys.length > 0 ? { writeKeys } : {}),
            ...(providerIds.length > 0 ? { providerIds } : {})
        };
    }
    return merged;
}

/** Persistence of the provider watch battery's runs and accepted baselines (HOS-1512). */
export class ProviderWatchRunModel {
    /**
     * Opens a run: the row starts as `running`. When `consumeAuthorizationOfMonth` is set (a
     * production run) the owner's authorization is consumed in the SAME transaction, by a
     * conditional update, so two runs cannot both consume it.
     *
     * @param input.account - The account the run targets
     * @param input.startedAt - The run's instant
     * @param input.consumeAuthorization - Consume the authorization with exactly these values for this run
     * @param input.abandonRunsStartedBefore - In the same transaction, every `running` row of this
     *   account that started before this instant is past its deadline: it is closed as `failed`
     *   with reason `abandoned`. Its measurements are left untouched, so the provider ids it
     *   already recorded stay findable.
     * @param input.tx - Optional enclosing transaction
     * @returns The run id and whether the authorization was consumed by THIS run. When it was
     *   wanted and lost, the row is still written (as `running`, for the caller to close as refused).
     */
    async open(input: {
        readonly account: ProviderWatchAccount;
        readonly startedAt: Date;
        readonly consumeAuthorization?: {
            readonly month: string;
            readonly maxChargeMinor: number;
            readonly accountId: string;
        };
        readonly abandonRunsStartedBefore?: Date;
        readonly tx?: DrizzleClient;
    }): Promise<{ readonly runId: string; readonly authorizationConsumed: boolean }> {
        const work = async (tx: DrizzleClient) => {
            if (input.abandonRunsStartedBefore !== undefined) {
                await tx
                    .update(providerWatchRuns)
                    .set({
                        outcome: 'failed',
                        reason: 'abandoned',
                        finishedAt: input.startedAt
                    })
                    .where(
                        and(
                            eq(providerWatchRuns.account, input.account),
                            eq(providerWatchRuns.outcome, 'running'),
                            lt(providerWatchRuns.startedAt, input.abandonRunsStartedBefore)
                        )
                    );
            }
            const [row] = await tx
                .insert(providerWatchRuns)
                .values({
                    account: input.account,
                    startedAt: input.startedAt,
                    outcome: 'running'
                })
                .returning({ id: providerWatchRuns.id });
            if (!row) throw new Error('provider_watch_run insert returned no row');
            if (input.consumeAuthorization === undefined) {
                return { runId: row.id, authorizationConsumed: false };
            }
            const { consumed } = await platformSettingsModel.consumeProviderWatchAuthorization({
                ...input.consumeAuthorization,
                runId: row.id,
                consumedAt: input.startedAt,
                tx
            });
            return { runId: row.id, authorizationConsumed: consumed };
        };
        return input.tx ? work(input.tx) : getDb().transaction((tx) => work(tx as DrizzleClient));
    }

    /**
     * Appends what a write left behind to one measurement of a still-`running` run, in statements of
     * their own: the provider ids a write answered (`providerIds`) and the idempotency keys of
     * writes about to be sent (`writeKeys`, recorded BEFORE the request leaves). It runs apart from
     * the transaction that later closes the run, so both survive a run that dies or whose closing
     * fails: a human needs them to cancel or refund what the run created.
     *
     * @param input.runId - The run
     * @param input.measurementId - The measurement
     * @param input.providerIds - Ids the provider answered
     * @param input.writeKeys - Keys (also the objects' `external_reference`) of writes sent
     * @param input.ledger - The money ledger as it stands, set in the same statement
     * @param input.tx - Only for tests; production calls it with none, as its own statements
     * @throws When no running run has that id
     */
    async appendProgress(input: {
        readonly runId: string;
        readonly measurementId: string;
        readonly providerIds?: readonly string[];
        readonly writeKeys?: readonly string[];
        readonly ledger?: { readonly charged: number; readonly refunded: number };
        readonly tx?: DrizzleClient;
    }): Promise<void> {
        const measurement = input.measurementId;
        const fields = [
            ['providerIds', input.providerIds ?? []],
            ['writeKeys', input.writeKeys ?? []]
        ] as const;
        // ONE statement: the ids, the keys and the ledger land together or not at all, so a crash
        // after money moved never leaves a ledger that lags behind its keys.
        let measurements = sql`${providerWatchRuns.measurements} || jsonb_build_object(${measurement}::text, COALESCE(${providerWatchRuns.measurements} -> ${measurement}, '{}'::jsonb))`;
        let touchesMeasurements = false;
        for (const [field, values] of fields) {
            if (values.length === 0) continue;
            touchesMeasurements = true;
            const added = JSON.stringify(values);
            measurements = sql`jsonb_set(
                ${measurements},
                ARRAY[${measurement}::text, ${field}::text],
                COALESCE(${providerWatchRuns.measurements} -> ${measurement} -> ${field}, '[]'::jsonb) || ${added}::jsonb,
                true
            )`;
        }
        if (!touchesMeasurements && input.ledger === undefined) return;
        const rows = await (input.tx ?? getDb())
            .update(providerWatchRuns)
            .set({
                ...(touchesMeasurements ? { measurements } : {}),
                ...(input.ledger === undefined ? {} : { ledger: input.ledger })
            })
            .where(
                and(eq(providerWatchRuns.id, input.runId), eq(providerWatchRuns.outcome, 'running'))
            )
            .returning({ id: providerWatchRuns.id });
        if (rows.length !== 1) {
            throw new Error(`provider_watch_run ${input.runId} is not a running run`);
        }
    }

    /**
     * Closes a run with how it ended.
     *
     * @param input.id - The run id
     * @param input.finishedAt - When it ended
     * @param input.outcome - How it ended
     * @param input.reason - Why it did not complete
     * @param input.measurements - Per measurement: outcome, values, shapes and provider ids
     * @param input.ledger - Money the run moved: charges and refunds, kept apart
     * @param input.alerts - Each alert with the channel it went out on
     * @param input.tx - Optional transaction, so the closing and its alert mail commit together
     * @throws When no open run has that id
     */
    async close(input: {
        readonly id: string;
        readonly finishedAt: Date;
        readonly outcome: Exclude<ProviderWatchOutcome, 'running'>;
        readonly reason: string | null;
        readonly measurements: Record<string, unknown>;
        readonly ledger: { readonly charged: number; readonly refunded: number };
        readonly alerts: unknown[];
        readonly tx?: DrizzleClient;
    }): Promise<SelectProviderWatchRun> {
        const work = async (executor: DrizzleClient): Promise<SelectProviderWatchRun> => {
            // The in-memory record carries no write keys: they were persisted before each send and
            // are the only way to find an object whose answer was lost. Merge, never overwrite.
            // FOR UPDATE: the read and the update are one atomic step, so a progress write cannot
            // land between them and be overwritten by a merge of a stale copy.
            const [stored] = await executor
                .select({ measurements: providerWatchRuns.measurements })
                .from(providerWatchRuns)
                .where(
                    and(
                        eq(providerWatchRuns.id, input.id),
                        eq(providerWatchRuns.outcome, 'running')
                    )
                )
                .limit(1)
                .for('update');
            const [row] = await executor
                .update(providerWatchRuns)
                .set({
                    finishedAt: input.finishedAt,
                    outcome: input.outcome,
                    reason: input.reason,
                    measurements: mergeMeasurements({
                        stored: stored?.measurements,
                        closing: input.measurements
                    }),
                    ledger: input.ledger,
                    alerts: input.alerts
                })
                .where(
                    and(
                        eq(providerWatchRuns.id, input.id),
                        eq(providerWatchRuns.outcome, 'running')
                    )
                )
                .returning();
            if (!row) throw new Error(`provider_watch_run ${input.id} is not an open run`);
            return row;
        };
        return input.tx ? work(input.tx) : getDb().transaction((tx) => work(tx as DrizzleClient));
    }

    /**
     * Finds a run by id.
     *
     * @param input.id - The run id
     * @param input.tx - Optional transaction
     * @returns The row, or `null`
     */
    async findById(input: {
        readonly id: string;
        readonly tx?: DrizzleClient;
    }): Promise<SelectProviderWatchRun | null> {
        const [row] = await (input.tx ?? getDb())
            .select()
            .from(providerWatchRuns)
            .where(eq(providerWatchRuns.id, input.id))
            .limit(1);
        return row ?? null;
    }

    /**
     * The run that recorded a provider id, if any (HOS-1512, owner decision on the webhook noise):
     * the webhook drops the notice of an authorization the battery created, and only of one it
     * RECORDED. The ids are the `providerIds` a run persists per measurement, as each write
     * answers (`appendProgress`) and when it closes, so a run that died midway still counts.
     *
     * @param input.providerId - The provider id the notice names
     * @param input.tx - Optional transaction
     * @returns The run id, or `null` when no run recorded it
     */
    async findRunRecordingProviderId(input: {
        readonly providerId: string;
        readonly tx?: DrizzleClient;
    }): Promise<{ readonly runId: string } | null> {
        const [row] = await (input.tx ?? getDb())
            .select({ runId: providerWatchRuns.id })
            .from(providerWatchRuns)
            .where(
                sql`jsonb_path_exists(${providerWatchRuns.measurements}, '$.*.providerIds[*] ? (@ == $id)', jsonb_build_object('id', ${input.providerId}::text))`
            )
            .orderBy(desc(providerWatchRuns.startedAt))
            .limit(1);
        return row ?? null;
    }

    /**
     * The latest run of an account that completed: what the owner reviews and may accept.
     *
     * @param input.account - The account the run targeted
     * @param input.tx - Optional transaction
     * @returns The row, or `null` when the account has no completed run yet
     */
    async findLatestCompleted(input: {
        readonly account: ProviderWatchAccount;
        readonly tx?: DrizzleClient;
    }): Promise<SelectProviderWatchRun | null> {
        const [row] = await (input.tx ?? getDb())
            .select()
            .from(providerWatchRuns)
            .where(
                and(
                    eq(providerWatchRuns.account, input.account),
                    eq(providerWatchRuns.outcome, 'completed')
                )
            )
            .orderBy(desc(providerWatchRuns.finishedAt))
            .limit(1);
        return row ?? null;
    }

    /**
     * The shapes the owner accepted for an account.
     *
     * @param input.account - The account
     * @param input.tx - Optional transaction
     * @returns One row per accepted measurement
     */
    async listBaselines(input: {
        readonly account: ProviderWatchAccount;
        readonly tx?: DrizzleClient;
    }): Promise<readonly SelectProviderWatchShapeBaseline[]> {
        return (input.tx ?? getDb())
            .select()
            .from(providerWatchShapeBaselines)
            .where(eq(providerWatchShapeBaselines.account, input.account));
    }

    /**
     * Records that the owner accepted the shapes a run observed for one measurement. This is the
     * ONLY way a baseline advances.
     *
     * @param input.account - The account
     * @param input.measurementId - The measurement
     * @param input.shapes - The shapes accepted, as the run recorded them
     * @param input.sourceRunId - The run that observed them
     * @param input.acceptedBy - The user accepting
     * @param input.tx - Optional transaction
     * @returns The stored baseline
     */
    async acceptBaseline(input: {
        readonly account: ProviderWatchAccount;
        readonly measurementId: string;
        readonly shapes: Record<string, Record<string, string>>;
        readonly sourceRunId: string;
        readonly acceptedBy: string;
        readonly tx?: DrizzleClient;
    }): Promise<SelectProviderWatchShapeBaseline> {
        const [row] = await (input.tx ?? getDb())
            .insert(providerWatchShapeBaselines)
            .values({
                account: input.account,
                measurementId: input.measurementId,
                shapes: input.shapes,
                sourceRunId: input.sourceRunId,
                acceptedBy: input.acceptedBy
            })
            .onConflictDoUpdate({
                target: [
                    providerWatchShapeBaselines.account,
                    providerWatchShapeBaselines.measurementId
                ],
                set: {
                    shapes: input.shapes,
                    sourceRunId: input.sourceRunId,
                    acceptedBy: input.acceptedBy,
                    acceptedAt: sql`now()`
                }
            })
            .returning();
        if (!row) throw new Error('provider_watch_shape_baseline upsert returned no row');
        return row;
    }
}

/** Shared instance. */
export const providerWatchRunModel = new ProviderWatchRunModel();
