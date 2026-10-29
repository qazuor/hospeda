import type { Target } from './cancel.ts';
import { cancelTargets, DEFAULT_RETRY_BACKOFF_MS, verifyCancelled } from './cancel.ts';
import { ProviderError } from './provider-api.ts';
import type { StagingSandboxApi } from './staging-sandbox-api.ts';
import type { StagingSources } from './staging-sandbox-sources.ts';
import type { ProviderApi } from './types.ts';
import { CANCELLED_STATUS, LIVE_PREAPPROVAL_STATUSES } from './types.ts';
import type { ManifestWriter } from './write-manifest.ts';

/** Marks the manifest of this run apart from the U3 cutover manifest. */
export const STAGING_SANDBOX_MANIFEST_KIND = 'staging-sandbox-preapprovals';

/** Failure codes of the staging sandbox run. Any of them stops the window before V4. */
export type StagingSandboxFailureCode =
    | 'SEARCH_INCOMPLETE'
    | 'UNEXPECTED_STATUS'
    | 'NOT_CANCELLED'
    | 'PROVIDER_ERROR';

/** One failure. `detail` is fixed text plus ids or ordinals: never an email or a provider payload. */
export interface StagingSandboxFailure {
    readonly code: StagingSandboxFailureCode;
    readonly id?: string;
    readonly detail: string;
}

/** `in-progress` marks a checkpoint; every other outcome is a finished record. */
export type StagingSandboxOutcome = 'in-progress' | 'ok' | 'failed' | 'dry-run';

/**
 * The run manifest: ids and counts only, no data about people. A retry reads its
 * `foundIds` back (`--from-manifest`), so a later run covers the same preapprovals even after
 * the reset has erased the database anchors.
 */
export interface StagingSandboxManifest {
    readonly kind: typeof STAGING_SANDBOX_MANIFEST_KIND;
    readonly schemaVersion: 1;
    readonly mode: 'dry-run' | 'apply';
    readonly outcome: StagingSandboxOutcome;
    readonly startedAt: string;
    /** When the run finished; on an `in-progress` manifest, when that checkpoint was written. */
    readonly finishedAt: string;
    /** How many inputs each source gave (emails are counted, never written). */
    readonly sources: {
        readonly anchoredIds: number;
        readonly payerEmails: number;
        readonly manifestIds: number;
    };
    /** Every id found by any source, minus the preserved probes. */
    readonly foundIds: readonly string[];
    /** Found ids re-read in a live status: the ones a real run cancels. */
    readonly liveIds: readonly string[];
    /** Ids a cancellation call was sent for (empty on a dry run). */
    readonly cancelRequestedIds: readonly string[];
    /** Ids re-read by id and verified `cancelled` after this run's cancellation. */
    readonly cancelledIds: readonly string[];
    /** Ids already `cancelled` when re-read: nothing was sent for them. */
    readonly alreadyCancelledIds: readonly string[];
    /** Ids the provider answers 404 for: they do not exist in this account. */
    readonly notFoundIds: readonly string[];
    /** Probe ids left alone on purpose (the probe manifest). */
    readonly preservedProbeIds: readonly string[];
    readonly failures: readonly StagingSandboxFailure[];
}

/** Input of {@link runStagingSandbox}. */
export interface RunStagingSandboxInput {
    readonly mode: 'dry-run' | 'apply';
    readonly api: ProviderApi;
    readonly sandboxApi: StagingSandboxApi;
    readonly sources: StagingSources;
    /** Ids from a previous manifest (`--from-manifest`), re-read like any other. */
    readonly manifestIds: readonly string[];
    readonly probeIds: readonly string[];
    readonly writer: ManifestWriter<StagingSandboxManifest>;
    readonly sleep: (ms: number) => Promise<void>;
    readonly backoffMs?: readonly number[];
    readonly now?: () => Date;
}

/** Collects the candidate ids of every source, in a stable order, and the search failures. */
async function collectCandidates({
    sandboxApi,
    sources,
    manifestIds
}: Pick<RunStagingSandboxInput, 'sandboxApi' | 'sources' | 'manifestIds'>): Promise<{
    readonly ids: readonly string[];
    readonly failures: readonly StagingSandboxFailure[];
}> {
    const ids = new Set<string>([...sources.anchoredIds, ...manifestIds]);
    const failures: StagingSandboxFailure[] = [];
    const total = sources.payerEmails.length;
    for (const [index, payerEmail] of sources.payerEmails.entries()) {
        const ordinal = `payer email ${index + 1} of ${total}`;
        try {
            const found = await sandboxApi.searchPreapprovalsByPayerEmail({ payerEmail });
            for (const id of found.ids) ids.add(id);
            if (found.ids.length !== found.total || found.rowsSeen !== found.total) {
                failures.push({
                    code: 'SEARCH_INCOMPLETE',
                    detail: `${ordinal}: walked ${found.ids.length} distinct of ${found.total} (rows ${found.rowsSeen})`
                });
            }
        } catch (error) {
            const status = error instanceof ProviderError ? error.httpStatus : 0;
            failures.push({
                code: 'PROVIDER_ERROR',
                detail: `${ordinal}: search failed (HTTP ${status})`
            });
        }
    }
    return { ids: [...ids].sort(), failures };
}

