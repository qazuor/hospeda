/**
 * Cron Job Registry
 * Central registry for all scheduled jobs in the system
 * @module cron/registry
 */

import {
    abandonedPendingSubsJob,
    addonExpiryJob,
    alertsDigestJob,
    appLogPurgeJob,
    applyScheduledPlanChangesJob,
    archiveAbandonedDraftsJob,
    archiveExpiredPromotionsJob,
    calendarSyncGoogleJob,
    calendarSyncIcalJob,
    cloudinaryE2eCleanupJob,
    conversationNotificationJob,
    conversationTokenCleanupJob,
    conversationTokenReminderJob,
    courtesyExpiryJob,
    cronRunPurgeJob,
    destinationWeatherFetchJob,
    dunningJob,
    entitySubscriptionCacheReconcileJob,
    entityViewsPurgeJob,
    exchangeRateFetchJob,
    featuredByEntitlementReconcileJob,
    finalizeCancelledSubsJob,
    hostTradeStatsReconcileJob,
    hostTradeUsageExpiryJob,
    hostTradeUsageReminderJob,
    leadIntakeBackstopJob,
    mediaOrphanCleanupJob,
    newsletterCloseCampaignsJob,
    notificationLogPurgeJob,
    notificationScheduleJob,
    pageRevalidationJob,
    partnerExpiryJob,
    partnerUnpaidReaperJob,
    pollApifyReputationRunsJob,
    preapprovalLessExpiryJob,
    propagatePlanPriceChangesJob,
    reactivationSupersessionReconcileJob,
    refreshExternalReputationJob,
    searchIndexRefreshJob,
    socialPublishDispatchJob,
    subscriptionPollJob,
    trialExpiryJob,
    viewMonthlyRollupJob,
    webhookRetryJob
} from './jobs/index.js';
import type { CronJobDefinition } from './types';

/**
 * Registry of all cron jobs
 * Jobs are registered by importing and adding them to this array
 */
export const cronJobs: CronJobDefinition[] = [
    trialExpiryJob,
    webhookRetryJob,
    notificationScheduleJob,
    addonExpiryJob,
    courtesyExpiryJob,
    alertsDigestJob,
    exchangeRateFetchJob,
    destinationWeatherFetchJob,
    dunningJob,
    searchIndexRefreshJob,
    calendarSyncGoogleJob,
    calendarSyncIcalJob,
    notificationLogPurgeJob,
    pageRevalidationJob,
    archiveExpiredPromotionsJob,
    archiveAbandonedDraftsJob,
    leadIntakeBackstopJob,
    mediaOrphanCleanupJob,
    cloudinaryE2eCleanupJob,
    conversationNotificationJob,
    conversationTokenReminderJob,
    conversationTokenCleanupJob,
    newsletterCloseCampaignsJob,
    abandonedPendingSubsJob,
    applyScheduledPlanChangesJob,
    propagatePlanPriceChangesJob,
    finalizeCancelledSubsJob,
    subscriptionPollJob,
    cronRunPurgeJob,
    appLogPurgeJob,
    hostTradeStatsReconcileJob,
    hostTradeUsageExpiryJob,
    hostTradeUsageReminderJob,
    entityViewsPurgeJob,
    // Must be registered alongside the purge, not later: it is the only thing
    // that survives it (HOS-1063 A-6, R-4).
    viewMonthlyRollupJob,
    refreshExternalReputationJob,
    socialPublishDispatchJob,
    pollApifyReputationRunsJob,
    partnerExpiryJob,
    partnerUnpaidReaperJob,
    entitySubscriptionCacheReconcileJob,
    featuredByEntitlementReconcileJob,
    reactivationSupersessionReconcileJob,
    preapprovalLessExpiryJob
];

/**
 * Get a cron job by name
 *
 * @param name - Unique name of the job
 * @returns Job definition if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const job = getCronJob('cleanup-sessions');
 * if (job) {
 *   console.log(`Found job: ${job.description}`);
 * }
 * ```
 */
export const getCronJob = (name: string): CronJobDefinition | undefined => {
    return cronJobs.find((job) => job.name === name);
};

/**
 * Get all enabled cron jobs
 *
 * @returns Array of enabled job definitions
 *
 * @example
 * ```typescript
 * const enabledJobs = getEnabledCronJobs();
 * console.log(`${enabledJobs.length} jobs are enabled`);
 * ```
 */
export const getEnabledCronJobs = (): CronJobDefinition[] => {
    return cronJobs.filter((job) => job.enabled);
};
