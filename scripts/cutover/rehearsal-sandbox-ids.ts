import type { ReadOnlyClient } from './known-ids.ts';
import { readKnownIds, selectKnownIds } from './known-ids.ts';
import type { RehearsalSandboxApi } from './rehearsal-sandbox-api.ts';
import type { KnownIds, ObjectKind } from './types.ts';
import type { ManifestWriter } from './write-manifest.ts';

/** Marks this manifest apart from the U3 cutover manifest and the staging sandbox one. */
export const SANDBOX_IDS_MANIFEST_KIND = 'rehearsal-sandbox-ids';

/**
 * Every OLD-schema column that holds a provider id, by family. The `primary` ones are exactly the
 * columns `known-ids.ts` reads, so after the rewrite the U3 run cross-checks sandbox ids only. The
 * `follower` ones hold the same ids and are rewritten only where their value is a mapped id, so the
 * old image running on staging does not poll the sandbox with production ids:
 * `billing_subscription_polling_jobs.provider_resource_id` (a preapproval) and
 * `billing_prices.mp_price_id` (a plan, written by the prices adapter).
 */
export const ID_COLUMNS: readonly {
    readonly table: string;
    readonly column: string;
    readonly kind: ObjectKind;
    readonly role: 'primary' | 'follower';
}[] = [
    {
        table: 'billing_subscriptions',
        column: 'mp_subscription_id',
        kind: 'preapproval',
        role: 'primary'
    },
    {
        table: 'billing_addon_purchases',
        column: 'mp_subscription_id',
        kind: 'preapproval',
        role: 'primary'
    },
    {
        table: 'billing_plan_price_change_targets',
        column: 'mp_subscription_id',
        kind: 'preapproval',
        role: 'primary'
    },
    {
        table: 'billing_subscription_polling_jobs',
        column: 'provider_resource_id',
        kind: 'preapproval',
        role: 'follower'
    },
    { table: 'billing_mp_plans', column: 'mp_preapproval_plan_id', kind: 'plan', role: 'primary' },
    {
        table: 'billing_mp_addon_plans',
        column: 'mp_preapproval_plan_id',
        kind: 'plan',
        role: 'primary'
    },
    {
        table: 'billing_pending_checkouts',
        column: 'mp_preapproval_plan_id',
        kind: 'plan',
        role: 'primary'
    },
    { table: 'billing_prices', column: 'mp_price_id', kind: 'plan', role: 'follower' }
];

/** One production id and the sandbox id that replaces it in the copy. Ids only. */
export interface IdMapping {
    readonly kind: ObjectKind;
    readonly prodId: string;
    readonly sandboxId: string;
}

/** Failure codes. Any of them stops the run; the database is written only when there is none. */
export type SandboxIdsFailureCode =
    | 'PROVIDER_ERROR'
    | 'CREATE_FAILED'
    | 'MIRROR_NOT_READABLE'
    | 'COPY_DB_ERROR'
    | 'REWRITE_INCOMPLETE';

/** One failure. `detail` is fixed text plus ids: never an email or a provider payload. */
export interface SandboxIdsFailure {
    readonly code: SandboxIdsFailureCode;
    readonly id?: string;
    readonly detail: string;
}

/**
 * The run manifest: ids and counts only. Production provider ids are not personal data; no email,
 * name or provider payload is ever written here.
 */
export interface SandboxIdsManifest {
    readonly kind: typeof SANDBOX_IDS_MANIFEST_KIND;
    readonly schemaVersion: 1;
    readonly mode: 'dry-run' | 'confirm';
    readonly outcome: 'in-progress' | 'ok' | 'failed' | 'dry-run';
    readonly startedAt: string;
    readonly finishedAt: string;
    /** How many distinct ids the copy holds, per family, before the run. */
    readonly knownIds: { readonly plans: number; readonly preapprovals: number };
    /** Ids already readable with the sandbox token: left as they are (a re-run finds only these). */
    readonly alreadySandboxIds: readonly string[];
    /** Ids the sandbox answers 404 for: the ones a confirmed run mirrors. */
    readonly toMirrorIds: readonly string[];
    /** Production id to sandbox id, written as each mirror is created and re-read. */
    readonly mappings: readonly IdMapping[];
    /** Rows rewritten per `table.column` (empty until the rewrite commits). */
    readonly rewrittenRows: Readonly<Record<string, number>>;
    readonly failures: readonly SandboxIdsFailure[];
}

