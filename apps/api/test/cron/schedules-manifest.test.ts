/**
 * Sync test for the cron schedule manifest.
 *
 * `apps/api/src/cron/schedules.manifest.ts` is the source of truth for
 * what gets registered with the in-process node-cron scheduler at API
 * startup. It must stay in lockstep with the live cron registry: every
 * enabled job must have a manifest entry, and every manifest entry must
 * reference a registered job. Drift here means jobs either silently fail
 * to schedule or schedule with the wrong expression.
 *
 * @see apps/api/src/cron/schedules.manifest.ts
 * @see apps/api/src/cron/registry.ts
 */
import { describe, expect, it } from 'vitest';
import { cronJobs } from '../../src/cron/registry';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';

describe('cron schedule manifest', () => {
    it('has unique job names', () => {
        const names = CRON_SCHEDULES.map((entry) => entry.name);
        const unique = new Set(names);
        expect(unique.size).toBe(names.length);
    });

    it('lists every enabled job from the cron registry', () => {
        const enabledJobNames = cronJobs.filter((job) => job.enabled).map((job) => job.name);
        const manifestNames = CRON_SCHEDULES.map((entry) => entry.name);

        for (const jobName of enabledJobNames) {
            expect(
                manifestNames,
                `Job "${jobName}" is enabled in registry.ts but missing from schedules.manifest.ts`
            ).toContain(jobName);
        }
    });

    it('does not include jobs that are not registered or are disabled', () => {
        const enabledJobNames = new Set(
            cronJobs.filter((job) => job.enabled).map((job) => job.name)
        );

        for (const entry of CRON_SCHEDULES) {
            expect(
                enabledJobNames.has(entry.name),
                `Manifest entry "${entry.name}" has no matching enabled job in registry.ts`
            ).toBe(true);
        }
    });

    it('matches the cron expression of each registered job', () => {
        const registryByName = new Map(cronJobs.map((job) => [job.name, job]));

        for (const entry of CRON_SCHEDULES) {
            const job = registryByName.get(entry.name);
            if (!job) continue; // covered by the previous test
            expect(
                entry.schedule,
                `Schedule mismatch for "${entry.name}": manifest=${entry.schedule}, registry=${job.schedule}`
            ).toBe(job.schedule);
        }
    });

    // SPEC-161 UX: every job must carry presentation metadata so the admin card
    // and the platform crons page can show a friendly name + category grouping.
    const VALID_CATEGORIES = new Set([
        'billing',
        'notifications',
        'content',
        'media',
        'search-cache',
        'system'
    ]);

    it('gives every entry a non-empty friendly displayName', () => {
        for (const entry of CRON_SCHEDULES) {
            expect(
                typeof entry.displayName === 'string' && entry.displayName.trim().length > 0,
                `Manifest entry "${entry.name}" is missing a displayName`
            ).toBe(true);
        }
    });

    it('assigns every entry a valid category', () => {
        for (const entry of CRON_SCHEDULES) {
            expect(
                VALID_CATEGORIES.has(entry.category),
                `Manifest entry "${entry.name}" has invalid category "${entry.category}"`
            ).toBe(true);
        }
    });
});
