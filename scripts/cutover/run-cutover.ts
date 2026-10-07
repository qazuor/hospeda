import type { Target } from './cancel.ts';
import { cancelTargets, verifyCancelled } from './cancel.ts';
import type { WalkResult } from './census.ts';
import { rereadAll, walkAll } from './census.ts';
import { ProviderError } from './provider-api.ts';
import type {
    CutoverFailure,
    CutoverManifest,
    KnownIds,
    KnownIdsReader,
    ProviderApi,
    ProviderObject
} from './types.ts';
import { CANCELLED_STATUS, LIVE_PREAPPROVAL_STATUSES } from './types.ts';

/** Input of {@link runCutover}. */
export interface RunCutoverInput {
    readonly api: ProviderApi;
    /** Reads the ids the old database knows (read-only). */
    readonly readKnownIds: KnownIdsReader;
    /** Probe ids enumerated by the versioned manifest: left alive in 1b, and must appear in the walk. */
    readonly probeIds: readonly string[];
    /** Census and completeness only: no cancellation call is sent. */
    readonly dryRun: boolean;
    readonly sleep: (ms: number) => Promise<void>;
    readonly backoffMs?: readonly number[];
    readonly now?: () => Date;
    /**
     * Persists a manifest checkpoint and answers whether it landed on disk (HOS-1427). Called
     * before any call (outcome `in-progress`), once the targets are known and after every
     * cancellation call sent, so an abort or a crash still leaves the ids already touched. If the
     * FIRST checkpoint cannot be written the run stops before touching the provider.
     */
    readonly onCheckpoint?: (manifest: CutoverManifest) => boolean;
}

/** Result of a run. `ok` is false whenever the cutover must not advance. */
export interface RunCutoverResult {
    readonly ok: boolean;
    readonly manifest: CutoverManifest;
}

function walkFailures({ walk }: { readonly walk: WalkResult }): readonly CutoverFailure[] {
    const label = walk.kind === 'plan' ? 'preapproval_plan' : 'preapproval';
    const consistent =
        walk.ids.size === walk.total && walk.rowsSeen === walk.ids.size && !walk.totalChanged;
    if (consistent) return [];
    const changed = walk.totalChanged ? ' (total changed between pages)' : '';
    return [
        {
            code: 'WALK_COUNT_MISMATCH',
            detail: `${label} walk saw ${walk.ids.size} distinct of ${walk.rowsSeen} rows, provider total ${walk.total}${changed}`
        }
    ];
}

function missingKnown({
    known,
    walked,
    what
}: {
    readonly known: readonly string[];
    readonly walked: ReadonlySet<string>;
    readonly what: string;
}): readonly CutoverFailure[] {
    return known
        .filter((id) => !walked.has(id))
        .map((id) => ({
            code: 'KNOWN_ID_MISSING' as const,
            id,
            detail: `${what} id absent from the unfiltered walk`
        }));
}

/** The old database could not be read. Raised before any provider call is made. */
class OldDbError extends Error {}

function describeCause({ error }: { readonly error: unknown }): string {
    if (!(error instanceof Error)) return 'unknown error';
    const code = Reflect.get(error, 'code');
    return `${typeof code === 'string' ? `${code} ` : ''}${error.message}`.trim();
}

async function readOldDb({
    readKnownIds
}: {
    readonly readKnownIds: KnownIdsReader;
}): Promise<KnownIds> {
    try {
        return await readKnownIds();
    } catch (error) {
        throw new OldDbError(`old database read failed: ${describeCause({ error })}`, {
            cause: error
        });
    }
}

function describeFailure({ error }: { readonly error: unknown }): CutoverFailure {
    if (error instanceof OldDbError) return { code: 'OLD_DB_ERROR', detail: error.message };
    if (error instanceof ProviderError) return { code: 'PROVIDER_ERROR', detail: error.message };
    return { code: 'UNEXPECTED_ERROR', detail: describeCause({ error }) };
}

/**
 * Runs steps 1a, 1b and 2 of the cutover against the provider.
 *
 * 1a sets every non-cancelled plan inactive; 1b cancels every pending, authorized or
 * paused preapproval except the enumerated probes; 2 re-reads each by id (retrying the
 * cancellation) and gates on completeness of the walk. Nothing is written to any
 * database, and nothing is sent to anybody.
 *
 * @param input - provider client, ids sources and run options
 * @returns `ok` and the manifest (ids and counts only), also on failure
 */
