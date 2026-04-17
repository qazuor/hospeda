/**
 * Billing Settings Service
 *
 * Manages billing configuration settings for the Hospeda platform.
 * Settings are stored in the `billing_settings` table (key-value pattern).
 * Updates are also recorded in `billing_audit_logs` for audit trail.
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

import { billingAuditLogs, billingSettings, eq, getDb, withTransaction } from '@repo/db';
import type { QueryContext } from '@repo/db';

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

/** Key used for the global settings row in billing_settings table */
const SETTINGS_KEY = 'global';

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
     * Get current billing settings.
     * Reads from the `billing_settings` table (key='global').
     * Returns merged settings (custom + defaults for missing keys).
     *
     * @param ctx - Optional query context. When `ctx.tx` is provided, the query
     *   runs inside that transaction instead of using the default connection.
     * @returns Current billing settings
     */
    async getSettings(ctx?: QueryContext): Promise<BillingSettings> {
        try {
            const db = ctx?.tx ?? getDb();

            const [row] = await db
                .select()
                .from(billingSettings)
                .where(eq(billingSettings.key, SETTINGS_KEY))
                .limit(1);

            if (!row) {
                return DEFAULT_SETTINGS;
            }

            const customSettings = row.value as Partial<BillingSettings> | null;

            if (!customSettings || typeof customSettings !== 'object') {
                return DEFAULT_SETTINGS;
            }

            const mergedSettings: BillingSettings = {
                ...DEFAULT_SETTINGS,
                ...customSettings
            };

            return mergedSettings;
        } catch (_error) {
            // Return safe defaults on error
            return DEFAULT_SETTINGS;
        }
    }

    /**
     * Update billing settings (partial update).
     * Merges with current settings, validates, upserts into `billing_settings`,
     * and records an audit trail in `billing_audit_logs`.
     *
     * @param patch - Partial settings to update
     * @param actorId - ID of user performing the update (optional)
     * @param ctx - Optional query context. When `ctx.tx` is provided, the
     *   internal `getSettings()` read uses that transaction so the entire
     *   read-modify-write cycle participates in the same boundary.
     * @returns Updated billing settings
     */
    async updateSettings(
        patch: Partial<BillingSettings>,
        actorId?: string,
        ctx?: QueryContext
    ): Promise<BillingSettings> {
        const currentSettings = await this.getSettings(ctx);

        const updatedSettings: BillingSettings = {
            ...currentSettings,
            ...patch
        };

        this.validateSettings(updatedSettings);

        await withTransaction(async (tx) => {
            // Upsert into billing_settings (primary storage)
            await tx
                .insert(billingSettings)
                .values({
                    key: SETTINGS_KEY,
                    value: updatedSettings as unknown as Record<string, unknown>,
                    updatedBy: actorId ?? null,
                    updatedAt: new Date()
                })
                .onConflictDoUpdate({
                    target: billingSettings.key,
                    set: {
                        value: updatedSettings as unknown as Record<string, unknown>,
                        updatedBy: actorId ?? null,
                        updatedAt: new Date()
                    }
                });

            // Record in audit log for trail (not as primary storage)
            await tx.insert(billingAuditLogs).values({
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
        });

        return updatedSettings;
    }

    /**
     * Reset billing settings to defaults.
     * Updates `billing_settings` with DEFAULT_SETTINGS and records an audit entry.
     *
     * @param actorId - ID of user performing the reset (optional)
     * @param ctx - Optional query context. Reserved for API consistency with the
     *   other methods. Because `resetSettings` always runs its own
     *   `withTransaction`, the `ctx` parameter is accepted but not forwarded to
     *   the internal transaction boundary.
     * @returns Default billing settings
     */
    async resetSettings(actorId?: string, ctx?: QueryContext): Promise<BillingSettings> {
        void ctx; // accepted for API consistency; withTransaction manages its own boundary
        await withTransaction(async (tx) => {
            // Upsert defaults into billing_settings
            await tx
                .insert(billingSettings)
                .values({
                    key: SETTINGS_KEY,
                    value: DEFAULT_SETTINGS as unknown as Record<string, unknown>,
                    updatedBy: actorId ?? null,
                    updatedAt: new Date()
                })
                .onConflictDoUpdate({
                    target: billingSettings.key,
                    set: {
                        value: DEFAULT_SETTINGS as unknown as Record<string, unknown>,
                        updatedBy: actorId ?? null,
                        updatedAt: new Date()
                    }
                });

            // Record in audit log
            await tx.insert(billingAuditLogs).values({
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
        });

        return DEFAULT_SETTINGS;
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