/** Input of {@link runSandboxIdRewrite}. */
export interface RunSandboxIdRewriteInput {
    readonly mode: 'dry-run' | 'confirm';
    /** A WRITABLE session already proven to be staging's database. */
    readonly client: ReadOnlyClient;
    readonly api: RehearsalSandboxApi;
    /** Payer email of the sandbox mirrors. Required by `confirm`; never written or printed. */
    readonly payerEmail?: string;
    readonly writer: ManifestWriter<SandboxIdsManifest>;
    readonly now?: () => Date;
}

/** Idempotency key of one mirror: a re-run after a failed rewrite gets the SAME object back. */
function mirrorKey({
    kind,
    prodId
}: {
    readonly kind: ObjectKind;
    readonly prodId: string;
}): string {
    return `hospeda-rehearsal-${kind}-${prodId}`;
}

function errorName(error: unknown): string {
    return error instanceof Error ? error.name : 'unknown';
}

/** The one UPDATE per column: maps old to new through two parallel arrays, counts the rows. */
function rewriteSql({
    table,
    column
}: {
    readonly table: string;
    readonly column: string;
}): string {
    return `WITH u AS (
        UPDATE "${table}" AS t SET "${column}" = m.new_id
        FROM unnest($1::text[], $2::text[]) AS m(old_id, new_id)
        WHERE t."${column}" = m.old_id
        RETURNING 1
    ) SELECT count(*)::int AS n FROM u`;
}

/**
 * Prepares the rehearsal copy for the U3 run (HOS-1957, owner decision 1). The copy of production
 * holds production provider ids, which the sandbox walk never returns, so step 2 would fail with
 * `KNOWN_ID_MISSING` by construction. This run:
 *
 * 1. reads the ids U3 cross-checks (`readKnownIds`, the same queries);
 * 2. reads each one BY ID with the sandbox token: `found` is left alone (it is already a sandbox
 *    id, which makes a re-run a no-op), `not-found` is to mirror, anything else stops the run;
 * 3. on `confirm` only: creates one sandbox mirror per id (plans active; preapprovals `pending`
 *    and bound to no plan), re-reads each by id, then rewrites every id column in ONE transaction
 *    and, inside it, re-reads the known ids: any id that is neither a mirror nor an already-sandbox
 *    id rolls the whole rewrite back.
 *
 * Nothing is created and nothing is written on `dry-run`. The manifest is checkpointed after every
 * mirror, so the ids of an interrupted run are on disk (the mirrors are sandbox objects: the U3 run
 * of the rehearsal cancels them like any other).
 *
 * @param input - mode, guarded client, sandbox calls and the manifest writer
 * @returns the finished manifest
 */