export async function runCutover({
    api,
    readKnownIds,
    probeIds,
    dryRun,
    sleep,
    backoffMs,
    now = () => new Date(),
    onCheckpoint
}: RunCutoverInput): Promise<RunCutoverResult> {
    const startedAt = now().toISOString();
    const failures: CutoverFailure[] = [];
    let plansWalk: WalkResult | undefined;
    let preapprovalsWalk: WalkResult | undefined;
    let plansToCancel: Target[] = [];
    const preapprovalsToCancel: Target[] = [];
    const preserved: string[] = [];
    let unknownLive: string[] = [];
    let verified: readonly string[] = [];
    const sentPlanIds: string[] = [];
    const sentPreapprovalIds: string[] = [];

    const summary = (walk: WalkResult | undefined) => ({
        total: walk?.total ?? 0,
        walked: walk?.ids.size ?? 0
    });
    const build = (outcome: CutoverManifest['outcome']): CutoverManifest => ({
        schemaVersion: 1,
        outcome,
        startedAt,
        finishedAt: now().toISOString(),
        census: { plans: summary(plansWalk), preapprovals: summary(preapprovalsWalk) },
        cancelledPlanIds: [...sentPlanIds],
        cancelledPreapprovalIds: [...sentPreapprovalIds],
        rereadCancelledIds: verified,
        preservedProbeIds: [...preserved],
        unknownLiveIds: unknownLive,
        failures: [...failures]
    });
    const checkpoint = (): boolean => onCheckpoint?.(build('in-progress')) ?? true;

    if (!checkpoint()) {
        failures.push({
            code: 'MANIFEST_WRITE_FAILED',
            detail: 'the first manifest checkpoint could not be written; nothing was called'
        });
        return { ok: false, manifest: build('failed') };
    }

    try {
        const known = await readOldDb({ readKnownIds });
        plansWalk = await walkAll({ api, kind: 'plan' });
        preapprovalsWalk = await walkAll({ api, kind: 'preapproval' });

        const walkedAll = new Set([...plansWalk.ids, ...preapprovalsWalk.ids]);
        const completeness: CutoverFailure[] = [
            ...walkFailures({ walk: plansWalk }),
            ...walkFailures({ walk: preapprovalsWalk }),
            ...missingKnown({ known: known.planIds, walked: plansWalk.ids, what: 'known plan' }),
            ...missingKnown({
                known: known.preapprovalIds,
                walked: preapprovalsWalk.ids,
                what: 'known preapproval'
            }),
            ...missingKnown({ known: probeIds, walked: walkedAll, what: 'probe manifest' })
        ];

        const plans = await rereadAll({ api, kind: 'plan', ids: plansWalk.ids });
        const preapprovals = await rereadAll({
            api,
            kind: 'preapproval',
            ids: preapprovalsWalk.ids
        });

        const probeSet = new Set(probeIds);
        const knownSet = new Set([...known.planIds, ...known.preapprovalIds]);
        const isLive = (o: ProviderObject): boolean => o.status !== CANCELLED_STATUS;

        plansToCancel = plans.filter(isLive).map(({ kind, id }) => ({ kind, id }));
        for (const o of preapprovals) {
            if (o.status === CANCELLED_STATUS) continue;
            if (!LIVE_PREAPPROVAL_STATUSES.includes(o.status)) {
                failures.push({
                    code: 'UNEXPECTED_STATUS',
                    id: o.id,
                    detail: 'preapproval in a status the cutover does not know'
                });
                continue;
            }
            if (probeSet.has(o.id)) preserved.push(o.id);
            else preapprovalsToCancel.push({ kind: 'preapproval', id: o.id });
        }
        unknownLive = [
            ...plansToCancel.map((t) => t.id),
            ...preapprovalsToCancel.map((t) => t.id)
        ].filter((id) => !knownSet.has(id) && !probeSet.has(id));

        if (!dryRun) {
            checkpoint();
            const onSent = (target: Target): void => {
                (target.kind === 'plan' ? sentPlanIds : sentPreapprovalIds).push(target.id);
                checkpoint();
            };
            await cancelTargets({ api, targets: plansToCancel, onSent });
            await cancelTargets({ api, targets: preapprovalsToCancel, onSent });
            const result = await verifyCancelled({
                api,
                targets: [...plansToCancel, ...preapprovalsToCancel],
                sleep,
                backoffMs
            });
            verified = result.verified;
            for (const s of result.stuck) {
                failures.push({
                    code: 'NOT_CANCELLED',
                    id: s.id,
                    detail: `${s.kind} still '${s.lastStatus}' after the retries`
                });
            }
        }
        failures.push(...completeness);
    } catch (error) {
        failures.push(describeFailure({ error }));
    }

    const ok = failures.length === 0;
    return { ok, manifest: build(ok ? (dryRun ? 'dry-run' : 'ok') : 'failed') };
}
