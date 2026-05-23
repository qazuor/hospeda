/**
 * Cron Job Registry
 * Central registry for all scheduled jobs in the system
 * @module cron/registry
 */

import {
    abandonedPendingSubsJob,
    addonExpiryJob,
    applyScheduledPlanChangesJob,
    archiveAbandonedDraftsJob,
    archiveExpiredPromotionsJob,
    cloudinaryE2eCleanupJob,
    conversationNotificationJob,
    conversationTokenCleanupJob,
    conversationTokenReminderJob,
    dunningJob,
    exchangeRateFetchJob,
    mediaOrphanCleanupJob,
    newsletterCloseCampaignsJob,
    notificationLogPurgeJob,
    notificationScheduleJob,
    pageRevalidationJob,
    searchIndexRefreshJob,
    subscriptionPollJob,
    trialExpiryJob,
    trialPreEndNotifJob,
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
    exchangeRateFetchJob,
    dunningJob,
    searchIndexRefreshJob,
    notificationLogPurgeJob,
    pageRevalidationJob,
    archiveExpiredPromotionsJob,
    archiveAbandonedDraftsJob,
    mediaOrphanCleanupJob,
    cloudinaryE2eCleanupJob,
    conversationNotificationJob,
    conversationTokenReminderJob,
    conversationTokenCleanupJob,
    newsletterCloseCampaignsJob,
    trialPreEndNotifJob,
    abandonedPendingSubsJob,
    applyScheduledPlanChangesJob,
    subscriptionPollJob
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
