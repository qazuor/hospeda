import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CronExpressionParser } from 'cron-parser';
import { describe, expect, it } from 'vitest';
import {
    checkMpCronStagger,
    formatMpCronStaggerFailure,
    type MpCronSchedule
} from '../../src/cron/mp-cron-stagger';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';

const JOB_DIR = join(__dirname, '../../src/cron/jobs');
const MP_CALLING_JOBS_INDIRECT: readonly string[] = [];
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
        const manifestNames = new Set(CRON_SCHEDULES.map((job) => job.name));
        for (const name of detected) {
            if (!manifestNames.has(name)) continue;
            const file = registeredJobFile(name);
            expect(file, `missing job file for ${name}`).toBeDefined();
            const source = readFileSync(join(JOB_DIR, file ?? ''), 'utf8');
            expect(source, `${fileByName.get(name)} reaches MP; add exclusive: true`).toMatch(
                /exclusive:\s*true/
            );
        }
        for (const job of CRON_SCHEDULES) {
            const file = registeredJobFile(job.name);
            if (!file) continue;
            const source = readFileSync(join(JOB_DIR, file), 'utf8');
            if (/exclusive:\s*true/.test(source)) {
                expect(detected.has(job.name), `${file} has stale exclusive: true`).toBe(true);
            }
        }
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

    it('detects pending jobs when a manifest addition omits exclusivity', () => {
        const manifest = [{ name: 'new-mp-job', schedule: '4 * * * *' }];
        const source =
            "import { getPaymentProvider } from '../../utils/payment-provider';\nname: 'new-mp-job';";
        const hasExclusive = /exclusive:\s*true/.test(source);
        const isRequired = isMpCalling(source) && manifest.some((job) => job.name === 'new-mp-job');
        expect(isRequired && !hasExclusive).toBe(true);
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
