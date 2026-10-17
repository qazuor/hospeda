// TEST:V9b:13 AC:V9b:14 — H12 trusted previous pass selection.
import { afterAll, describe, expect, it } from 'vitest';
import { cronRunModel } from '../../src/models/cron/cronRun.model.ts';
import { cronRuns } from '../../src/schemas/cron/cron_run.dbschema.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

describe('cron run previous startedAt', () => {
    it('selects only the newest strictly prior successful non-dry run of this job', async () => {
        await withTestTransaction(async (tx) => {
            const jobName = `retention-test-${crypto.randomUUID()}`;
            const before = new Date('2026-10-17T06:00:00Z');
            const find = () => cronRunModel.findPreviousRunStartedAt({ jobName, before, tx });
            expect(await find()).toBeNull();

            const insert = async (args: {
                job: string;
                at: Date;
                status?: string;
                dryRun?: boolean;
            }) =>
                tx.insert(cronRuns).values({
                    jobName: args.job,
                    startedAt: args.at,
                    finishedAt: new Date(args.at.getTime() + 1_000),
                    durationMs: 1_000,
                    executionMode: 'scheduled',
                    status: args.status ?? 'success',
                    dryRun: args.dryRun ?? false,
                    details: {}
                });
            const first = new Date('2026-10-14T06:00:00Z');
            const prior = new Date('2026-10-15T06:00:00Z');
            const partial = new Date('2026-10-16T06:00:00Z');
            await insert({ job: jobName, at: first });
            await insert({ job: jobName, at: prior });
            await insert({ job: jobName, at: partial, status: 'partial' });
            await insert({ job: jobName, at: new Date('2026-10-16T12:00:00Z'), dryRun: true });
            await insert({ job: jobName, at: new Date('2026-10-16T13:00:00Z'), status: 'failed' });
            await insert({ job: jobName, at: new Date('2026-10-16T14:00:00Z'), status: 'timeout' });
            await insert({ job: jobName, at: before });
            await insert({ job: jobName, at: new Date('2026-10-18T06:00:00Z') });
            await insert({ job: `${jobName}-other`, at: new Date('2026-10-16T23:00:00Z') });

            expect(await find()).toEqual(partial);
        });
    });
});
