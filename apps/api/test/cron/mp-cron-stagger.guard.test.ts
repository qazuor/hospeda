import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CronExpressionParser } from 'cron-parser';
import { describe, expect, it } from 'vitest';
import {
    checkMpCronStagger,
    findMpCronViolations,
    formatMpCronStaggerFailure,
    type MpCronSchedule
} from '../../src/cron/mp-cron-stagger';
import { cronJobs } from '../../src/cron/registry';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';

const JOB_DIR = join(__dirname, '../../src/cron/jobs');
/** Add jobs here when they reach MP indirectly and cannot be found by source scanning. */
const MP_CALLING_JOBS_INDIRECT: readonly string[] = [];
/**
 * HOS-1955 / PR #4048 and HOS-1573 / PR #4050 are on
 * epic/HOS-1352-post-mvp. When they land, add `exclusive: true`.
 */
const PENDING_MP_CRON_SCHEDULES: readonly MpCronSchedule[] = [
    { name: 'billing-deferred-cancellation-retry', schedule: '4-59/5 * * * *' },
    { name: 'subscription-pause-end', schedule: '47 * * * *' }
];

function expandMinutes(expression: string): readonly number[] {
    return CronExpressionParser.parse(expression).fields.minute.values;
}

function registeredJobFile(name: string): string | undefined {
    return readdirSync(JOB_DIR)
        .filter((file) => file.endsWith('.job.ts'))
        .find((file) => readFileSync(join(JOB_DIR, file), 'utf8').includes(`name: '${name}'`));
}

function isMpCalling(fileContents: string): boolean {
    return (
        /from ['"][^'"]*utils\/payment-provider/.test(fileContents) ||
        /\bgetPaymentProvider\s*\(/.test(fileContents)
    );
}

describe('Mercado Pago cron stagger guard (AC-17)', () => {
    it('marks every detected MP caller exclusive and has no stale exclusive jobs', () => {
        const detected = new Set<string>(MP_CALLING_JOBS_INDIRECT);
        const fileByName = new Map<string, string>();
        for (const file of readdirSync(JOB_DIR).filter((value) => value.endsWith('.job.ts'))) {
            const contents = readFileSync(join(JOB_DIR, file), 'utf8');
            if (!isMpCalling(contents)) continue;
            const match = contents.match(/name:\s*'([^']+)'/);
            if (match?.[1]) {
                detected.add(match[1]);
                fileByName.set(match[1], file);
            }
        }
        const manifest = new Map(CRON_SCHEDULES.map((job) => [job.name, job]));
        const jobs = cronJobs.map((job) => ({
            name: job.name,
            schedule: manifest.get(job.name)?.schedule ?? job.schedule,
            exclusive: job.exclusive === true,
            mpCalling: detected.has(job.name)
        }));
        const violations = findMpCronViolations({
            jobs,
            pending: PENDING_MP_CRON_SCHEDULES,
            expandMinutes
        });
        expect(
            violations,
            [...fileByName.entries()].map(([name, file]) => `${name}: ${file}`).join('\n')
        ).toEqual([]);
    });

    it('reserves schedules for pending MP jobs until their manifest entry lands', () => {
        const schedules = [
            ...CRON_SCHEDULES.filter((job) => {
                const file = registeredJobFile(job.name);
                return file && isMpCalling(readFileSync(join(JOB_DIR, file), 'utf8'));
            }).map(({ name, schedule }) => ({ name, schedule })),
            ...PENDING_MP_CRON_SCHEDULES.filter(
                (pending) => !CRON_SCHEDULES.some((job) => job.name === pending.name)
            )
        ];
        const report = checkMpCronStagger({ schedules, expandMinutes });
        expect(report.conflicts, formatMpCronStaggerFailure(report)).toEqual([]);
    });

    it('accepts comma-separated scheduled hours while preserving minute ownership checks', () => {
        expect(expandMinutes('10 2,3,4 * * *')).toEqual([10]);
        expect(CronExpressionParser.parse('10 2,3,4 * * *').fields.hour.values).toEqual([2, 3, 4]);
    });

    it('detects pending jobs when a manifest addition omits exclusivity', () => {
        const violations = findMpCronViolations({
            jobs: [
                {
                    name: 'billing-deferred-cancellation-retry',
                    schedule: '4-59/5 * * * *',
                    exclusive: false,
                    mpCalling: true
                }
            ],
            pending: PENDING_MP_CRON_SCHEDULES,
            expandMinutes
        });
        expect(violations.join(' ')).toContain('billing-deferred-cancellation-retry');
    });

    it('allows a pending MP job when it is exclusive and rejects minute collisions', () => {
        const job = {
            name: 'billing-deferred-cancellation-retry',
            schedule: '4-59/5 * * * *',
            exclusive: true,
            mpCalling: true
        };
        expect(
            findMpCronViolations({ jobs: [job], pending: PENDING_MP_CRON_SCHEDULES, expandMinutes })
        ).toEqual([]);
        const collision = findMpCronViolations({
            jobs: [
                job,
                { name: 'new-mp-job', schedule: '47 * * * *', exclusive: true, mpCalling: true }
            ],
            pending: PENDING_MP_CRON_SCHEDULES,
            expandMinutes
        });
        expect(collision.join(' ')).toContain('new-mp-job');
        expect(collision.join(' ')).toContain('subscription-pause-end');
    });

    it('reports minute zero, collisions, and available minute choices', () => {
        const report = checkMpCronStagger({
            schedules: [
                { name: 'a', schedule: '* * * * *' },
                { name: 'b', schedule: '* * * * *' }
            ],
            expandMinutes: () => [0, 2]
        });
        expect(report.conflicts).toEqual(['minute 0: a, b', 'minute 2: a, b']);
        expect(formatMpCronStaggerFailure(report)).toContain('Free minutes: 1, 3');
    });
});