/**
 * Cancels, in the provider SANDBOX, the preapprovals the staging database anchors or that
 * were created for its declared payer emails. Every candidate is re-read BY ID first; only a
 * live one is cancelled, and every cancellation is re-read until it reads `cancelled` (with
 * the bounded retries of {@link verifyCancelled}). A dry run reads and writes the manifest only.
 *
 * Idempotent: a second run re-reads everything, and ids already `cancelled` are never sent again.
 *
 * The environment guards run BEFORE this function (see `cli-staging-sandbox-main.ts`).
 *
 * @param input - mode, provider clients, sources, probe ids and the manifest writer
 * @returns the finished manifest (also written through `writer`)
 */
export async function runStagingSandbox({
    mode,
    api,
    sandboxApi,
    sources,
    manifestIds,
    probeIds,
    writer,
    sleep,
    backoffMs = DEFAULT_RETRY_BACKOFF_MS,
    now = () => new Date()
}: RunStagingSandboxInput): Promise<StagingSandboxManifest> {
    const startedAt = now().toISOString();
    const probes = new Set(probeIds);
    const failures: StagingSandboxFailure[] = [];
    const collected = await collectCandidates({ sandboxApi, sources, manifestIds });
    failures.push(...collected.failures);

    const foundIds = collected.ids.filter((id) => !probes.has(id));
    const preservedProbeIds = collected.ids.filter((id) => probes.has(id));
    const liveIds: string[] = [];
    const alreadyCancelledIds: string[] = [];
    const notFoundIds: string[] = [];
    for (const id of foundIds) {
        try {
            const { status } = await api.getById({ kind: 'preapproval', id });
            if (status === CANCELLED_STATUS) alreadyCancelledIds.push(id);
            else if (LIVE_PREAPPROVAL_STATUSES.includes(status)) liveIds.push(id);
            else
                failures.push({
                    code: 'UNEXPECTED_STATUS',
                    id,
                    detail: `status '${status}' is not live nor cancelled; left alone`
                });
        } catch (error) {
            const status = error instanceof ProviderError ? error.httpStatus : 0;
            if (status === 404) notFoundIds.push(id);
            else
                failures.push({
                    code: 'PROVIDER_ERROR',
                    id,
                    detail: `read failed (HTTP ${status})`
                });
        }
    }

    const cancelRequestedIds: string[] = [];
    let cancelledIds: readonly string[] = [];
    const snapshot = (outcome: StagingSandboxOutcome): StagingSandboxManifest => ({
        kind: STAGING_SANDBOX_MANIFEST_KIND,
        schemaVersion: 1,
        mode,
        outcome,
        startedAt,
        finishedAt: now().toISOString(),
        sources: {
            anchoredIds: sources.anchoredIds.length,
            payerEmails: sources.payerEmails.length,
            manifestIds: manifestIds.length
        },
        foundIds,
        liveIds: [...liveIds],
        cancelRequestedIds: [...cancelRequestedIds],
        cancelledIds: [...cancelledIds],
        alreadyCancelledIds,
        notFoundIds,
        preservedProbeIds,
        failures: [...failures]
    });

    if (mode === 'apply' && liveIds.length > 0) {
        const targets: readonly Target[] = liveIds.map((id) => ({ kind: 'preapproval', id }));
        writer.write(snapshot('in-progress'));
        await cancelTargets({
            api,
            targets,
            onSent: (target) => {
                cancelRequestedIds.push(target.id);
                writer.write(snapshot('in-progress'));
            }
        });
        const verified = await verifyCancelled({ api, targets, sleep, backoffMs });
        cancelledIds = verified.verified;
        for (const stuck of verified.stuck) {
            failures.push({
                code: 'NOT_CANCELLED',
                id: stuck.id,
                detail: `still '${stuck.lastStatus}' after ${backoffMs.length} retries`
            });
        }
    }

    const outcome: StagingSandboxOutcome =
        failures.length > 0 ? 'failed' : mode === 'dry-run' ? 'dry-run' : 'ok';
    const manifest = snapshot(outcome);
    writer.write(manifest);
    return manifest;
}
