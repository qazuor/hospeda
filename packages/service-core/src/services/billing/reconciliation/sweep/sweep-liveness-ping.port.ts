/**
 * External liveness witness for scheduled sweeps. B/09 §7.1: a sweep pings only
 * after a COMPLETE run; the monitor alerts after 26 hours without a ping.
 * The concrete monitor belongs to phase 10 and lives in an adapter. There is
 * deliberately no failure notification method: silence is the signal for a partial run.
 */
export type SweepName = 'RECONCILIATION';

export interface SweepLivenessPing {
    ping(input: {
        readonly sweep: SweepName;
        readonly runId: string;
        readonly finishedAt: Date;
    }): Promise<void>;
}
