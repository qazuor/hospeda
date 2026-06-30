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

import type { CronCategory } from '@repo/schemas';

/**
 * Metadata describing a single scheduled cron job.
 */
export interface CronScheduleEntry {
    /** Stable kebab-case identifier; matches `name` on the job definition. */
    readonly name: string;
    /** Friendly, human-facing name shown in the admin UI. */
    readonly displayName: string;
    /** Functional category used to group jobs in the admin UI. */
    readonly category: CronCategory;
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
        displayName: 'Suscripciones abandonadas',
        category: 'billing',
        schedule: '0 * * * *',
        description:
            'Marks subscriptions stuck in pending_provider/incomplete past the 30-minute TTL as abandoned.'
    },
    {
        name: 'addon-expiry',
        displayName: 'Expiración de add-ons',
        category: 'billing',
        schedule: '0 5 * * *',
        description: 'Expire addons whose subscription term has ended.'
    },
    {
        name: 'app-log-purge',
        displayName: 'Purga de logs de aplicación',
        category: 'system',
        schedule: '0 5 * * *',
        description: 'Purge app_log_entries older than 30 days (WARN/ERROR only).'
    },
    {
        name: 'apply-scheduled-plan-changes',
        displayName: 'Cambios de plan programados',
        category: 'billing',
        schedule: '*/15 * * * *',
        description:
            'Apply due scheduled plan changes (SPEC-141 D7 downgrade) on subscriptions whose period_end has passed.'
    },
    {
        name: 'archive-abandoned-drafts',
        displayName: 'Archivar borradores abandonados',
        category: 'content',
        schedule: '0 3 * * *',
        description: 'Archive accommodation drafts left untouched past the retention window.'
    },
    {
        name: 'archive-expired-promotions',
        displayName: 'Archivar promociones vencidas',
        category: 'billing',
        schedule: '0 * * * *',
        description: 'Archive accommodation promotions whose end date has passed.'
    },
    {
        name: 'cloudinary-e2e-cleanup',
        displayName: 'Limpieza de assets E2E',
        category: 'media',
        schedule: '0 2 * * 0',
        description: 'Weekly cleanup of E2E test assets uploaded to Cloudinary.'
    },
    {
        name: 'conversation-notification',
        displayName: 'Aviso de mensajes',
        category: 'notifications',
        schedule: '*/5 * * * *',
        description: 'Notify hosts and guests of unread messages.'
    },
    {
        name: 'conversation-token-cleanup',
        displayName: 'Limpieza de tokens de chat',
        category: 'system',
        schedule: '0 3 * * *',
        description: 'Purge expired guest conversation access tokens.'
    },
    {
        name: 'conversation-token-reminder',
        displayName: 'Recordatorio de tokens de chat',
        category: 'notifications',
        schedule: '0 9 * * *',
        description: 'Email guests with conversation access tokens nearing expiry.'
    },
    {
        name: 'cron-run-purge',
        displayName: 'Purga del historial de crons',
        category: 'system',
        schedule: '0 4 * * *',
        description: 'Purge old cron run history (60-day success / 180-day failure retention).'
    },
    {
        name: 'dunning',
        displayName: 'Reintentos de cobro',
        category: 'billing',
        schedule: '0 6 * * *',
        description: 'Retry past-due billing payments and notify customers.'
    },
    {
        name: 'entity-views-purge',
        displayName: 'Purga de vistas de entidades',
        category: 'system',
        schedule: '30 3 * * *',
        description:
            'Hard-delete entity_views telemetry rows older than 95 days (30d analytics window + 65d buffer, GDPR-lite data minimisation, SPEC-159 T-011).'
    },
    {
        name: 'exchange-rate-fetch',
        displayName: 'Tipos de cambio',
        category: 'billing',
        schedule: '0 */3 * * *',
        description: 'Refresh ARS / USD / EUR exchange rates from upstream APIs.'
    },
    {
        name: 'destination-weather-fetch',
        displayName: 'Clima de destinos',
        category: 'content',
        schedule: '0 */12 * * *',
        description:
            'Refresh cached Open-Meteo weather (current + 16-day forecast) for published destinations with coordinates.'
    },
    {
        name: 'finalize-cancelled-subs',
        displayName: 'Finalizar suscripciones canceladas',
        category: 'billing',
        schedule: '30 4 * * *',
        description:
            'Finalizes soft-cancelled subscriptions whose current_period_end has elapsed: flips status to cancelled, revokes addons, clears entitlement cache (SPEC-147).'
    },
    {
        name: 'media-orphan-cleanup',
        displayName: 'Limpieza de medios huérfanos',
        category: 'media',
        schedule: '0 0 * * 0',
        description: 'Weekly sweep of orphaned media assets (no parent entity).'
    },
    {
        name: 'newsletter-close-campaigns',
        displayName: 'Cierre de campañas',
        category: 'notifications',
        schedule: '*/5 * * * *',
        description:
            'Close newsletter campaigns whose deliveries have all resolved (status sending → sent).'
    },
    {
        name: 'notification-log-purge',
        displayName: 'Purga de logs de notificaciones',
        category: 'notifications',
        schedule: '0 3 * * *',
        description: 'Drop notification log rows older than the retention window.'
    },
    {
        name: 'notification-schedule',
        displayName: 'Envío de notificaciones programadas',
        category: 'notifications',
        schedule: '0 8 * * *',
        description: 'Dispatch scheduled notifications whose send-at has arrived.'
    },
    {
        name: 'page-revalidation',
        displayName: 'Revalidación de páginas (ISR)',
        category: 'search-cache',
        schedule: '0 * * * *',
        description: 'Force ISR revalidation of public pages on the web app.'
    },
    {
        name: 'search-index-refresh',
        displayName: 'Refresco del índice de búsqueda',
        category: 'search-cache',
        schedule: '0 */6 * * *',
        description: 'Rebuild the materialized search index used for fuzzy queries.'
    },
    {
        name: 'subscription-poll',
        displayName: 'Sondeo de suscripciones (MP)',
        category: 'billing',
        schedule: '* * * * *',
        description:
            'Poll MercadoPago /preapproval/{id} for pending subscriptions to flip them to active when the subscription_preapproval webhook is delayed or lost (SPEC-143 Finding #17 fallback).'
    },
    {
        name: 'trial-expiry',
        displayName: 'Expiración de pruebas',
        category: 'billing',
        schedule: '0 2 * * *',
        description: 'Expire trial subscriptions whose period has ended.'
    },
    {
        name: 'trial-pre-end-notif',
        displayName: 'Aviso de fin de prueba',
        category: 'billing',
        schedule: '0 13 * * *',
        description: 'Daily reminder emails for trials ending in 1-3 days (D-3 and D-1 variants).'
    },
    {
        name: 'webhook-retry',
        displayName: 'Reintento de webhooks',
        category: 'system',
        schedule: '0 */1 * * *',
        description: 'Retry failed outbound webhook deliveries.'
    },
    {
        name: 'refresh-external-reputation',
        displayName: 'Refresco de reputación externa',
        category: 'content',
        schedule: '0 2 * * 1',
        description:
            'Weekly refresh of cached external platform reputation data (ratings, review counts, Google snippets) for accommodations with enabled external listings.'
    },
    {
        name: 'poll-apify-reputation-runs',
        displayName: 'Sondeo de runs de Apify (reputación)',
        category: 'content',
        schedule: '*/2 * * * *',
        description:
            'Checks the status of pending/running Apify actor runs for external reputation data and persists results when runs complete.'
    },
    {
        name: 'social-publish-dispatch',
        displayName: 'Despacho de publicaciones sociales',
        category: 'content',
        schedule: '*/5 * * * *',
        description:
            'Dispatch approved social post targets to Make.com for publication (SPEC-254 US-11). Skipped when HOSPEDA_MAKE_API_KEY is absent.'
    },
    {
        name: 'partner-expiry',
        displayName: 'Expiración de partners',
        category: 'billing',
        schedule: '15 4 * * *',
        description:
            'Archive partners whose endsAt has passed — backup safety net for missed MP webhooks (SPEC-271 T-271-12).'
    },
    {
        name: 'featured-by-plan-reconcile',
        displayName: 'Reconciliación de destacados por plan',
        category: 'billing',
        schedule: '0 */6 * * *',
        description:
            'Correct drift between accommodations.featuredByPlan and the FEATURED_LISTING billing entitlement (SPEC-292 T-006 backstop).'
    }
];
