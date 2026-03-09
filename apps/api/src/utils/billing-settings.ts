/**
 * Billing Settings Loader Utility
 *
 * Provides a helper function for cron jobs and background tasks to load
 * billing settings from the database, falling back to compile-time defaults
 * from @repo/billing on error.
 *
 * This decouples cron jobs from hardcoded constants and allows runtime
 * configuration changes via the admin billing settings panel.
 *
 * @module utils/billing-settings
 */

import { DUNNING_GRACE_PERIOD_DAYS, DUNNING_RETRY_INTERVALS } from '@repo/billing';
import {
    type BillingSettings,
    getBillingSettingsService
} from '../services/billing-settings.service.js';
import { apiLogger } from './logger.js';

/**
 * Billing settings relevant to cron jobs, with compile-time fallback defaults.
 */
export interface CronBillingSettings {
    /** Grace period after payment failure (in days) */
    readonly gracePeriodDays: number;
    /** Maximum number of payment retry attempts */
    readonly maxPaymentRetries: number;
    /** Interval between retry attempts (in hours) */
    readonly retryIntervalHours: number;
    /** Days before trial expiry to send reminder */
    readonly trialExpiryReminderDays: number;
    /** Whether to send trial expiry reminders */
    readonly sendTrialExpiryReminder: boolean;
    /** Whether to send payment failed notifications */
    readonly sendPaymentFailedNotification: boolean;
}

/** Compile-time fallback defaults derived from @repo/billing constants */
const FALLBACK_DEFAULTS: CronBillingSettings = {
    gracePeriodDays: DUNNING_GRACE_PERIOD_DAYS,
    maxPaymentRetries: DUNNING_RETRY_INTERVALS.length,
    retryIntervalHours: 24,
    trialExpiryReminderDays: 3,
    sendTrialExpiryReminder: true,
    sendPaymentFailedNotification: true
} as const;

/**
 * Load billing settings from the database, falling back to compile-time
 * defaults from @repo/billing on any error.
 *
 * Intended for use in cron jobs (dunning, notification-schedule) to allow
 * runtime configuration of retry counts, intervals, grace periods, etc.
 *
 * @returns Billing settings for cron job configuration
 *
 * @example
 * ```ts
 * const settings = await loadBillingSettings();
 * const lifecycle = createSubscriptionLifecycle(billing, storage, {
 *     gracePeriodDays: settings.gracePeriodDays,
 *     // ...
 * });
 * ```
 */
export async function loadBillingSettings(): Promise<CronBillingSettings> {
    try {
        const service = getBillingSettingsService();
        const dbSettings: BillingSettings = await service.getSettings();

        return {
            gracePeriodDays: dbSettings.gracePeriodDays,
            maxPaymentRetries: dbSettings.maxPaymentRetries,
            retryIntervalHours: dbSettings.retryIntervalHours,
            trialExpiryReminderDays: dbSettings.trialExpiryReminderDays,
            sendTrialExpiryReminder: dbSettings.sendTrialExpiryReminder,
            sendPaymentFailedNotification: dbSettings.sendPaymentFailedNotification
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.warn(
            { error: errorMessage },
            'Failed to load billing settings from DB, using compile-time defaults'
        );

        return FALLBACK_DEFAULTS;
    }
}
