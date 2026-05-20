/**
 * Pure-data manifest of cron jobs and their schedules.
 *
 * Exists alongside `registry.ts` so tooling that needs the
 * "(name, schedule)" pair can read it WITHOUT loading the job handlers.
 * The handlers transitively import workspace packages (`@repo/db`,
 * `@repo/billing`, …) whose CommonJS build artefacts use dynamic
 * `require()`, which is incompatible with the pure-ESM contexts where
 * a manifest is sometimes consumed (docs generators, validation
 * scripts, etc.).
 *
 * Single source of truth: this file. The cron registry imports it for
 * the `(name, schedule)` pair and tests assert that every entry here
 * matches a registered job and vice versa.
 *
 * Adding a job: append an entry below AND register the handler in
 * `registry.ts`. The sync test (`test/cron/schedules-manifest.test.ts`)
 * will fail loudly if either side is missing.
 *
 * @module cron/schedules.manifest
 */

/**
 * Metadata describing a single scheduled cron job.
 */
export interface CronScheduleEntry {
    /** Stable kebab-case identifier; matches `name` on the job definition. */
    readonly name: string;
    /** 5-field cron expression interpreted by the in-process node-cron scheduler. */
    readonly schedule: string;
    /** Human-readable summary used in admin dashboards and audit reports. */
    readonly description: string;
}

/**
 * Every cron job that should be provisioned at the external scheduler.
 * Order is irrelevant; the manifest is treated as a set keyed by `name`.
 */
export const CRON_SCHEDULES: ReadonlyArray<CronScheduleEntry> = [
    {
        name: 'abandoned-pending-subs',
        schedule: '0 * * * *',
        description:
            'Marks subscriptions stuck in pending_provider/incomplete past the 30-minute TTL as abandoned.'
    },
    {
        name: 'addon-expiry',
        schedule: '0 5 * * *',
        description: 'Expire addons whose subscription term has ended.'
    },
    {
        name: 'apply-scheduled-plan-changes',
        schedule: '*/15 * * * *',
        description:
            'Apply due scheduled plan changes (SPEC-141 D7 downgrade) on subscriptions whose period_end has passed.'
    },
    {
        name: 'archive-abandoned-drafts',
        schedule: '0 3 * * *',
        description: 'Archive accommodation drafts left untouched past the retention window.'
    },
    {
        name: 'archive-expired-promotions',
        schedule: '0 * * * *',
        description: 'Archive accommodation promotions whose end date has passed.'
    },
    {
        name: 'cloudinary-e2e-cleanup',
        schedule: '0 2 * * 0',
        description: 'Weekly cleanup of E2E test assets uploaded to Cloudinary.'
    },
    {
        name: 'conversation-notification',
        schedule: '*/5 * * * *',
        description: 'Notify hosts and guests of unread messages.'
    },
    {
        name: 'conversation-token-cleanup',
        schedule: '0 3 * * *',
        description: 'Purge expired guest conversation access tokens.'
    },
    {
        name: 'conversation-token-reminder',
        schedule: '0 9 * * *',
        description: 'Email guests with conversation access tokens nearing expiry.'
    },
    {
        name: 'dunning',
        schedule: '0 6 * * *',
        description: 'Retry past-due billing payments and notify customers.'
    },
    {
        name: 'exchange-rate-fetch',
        schedule: '*/15 * * * *',
        description: 'Refresh ARS / USD / EUR exchange rates from upstream APIs.'
    },
    {
        name: 'media-orphan-cleanup',
        schedule: '0 0 * * 0',
        description: 'Weekly sweep of orphaned media assets (no parent entity).'
    },
    {
        name: 'newsletter-close-campaigns',
        schedule: '*/5 * * * *',
        description:
            'Close newsletter campaigns whose deliveries have all resolved (status sending → sent).'
    },
    {
        name: 'notification-log-purge',
        schedule: '0 3 * * *',
        description: 'Drop notification log rows older than the retention window.'
    },
    {
        name: 'notification-schedule',
        schedule: '0 8 * * *',
        description: 'Dispatch scheduled notifications whose send-at has arrived.'
    },
    {
        name: 'page-revalidation',
        schedule: '0 * * * *',
        description: 'Force ISR revalidation of public pages on the web app.'
    },
    {
        name: 'search-index-refresh',
        schedule: '0 */6 * * *',
        description: 'Rebuild the materialized search index used for fuzzy queries.'
    },
    {
        name: 'trial-expiry',
        schedule: '0 2 * * *',
        description: 'Expire trial subscriptions whose period has ended.'
    },
    {
        name: 'trial-pre-end-notif',
        schedule: '0 13 * * *',
        description: 'Daily reminder emails for trials ending in 1-3 days (D-3 and D-1 variants).'
    },
    {
        name: 'webhook-retry',
        schedule: '0 */1 * * *',
        description: 'Retry failed outbound webhook deliveries.'
    }
];
