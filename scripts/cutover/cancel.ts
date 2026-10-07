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
 * Sends one cancellation call per target, in order. Each call's answer is recorded but
 * never trusted: step 2 re-reads every id. A failed call does not stop the loop.
 *
 * @param input - provider client and targets
 * @returns the targets whose call was not accepted
 */
export async function cancelTargets({
    api,
    targets
}: {
    readonly api: ProviderApi;
    readonly targets: readonly Target[];
}): Promise<readonly Target[]> {
    const rejected: Target[] = [];
    for (const target of targets) {
        const result = await api.cancel(target);
        if (!result.accepted) rejected.push(target);
    }
    return rejected;
}

/** Outcome of step 2. */
export interface VerifyResult {
    /** Ids re-read by id and found `cancelled`. */
    readonly verified: readonly string[];
    /** Targets still not `cancelled` after the retries. */
    readonly stuck: readonly (Target & { readonly lastStatus: string })[];
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
    backoffMs = DEFAULT_RETRY_BACKOFF_MS
}: {
    readonly api: ProviderApi;
    readonly targets: readonly Target[];
    readonly sleep: (ms: number) => Promise<void>;
    readonly backoffMs?: readonly number[];
}): Promise<VerifyResult> {
    const verified: string[] = [];
    const stuck: (Target & { lastStatus: string })[] = [];
    for (const target of targets) {
        let status = (await api.getById(target)).status;
        for (const wait of backoffMs) {
            if (status === CANCELLED_STATUS) break;
            await sleep(wait);
            await api.cancel(target);
            status = (await api.getById(target)).status;
        }
        if (status === CANCELLED_STATUS) verified.push(target.id);
        else stuck.push({ ...target, lastStatus: status });
    }
    return { verified, stuck };
}
