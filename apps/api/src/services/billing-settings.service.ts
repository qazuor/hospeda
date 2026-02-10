/**
 * Billing Settings Service
 *
 * Manages billing configuration settings for the Hospeda platform.
 * Settings are stored in the billing_audit_logs table as special entries
 * (action: 'billing_settings_update') to leverage the existing schema without migration.
 *
 * Features:
 * - Trial configuration (owner/complex trial days, auto-block)
 * - Grace period settings
 * - Payment configuration (currency, tax rate)
 * - Retry settings (max retries, retry intervals)
 * - Notification settings (trial expiry, payment failed, etc.)
 *
 * @module services/billing-settings
 */

import { and, billingAuditLogs, desc, eq, getDb } from '@repo/db';
import { apiLogger } from '../utils/logger';

/**
 * Billing settings configuration
 */
export interface BillingSettings {
    /** Trial period duration for owners (in days) */
    ownerTrialDays: number;
    /** Trial period duration for complexes (in days) */
    complexTrialDays: number;
    /** Automatically block access when trial expires */
    trialAutoBlock: boolean;

    /** Grace period after payment failure (in days) */
    gracePeriodDays: number;

    /** Default currency for payments (ISO 4217 code) */
    currency: string;
    /** Tax rate as percentage (0-100) */
    taxRate: number;

    /** Maximum number of payment retry attempts */
    maxPaymentRetries: number;
    /** Interval between retry attempts (in hours) */
    retryIntervalHours: number;

    /** Send reminder notification before trial expiry */
    sendTrialExpiryReminder: boolean;
    /** Days before trial expiry to send reminder */
    trialExpiryReminderDays: number;
    /** Send notification when payment fails */
    sendPaymentFailedNotification: boolean;
    /** Send notification when subscription is cancelled */
    sendSubscriptionCancelledNotification: boolean;
}

/**
 * Default billing settings
 * Used when no custom settings are found or on reset
 */
const DEFAULT_SETTINGS: BillingSettings = {
    ownerTrialDays: 14,
    complexTrialDays: 28,
    trialAutoBlock: true,
    gracePeriodDays: 3,
    currency: 'ARS',
    taxRate: 21,
    maxPaymentRetries: 3,
    retryIntervalHours: 24,
    sendTrialExpiryReminder: true,
    trialExpiryReminderDays: 3,
    sendPaymentFailedNotification: true,
    sendSubscriptionCancelledNotification: true
};

/** Module-level singleton instance */
let instance: BillingSettingsService | null = null;

/**
 * Get the singleton instance of BillingSettingsService.
 *
 * Creates the instance on first call (lazy initialization).
 *
 * @returns The singleton BillingSettingsService instance
 */
export function getBillingSettingsService(): BillingSettingsService {
    if (!instance) {
        instance = new BillingSettingsService();
    }
    return instance;
}

/**
 * Reset the singleton instance.
 * Intended for testing only.
 */
export function resetBillingSettingsService(): void {
    instance = null;
}

/**
 * Service for managing billing settings.
 *
 * Stateless service that accesses the database via getDb() per call.
 * Use getBillingSettingsService() to get the singleton instance.
 */
export class BillingSettingsService {
    /**
     * Get current billing settings
     * Returns merged settings (custom + defaults for missing keys)
     *
     * @returns Current billing settings
     */
    async getSettings(): Promise<BillingSettings> {
        try {
            const db = getDb();

            // Query latest settings entry from audit logs
            const settingsEntries = await db
                .select()
                .from(billingAuditLogs)
                .where(
                    and(
                        eq(billingAuditLogs.action, 'billing_settings_update'),
                        eq(billingAuditLogs.entityType, 'settings'),
                        eq(billingAuditLogs.entityId, 'global')
                    )
                )
                .orderBy(desc(billingAuditLogs.createdAt))
                .limit(1);

            // If no custom settings found, return defaults
            if (!settingsEntries || settingsEntries.length === 0) {
                apiLogger.debug('No custom billing settings found, using defaults');
                return DEFAULT_SETTINGS;
            }

            const latestEntry = settingsEntries[0];
            if (!latestEntry) {
                apiLogger.debug('No settings entry found, using defaults');
                return DEFAULT_SETTINGS;
            }

            // Parse changes as settings object
            const customSettings =
                latestEntry.changes as unknown as Partial<BillingSettings> | null;

            if (!customSettings || typeof customSettings !== 'object') {
                apiLogger.warn('Invalid settings format, using defaults');
                return DEFAULT_SETTINGS;
            }

            // Merge with defaults to fill any missing keys
            const mergedSettings: BillingSettings = {
                ...DEFAULT_SETTINGS,
                ...customSettings
            };

            apiLogger.debug({ mergedSettings }, 'Retrieved billing settings');
            return mergedSettings;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage
                },
                'Failed to get billing settings'
            );

