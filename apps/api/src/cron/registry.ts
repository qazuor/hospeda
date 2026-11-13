/**
 * Cron Job Registry
 * Central registry for all scheduled jobs in the system
 * @module cron/registry
 */

import {
    aiListingQuestionsRetentionJob,
    aiQuestionsWeeklyDigestJob,
    alertsDigestJob,
    appLogPurgeJob,
    archiveExpiredPromotionsJob,
    billingCreationsSweepJob,
    billingDeferredCancellationRetryJob,
    billingPromoEndingNoticeJob,
    billingReconciliationSummaryJob,
    billingReconciliationSweepJob,
    calendarSyncGoogleJob,
    calendarSyncIcalJob,
    cloudinaryE2eCleanupJob,
    conversationNotificationJob,
    conversationTokenCleanupJob,
    conversationTokenReminderJob,
    cronRunPurgeJob,
    destinationWeatherFetchJob,
    emailOutboxSenderJob,
    entityViewsPurgeJob,
    exchangeRateFetchJob,
    hostTradeStatsReconcileJob,
    hostTradeUsageExpiryJob,
    hostTradeUsageReminderJob,
    leadIntakeBackstopJob,
    listingCoverageReconcilerJob,
    listingInactivityArchiveJob,
    listingRemoteDeletionRetryJob,
    listingRetentionPassJob,
    manualGraceExpiryJob,
    manualInstallmentOpenJob,
    mediaOrphanCleanupJob,
    newsletterCloseCampaignsJob,
    notificationLogPurgeJob,
    notificationScheduleJob,
    pageRevalidationJob,
    paymentWindowExpiryJob,
    planMigrationApplicationJob,
    planMigrationNoticeJob,
    pollApifyReputationRunsJob,
    providerNotificationRetentionJob,
    refreshExternalReputationJob,
    searchIndexRefreshJob,
    socialPublishDispatchJob,
    subscriptionGraceReminderJob,
    subscriptionPauseEndJob,
    subscriptionRenewalNoticeJob,
    subscriptionScheduledChangeJob,
    subscriptionServiceEndJob,
    subscriptionSuccessionReevaluationJob,
    subscriptionWindowExpiryJob,
    trialMachineExpiryJob,
    viewMonthlyRollupJob
} from './jobs/index.js';
import type { CronJobDefinition } from './types';

/**
 * Registry of all cron jobs
 * Jobs are registered by importing and adding them to this array
 */
export const cronJobs: CronJobDefinition[] = [
    billingReconciliationSweepJob,
    billingReconciliationSummaryJob,
    billingCreationsSweepJob,
    billingDeferredCancellationRetryJob,
    billingPromoEndingNoticeJob,
    providerNotificationRetentionJob,
    alertsDigestJob,
    exchangeRateFetchJob,
    destinationWeatherFetchJob,
    searchIndexRefreshJob,
    calendarSyncGoogleJob,
    calendarSyncIcalJob,
    pageRevalidationJob,
    archiveExpiredPromotionsJob,
    leadIntakeBackstopJob,
    mediaOrphanCleanupJob,
    manualInstallmentOpenJob,
    manualGraceExpiryJob,
    cloudinaryE2eCleanupJob,
    conversationNotificationJob,
    conversationTokenReminderJob,
    conversationTokenCleanupJob,
    newsletterCloseCampaignsJob,
    notificationLogPurgeJob,
    notificationScheduleJob,
    // HOS-1423: the email outbox sender (unit U2).
    emailOutboxSenderJob,
    cronRunPurgeJob,
    appLogPurgeJob,
    hostTradeStatsReconcileJob,
    hostTradeUsageExpiryJob,
    hostTradeUsageReminderJob,
    paymentWindowExpiryJob,
    planMigrationApplicationJob,
    planMigrationNoticeJob,
    subscriptionServiceEndJob,
    subscriptionPauseEndJob,
    subscriptionScheduledChangeJob,
    subscriptionSuccessionReevaluationJob,
    subscriptionRenewalNoticeJob,
    subscriptionGraceReminderJob,
    subscriptionWindowExpiryJob,
    trialMachineExpiryJob,
    entityViewsPurgeJob,
    // Must be registered alongside the purge, not later: it is the only thing
    // that survives it (HOS-1063 A-6, R-4).
    viewMonthlyRollupJob,
    refreshExternalReputationJob,
    socialPublishDispatchJob,
    pollApifyReputationRunsJob,
    listingCoverageReconcilerJob,
    listingInactivityArchiveJob,
    listingRemoteDeletionRetryJob,
    listingRetentionPassJob,
    // HOS-2101: the host AI questions panel's 12-month retention and weekly digest.
    aiListingQuestionsRetentionJob,
    aiQuestionsWeeklyDigestJob
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
