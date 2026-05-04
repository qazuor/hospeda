#!/usr/bin/env node
/**
 * Provisions (or updates) Upstash QStash schedules for every enabled job
 * in the Hospeda cron registry.
 *
 * Reads the canonical job list from `apps/api/src/cron/registry` so the
 * schedules in QStash are always in sync with the code. Each schedule
 * targets `${HOSPEDA_API_URL}/api/v1/cron/${job.name}` with the cron
 * expression declared on the job definition.
 *
 * The script is idempotent: existing schedules with the same destination
 * URL are updated in place; new ones are created. Schedules in QStash
 * that no longer have a matching job are deleted to keep the scheduler
 * tidy.
 *
 * Required env vars:
 *   - QSTASH_TOKEN — Upstash QStash bearer token
 *   - HOSPEDA_API_URL — base URL of the deployed API (e.g.
 *     https://hospeda-api.vercel.app)
 *
 * Usage:
 *   pnpm tsx scripts/setup-qstash-schedules.ts
 *   pnpm tsx scripts/setup-qstash-schedules.ts --dry-run
 */

import { Client } from '@upstash/qstash';
import { cronJobs } from '../apps/api/src/cron/registry.js';

const dryRun = process.argv.includes('--dry-run');

const token = process.env.QSTASH_TOKEN;
const apiUrl = process.env.HOSPEDA_API_URL;

if (!token) {
    console.error('Missing QSTASH_TOKEN env var. Get it from https://console.upstash.com/qstash');
    process.exit(1);
}

if (!apiUrl) {
    console.error('Missing HOSPEDA_API_URL env var. Set it to your deployed API base URL.');
    process.exit(1);
}

const baseUrl = apiUrl.replace(/\/$/, '');
const enabledJobs = cronJobs.filter((job) => job.enabled);

console.log(
    `Provisioning ${enabledJobs.length} QStash schedule(s) targeting ${baseUrl}/api/v1/cron/*${dryRun ? ' (dry-run)' : ''}`
);

const client = new Client({ token });

// Upstash QStash deduplicates schedules by destination URL when you POST
// with the same destination + cron pair. Create them all in parallel.
const desiredByDestination = new Map<string, (typeof enabledJobs)[number]>();
for (const job of enabledJobs) {
    desiredByDestination.set(`${baseUrl}/api/v1/cron/${job.name}`, job);
}

let created = 0;
let updated = 0;
let removed = 0;

const existing = await client.schedules.list();
const existingByDestination = new Map<string, (typeof existing)[number]>();
for (const schedule of existing) {
    if (schedule.destination) {
        existingByDestination.set(schedule.destination, schedule);
    }
}

// Upsert: for every desired job, create-or-update the schedule pointing
// at its endpoint. QStash's `schedules.create` replaces the cron when
// (destination, body) collide, so we delete the previous schedule first
// for clarity and predictable IDs in the dashboard.
for (const [destination, job] of desiredByDestination) {
    const previous = existingByDestination.get(destination);

    if (previous) {
        if (dryRun) {
            console.log(`  ↻ ${job.name}  (would update: ${previous.cron} → ${job.schedule})`);
        } else {
            await client.schedules.delete(previous.scheduleId);
            await client.schedules.create({
                destination,
                cron: job.schedule,
                method: 'POST',
                retries: 3
            });
            console.log(`  ↻ ${job.name}  (cron: ${job.schedule})`);
            updated++;
        }
    } else {
        if (dryRun) {
            console.log(`  + ${job.name}  (would create: ${job.schedule})`);
        } else {
            await client.schedules.create({
                destination,
                cron: job.schedule,
                method: 'POST',
                retries: 3
            });
            console.log(`  + ${job.name}  (cron: ${job.schedule})`);
            created++;
        }
    }
}

// Remove schedules that no longer have a job in the registry but point
// at our cron endpoint pattern. This avoids orphaned schedules firing
// against deleted jobs.
const cronEndpointPrefix = `${baseUrl}/api/v1/cron/`;
for (const [destination, schedule] of existingByDestination) {
    if (destination.startsWith(cronEndpointPrefix) && !desiredByDestination.has(destination)) {
        if (dryRun) {
            console.log(`  - ${destination}  (would delete orphan)`);
        } else {
            await client.schedules.delete(schedule.scheduleId);
            console.log(`  - ${destination}  (deleted orphan)`);
            removed++;
        }
    }
}

console.log(
    dryRun
        ? `\nDry-run complete. ${desiredByDestination.size} schedule(s) inspected.`
        : `\nDone: ${created} created, ${updated} updated, ${removed} removed.`
);
