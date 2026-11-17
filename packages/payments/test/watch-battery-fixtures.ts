/** In-memory ports for the watch battery tests: a run store whose authorization can be consumed once. */
import type { WatchRunRecord, WatchShapeBaseline } from '../src/battery/index';

export interface MemoryRunStore {
    readonly started: { readonly runId: string; readonly consume: string | undefined }[];
    readonly finished: { readonly runId: string; readonly run: WatchRunRecord }[];
    /** The run that consumed the authorization, if any. */
    consumedBy(): string | undefined;
    readonly ports: {
        readonly readBaseline: () => Promise<WatchShapeBaseline | null>;
        readonly startRun: (args: {
            readonly account: 'sandbox' | 'production';
            readonly startedAt: Date;
            readonly consumeAuthorizationOfMonth?: string;
        }) => Promise<{ runId: string; authorizationConsumed: boolean }>;
        readonly finishRun: (args: { runId: string; run: WatchRunRecord }) => Promise<void>;
    };
    /** The last finished run. */
    last(): WatchRunRecord;
}

/**
 * Builds a run store. Consumption is compare-and-set on one shared cell, like the database one.
 *
 * @param args.baseline - What `readBaseline` answers
 * @param args.consumedBy - A run that already consumed the authorization
 */
export function memoryRunStore(
    args: { readonly baseline?: WatchShapeBaseline | null; readonly consumedBy?: string } = {}
): MemoryRunStore {
    const started: MemoryRunStore['started'] = [];
    const finished: { runId: string; run: WatchRunRecord }[] = [];
    let consumed: string | undefined = args.consumedBy;
    return {
        started,
        finished,
        consumedBy: () => consumed,
        last: () => {
            const entry = finished[finished.length - 1];
            if (!entry) throw new Error('no run was finished');
            return entry.run;
        },
        ports: {
            readBaseline: async () => args.baseline ?? null,
            startRun: async ({ consumeAuthorizationOfMonth }) => {
                const runId = crypto.randomUUID();
                started.push({ runId, consume: consumeAuthorizationOfMonth });
                let authorizationConsumed = false;
                if (consumeAuthorizationOfMonth !== undefined && consumed === undefined) {
                    consumed = runId;
                    authorizationConsumed = true;
                }
                return { runId, authorizationConsumed };
            },
            finishRun: async ({ runId, run }) => {
                finished.push({ runId, run });
            }
        }
    };
}