            // Return safe defaults on error
            return DEFAULT_SETTINGS;
        }
    }

    /**
     * Update billing settings (partial update)
     * Merges with current settings and validates values
     *
     * @param patch - Partial settings to update
     * @param actorId - ID of user performing the update (optional)
     * @returns Updated billing settings
     */
    async updateSettings(
        patch: Partial<BillingSettings>,
        actorId?: string
    ): Promise<BillingSettings> {
        try {
            // Get current settings
            const currentSettings = await this.getSettings();

            // Merge with patch
            const updatedSettings: BillingSettings = {
                ...currentSettings,
                ...patch
            };

            // Validate values
            this.validateSettings(updatedSettings);

            const db = getDb();

            // Insert new audit log entry with updated settings
            await db.insert(billingAuditLogs).values({
                action: 'billing_settings_update',
                entityType: 'settings',
                entityId: 'global',
                actorId: actorId || null,
                actorType: actorId ? 'admin' : 'system',
                changes: updatedSettings as unknown,
                previousValues: currentSettings as unknown,
                livemode: true,
                ipAddress: null,
                userAgent: null
            });

            apiLogger.info(
                {
                    actorId,
                    updatedFields: Object.keys(patch),
                    updatedSettings
                },
                'Billing settings updated successfully'
            );

            return updatedSettings;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    patch,
                    actorId,
                    error: errorMessage
                },
                'Failed to update billing settings'
            );

            throw error;
        }
    }

    /**
     * Reset billing settings to defaults
     *
     * @param actorId - ID of user performing the reset (optional)
     * @returns Default billing settings
     */
    async resetSettings(actorId?: string): Promise<BillingSettings> {
        try {
            const db = getDb();

            // Insert new audit log entry with default settings
            await db.insert(billingAuditLogs).values({
                action: 'billing_settings_reset',
                entityType: 'settings',
                entityId: 'global',
                actorId: actorId || null,
                actorType: actorId ? 'admin' : 'system',
                changes: DEFAULT_SETTINGS as unknown,
                previousValues: null,
                livemode: true,
                ipAddress: null,
                userAgent: null
            });

            apiLogger.info(
                {
                    actorId
                },
                'Billing settings reset to defaults'
            );

            return DEFAULT_SETTINGS;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    actorId,
                    error: errorMessage
                },
                'Failed to reset billing settings'
            );

            throw error;
        }
    }

    /**
     * Validate billing settings values
     * Throws error if validation fails
     *
     * @param settings - Settings to validate
     */
    private validateSettings(settings: BillingSettings): void {
        const errors: string[] = [];

        // Validate trial days
        if (settings.ownerTrialDays < 1 || settings.ownerTrialDays > 90) {
            errors.push('ownerTrialDays must be between 1 and 90');
        }
        if (settings.complexTrialDays < 1 || settings.complexTrialDays > 90) {
            errors.push('complexTrialDays must be between 1 and 90');
        }

        // Validate grace period
        if (settings.gracePeriodDays < 0 || settings.gracePeriodDays > 30) {
            errors.push('gracePeriodDays must be between 0 and 30');
        }

        // Validate currency (basic check for 3-letter code)
        if (settings.currency.length !== 3) {
            errors.push('currency must be a 3-letter ISO 4217 code');
        }

        // Validate tax rate
        if (settings.taxRate < 0 || settings.taxRate > 100) {
            errors.push('taxRate must be between 0 and 100');
        }

        // Validate retry settings
        if (settings.maxPaymentRetries < 0 || settings.maxPaymentRetries > 10) {
            errors.push('maxPaymentRetries must be between 0 and 10');
        }
        if (settings.retryIntervalHours < 1 || settings.retryIntervalHours > 168) {
            errors.push('retryIntervalHours must be between 1 and 168 (1 week)');
        }

        // Validate reminder days
        if (settings.trialExpiryReminderDays < 1 || settings.trialExpiryReminderDays > 30) {
            errors.push('trialExpiryReminderDays must be between 1 and 30');
        }

        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }
    }
}
