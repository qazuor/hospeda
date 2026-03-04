import { z } from 'zod';

/**
 * Schema for updating global billing settings (admin operation).
 * All fields are optional — only the provided fields will be updated.
 *
 * @example
 * ```ts
 * const patch: UpdateBillingSettings = {
 *   trialEnabled: true,
 *   trialDurationDays: 14,
 *   defaultCurrency: 'ARS',
 * };
 * ```
 */
export const UpdateBillingSettingsSchema = z
    .object({
        /** Whether the free-trial feature is enabled platform-wide */
        trialEnabled: z
            .boolean({
                message: 'zodError.billing.settings.trialEnabled.invalidType'
            })
            .optional(),
        /** Default trial duration in days when a specific plan does not override it */
        trialDurationDays: z
            .number({
                message: 'zodError.billing.settings.trialDurationDays.invalidType'
            })
            .int({ message: 'zodError.billing.settings.trialDurationDays.int' })
            .min(1, { message: 'zodError.billing.settings.trialDurationDays.min' })
            .max(365, { message: 'zodError.billing.settings.trialDurationDays.max' })
            .optional(),
        /** Number of grace-period days granted after a payment failure before suspension */
        gracePeriodDays: z
            .number({
                message: 'zodError.billing.settings.gracePeriodDays.invalidType'
            })
            .int({ message: 'zodError.billing.settings.gracePeriodDays.int' })
            .min(0, { message: 'zodError.billing.settings.gracePeriodDays.min' })
            .max(90, { message: 'zodError.billing.settings.gracePeriodDays.max' })
            .optional(),
        /** ISO 4217 currency code used as the platform default (e.g. 'ARS') */
        defaultCurrency: z
            .string({
                message: 'zodError.billing.settings.defaultCurrency.invalidType'
            })
            .length(3, { message: 'zodError.billing.settings.defaultCurrency.length' })
            .optional(),
        /** Whether the billing integration is operating in live mode (true) or sandbox mode (false) */
        livemode: z
            .boolean({
                message: 'zodError.billing.settings.livemode.invalidType'
            })
            .optional()
    })
    .partial();

/** TypeScript type inferred from UpdateBillingSettingsSchema */
export type UpdateBillingSettings = z.infer<typeof UpdateBillingSettingsSchema>;
