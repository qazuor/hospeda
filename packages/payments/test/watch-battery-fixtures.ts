/** In-memory ports for the watch battery tests: a run store whose authorization can be consumed once. */
import type { WatchRunRecord, WatchShapeBaseline } from '../src/battery/index';

export interface MemoryRunStore {
    readonly started: {
        readonly runId: string;
        readonly consume: string | undefined;
        readonly day?: string;
    }[];
    /** Provider ids recorded the moment a write answered, before the run closed. */
    readonly progress: {
        readonly runId: string;
        readonly measurementId: string;
        readonly providerIds?: readonly string[];
        readonly writeKeys?: readonly string[];
        readonly ledger?: { readonly charged: number; readonly refunded: number };
    }[];
    readonly finished: { readonly runId: string; readonly run: WatchRunRecord }[];
    /** The run that consumed the authorization, if any. */
    consumedBy(): string | undefined;
    /** The runs an authorization of 0 covered, one per market day (B1). */
    dailyRuns(): readonly string[];
    readonly ports: {
        readonly readBaseline: () => Promise<WatchShapeBaseline | null>;
        readonly startRun: (args: {
            readonly account: 'sandbox' | 'production';
            readonly startedAt: Date;
            readonly consumeAuthorization?: {
                readonly month: string;
                readonly maxChargeMinor: number;
                readonly accountId: string;
                readonly day: string;
            };
        }) => Promise<{
            runId: string;
            authorizationConsumed: boolean;
            authorizationMiss?: 'DAY_TAKEN' | 'CHANGED';
        }>;
        readonly recordProgress: (args: {
            readonly runId: string;
            readonly measurementId: string;
            readonly providerIds?: readonly string[];
            readonly writeKeys?: readonly string[];
            readonly ledger: { readonly charged: number; readonly refunded: number };
        }) => Promise<void>;
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
    args: {
        readonly baseline?: WatchShapeBaseline | null;
        readonly consumedBy?: string;
        /** The authorization as stored NOW; consumption matches nothing unless the run saw the same values. */
        readonly stored?: {
            readonly month: string;
            readonly maxChargeMinor: number;
            readonly accountId: string;
        };
    } = {}
): MemoryRunStore {
    const started: MemoryRunStore['started'] = [];
    const finished: { runId: string; run: WatchRunRecord }[] = [];
    const progress: MemoryRunStore['progress'] = [];
    let consumed: string | undefined = args.consumedBy;
    const dailyRuns: string[] = [];
    let lastRunDay: string | undefined;
    return {
        started,
        progress,
        finished,
        consumedBy: () => consumed,
        dailyRuns: () => dailyRuns,
        last: () => {
            const entry = finished[finished.length - 1];
            if (!entry) throw new Error('no run was finished');
            return entry.run;
        },
        ports: {
            readBaseline: async () => args.baseline ?? null,
            startRun: async ({ consumeAuthorization }) => {
                const runId = crypto.randomUUID();
                started.push({
                    runId,
                    consume: consumeAuthorization?.month,
                    ...(consumeAuthorization ? { day: consumeAuthorization.day } : {})
                });
                const matchesStored =
                    consumeAuthorization !== undefined &&
                    (args.stored === undefined ||
                        (args.stored.month === consumeAuthorization.month &&
                            args.stored.maxChargeMinor === consumeAuthorization.maxChargeMinor &&
                            args.stored.accountId === consumeAuthorization.accountId));
                // B1: an authorization of 0 is never consumed; it is taken once per market day.
                if (consumeAuthorization?.maxChargeMinor === 0) {
                    const taken =
                        matchesStored &&
                        consumed === undefined &&
                        consumeAuthorization.day.slice(0, 7) === consumeAuthorization.month &&
                        (lastRunDay === undefined || lastRunDay < consumeAuthorization.day);
                    if (taken) {
                        lastRunDay = consumeAuthorization.day;
                        dailyRuns.push(runId);
                    }
                    if (taken) return { runId, authorizationConsumed: true };
                    // As the database: only the same day against the unchanged one is DAY_TAKEN.
                    const sameDay =
                        matchesStored &&
                        consumed === undefined &&
                        lastRunDay === consumeAuthorization.day;
                    return {
                        runId,
                        authorizationConsumed: false,
                        authorizationMiss: sameDay ? 'DAY_TAKEN' : 'CHANGED'
                    };
                }
                let authorizationConsumed = false;
                if (
                    consumeAuthorization !== undefined &&
                    consumed === undefined &&
                    (args.stored === undefined ||
                        (args.stored.month === consumeAuthorization.month &&
                            args.stored.maxChargeMinor === consumeAuthorization.maxChargeMinor &&
                            args.stored.accountId === consumeAuthorization.accountId))
                ) {
                    consumed = runId;
                    authorizationConsumed = true;
                }
                return { runId, authorizationConsumed };
            },
            recordProgress: async (entry) => {
                progress.push(entry);
            },
            finishRun: async ({ runId, run }) => {
                finished.push({ runId, run });
            }
        }
    };
}