export async function runSandboxIdRewrite(
    input: RunSandboxIdRewriteInput
): Promise<SandboxIdsManifest> {
    const now = input.now ?? (() => new Date());
    const startedAt = now().toISOString();
    const alreadySandboxIds: string[] = [];
    const toMirror: { kind: ObjectKind; prodId: string }[] = [];
    const mappings: IdMapping[] = [];
    const failures: SandboxIdsFailure[] = [];
    let rewrittenRows: Record<string, number> = {};
    let known: KnownIds = { planIds: [], preapprovalIds: [] };

    const snapshot = (outcome: SandboxIdsManifest['outcome']): SandboxIdsManifest => ({
        kind: SANDBOX_IDS_MANIFEST_KIND,
        schemaVersion: 1,
        mode: input.mode,
        outcome,
        startedAt,
        finishedAt: now().toISOString(),
        knownIds: { plans: known.planIds.length, preapprovals: known.preapprovalIds.length },
        alreadySandboxIds: [...alreadySandboxIds],
        toMirrorIds: toMirror.map((t) => t.prodId),
        mappings: [...mappings],
        rewrittenRows: { ...rewrittenRows },
        failures: [...failures]
    });
    const finish = (outcome: 'ok' | 'failed' | 'dry-run'): SandboxIdsManifest => {
        const manifest = snapshot(failures.length > 0 ? 'failed' : outcome);
        input.writer.write(manifest);
        return manifest;
    };

    try {
        known = await readKnownIds({ client: input.client });
    } catch (error) {
        failures.push({
            code: 'COPY_DB_ERROR',
            detail: `could not read the copy's ids (${errorName(error)})`
        });
        return finish('failed');
    }

    const families: readonly { kind: ObjectKind; ids: readonly string[] }[] = [
        { kind: 'plan', ids: known.planIds },
        { kind: 'preapproval', ids: known.preapprovalIds }
    ];
    for (const { kind, ids } of families) {
        for (const id of ids) {
            try {
                const found = await input.api.lookup({ kind, id });
                if (found === 'found') alreadySandboxIds.push(id);
                else toMirror.push({ kind, prodId: id });
            } catch (error) {
                failures.push({
                    code: 'PROVIDER_ERROR',
                    id,
                    detail: `lookup of a ${kind} failed (${errorName(error)})`
                });
            }
        }
    }
    if (failures.length > 0) return finish('failed');
    if (input.mode === 'dry-run') return finish('dry-run');

    const payerEmail = input.payerEmail;
    if (payerEmail === undefined || payerEmail.length === 0) {
        throw new Error('a confirmed run needs the payer email of the sandbox mirrors');
    }
    input.writer.write(snapshot('in-progress'));

    for (const { kind, prodId } of toMirror) {
        let sandboxId: string;
        try {
            const idempotencyKey = mirrorKey({ kind, prodId });
            sandboxId =
                kind === 'plan'
                    ? await input.api.createPlan({ idempotencyKey })
                    : await input.api.createPreapproval({ payerEmail, idempotencyKey });
        } catch (error) {
            failures.push({
                code: 'CREATE_FAILED',
                id: prodId,
                detail: `mirror ${kind} not created (${errorName(error)})`
            });
            return finish('failed');
        }
        mappings.push({ kind, prodId, sandboxId });
        input.writer.write(snapshot('in-progress'));
        try {
            if ((await input.api.lookup({ kind, id: sandboxId })) !== 'found')
                throw new Error('not found');
        } catch (error) {
            failures.push({
                code: 'MIRROR_NOT_READABLE',
                id: sandboxId,
                detail: `mirror ${kind} created but not readable by id (${errorName(error)})`
            });
            return finish('failed');
        }
    }

    if (mappings.length === 0) return finish('ok');
    try {
        rewrittenRows = await rewriteInOneTransaction({
            client: input.client,
            mappings,
            allowed: new Set([...alreadySandboxIds, ...mappings.map((m) => m.sandboxId)]),
            onIncomplete: (ids) => {
                for (const id of ids) {
                    failures.push({
                        code: 'REWRITE_INCOMPLETE',
                        id,
                        detail: 'still in the copy after the rewrite'
                    });
                }
            }
        });
    } catch (error) {
        failures.push({
            code: 'COPY_DB_ERROR',
            detail: `rewrite rolled back (${errorName(error)})`
        });
    }
    return finish('ok');
}

/**
 * Rewrites every column of {@link ID_COLUMNS} in ONE transaction, then re-reads the known ids in
 * that same transaction. If any of them is not in `allowed`, the transaction is rolled back, the
 * offenders are reported and an empty count is returned: the copy is never left half-rewritten.
 */
async function rewriteInOneTransaction({
    client,
    mappings,
    allowed,
    onIncomplete
}: {
    readonly client: ReadOnlyClient;
    readonly mappings: readonly IdMapping[];
    readonly allowed: ReadonlySet<string>;
    readonly onIncomplete: (ids: readonly string[]) => void;
}): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    await client.query('BEGIN');
    try {
        for (const { table, column, kind } of ID_COLUMNS) {
            const family = mappings.filter((m) => m.kind === kind);
            const result = await client.query(rewriteSql({ table, column }), [
                family.map((m) => m.prodId),
                family.map((m) => m.sandboxId)
            ]);
            counts[`${table}.${column}`] = Number(result.rows[0]?.n ?? 0);
        }
        const after = await selectKnownIds({ client });
        const left = [...after.planIds, ...after.preapprovalIds].filter((id) => !allowed.has(id));
        if (left.length > 0) {
            await client.query('ROLLBACK');
            onIncomplete(left);
            return {};
        }
        await client.query('COMMIT');
        return counts;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
    }
}
