import type { ObjectKind, ProviderApi } from './types.ts';
import { CANCELLED_STATUS } from './types.ts';

/** Default waits before each of the three retries of step 2 (owner decision: 3 retries, increasing backoff). */
export const DEFAULT_RETRY_BACKOFF_MS: readonly number[] = [2_000, 5_000, 10_000];

/** One cancellation target. */
export interface Target {
    readonly kind: ObjectKind;
    readonly id: string;
}

/**
 * Sends one cancellation call per target, in order. An answer is never trusted: it is
 * neither read nor recorded here, because step 2 re-reads every id by id and retries
 * the ones that did not take. A failed call does not stop the loop.
 *
 * @param input - provider client, targets and an optional hook called after each call was sent
 *   (the run uses it to checkpoint the manifest, so an abort keeps the ids already touched)
 */
export async function cancelTargets({
    api,
    targets,
    onSent
}: {
    readonly api: ProviderApi;
    readonly targets: readonly Target[];
    readonly onSent?: (target: Target) => void;
}): Promise<void> {
    for (const target of targets) {
        await api.cancel(target);
        onSent?.(target);
    }
}

/** True only for a parseable `end_date` strictly before `now`; anything else is not "ended". */
function endDateIsPast({
    endDate,
    now
}: {
    readonly endDate: string | null | undefined;
    readonly now: Date;
}): boolean {
    if (!endDate) return false;
    const time = Date.parse(endDate);
    return Number.isFinite(time) && time < now.getTime();
}

/** Outcome of step 2. */
export interface VerifyResult {
    /** Ids re-read by id and found `cancelled`. */
    readonly verified: readonly string[];
    /** Targets still not `cancelled` after the retries. */
    readonly stuck: readonly (Target & { readonly lastStatus: string })[];
    /**
     * Preapprovals the provider refuses as already ended (400) whose `end_date` is in the past,
     * and which still read as not cancelled (HOS-1961). They cannot charge, so they are neither
     * verified nor stuck.
     */
    readonly ended: readonly string[];
}

/**
 * Step 2: re-reads each target BY ID. A target not `cancelled` gets its cancellation
 * re-sent, up to `backoffMs.length` times with the given waits, re-reading after each.
 *
 * @param input - provider client, targets, injected sleep and backoff schedule
 * @returns the verified ids and the targets that never reached `cancelled`
 */
export async function verifyCancelled({
    api,
    targets,
    sleep,
    backoffMs = DEFAULT_RETRY_BACKOFF_MS,
    now = () => new Date()
}: {
    readonly api: ProviderApi;
    readonly targets: readonly Target[];
    readonly sleep: (ms: number) => Promise<void>;
    readonly backoffMs?: readonly number[];
    readonly now?: () => Date;
}): Promise<VerifyResult> {
    const verified: string[] = [];
    const ended: string[] = [];
    const stuck: (Target & { lastStatus: string })[] = [];
    for (const target of targets) {
        let read = await api.getById(target);
        let isEnded = false;
        for (const wait of backoffMs) {
            if (read.status === CANCELLED_STATUS || isEnded) break;
            await sleep(wait);
            const call = await api.cancel(target);
            read = await api.getById(target);
            isEnded =
                read.status !== CANCELLED_STATUS &&
                target.kind === 'preapproval' &&
                call.alreadyEnded === true &&
                endDateIsPast({ endDate: read.endDate, now: now() });
        }
        if (read.status === CANCELLED_STATUS) verified.push(target.id);
        else if (isEnded) ended.push(target.id);
        else stuck.push({ ...target, lastStatus: read.status });
    }
    return { verified, stuck, ended };
}
