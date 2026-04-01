import type { z } from 'zod';
import { ExchangeRateConfigSchema } from './exchange-rate-config.schema.js';
import { ExchangeRateSchema } from './exchange-rate.schema.js';

// ============================================================================
// EXCHANGE RATE ACCESS SCHEMAS
// ============================================================================

/**
 * PUBLIC ACCESS SCHEMA — ExchangeRate
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public currency conversion display (e.g., price widgets).
 *
 * Picks the currency pair, rate values, rate type, and fetch timestamp.
 * Source and expiry are withheld from public consumers.
 */
export const ExchangeRatePublicSchema = ExchangeRateSchema.pick({
    // Identification
    id: true,

    // Currency pair
    fromCurrency: true,
    toCurrency: true,

    // Rate values
    rate: true,
    inverseRate: true,

    // Rate metadata (type only — not the internal source)
    rateType: true,

    // When the rate was fetched (useful for display freshness indicators)
    fetchedAt: true
});

export type ExchangeRatePublic = z.infer<typeof ExchangeRatePublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA — ExchangeRate
 *
 * Contains data for authenticated users, including source, expiry, and audit timestamps.
 * Used for authenticated views or integrations that need to understand rate validity.
 *
 * Extends public fields with internal metadata.
 */
export const ExchangeRateProtectedSchema = ExchangeRateSchema.pick({
    // All public fields
    id: true,
    fromCurrency: true,
    toCurrency: true,
    rate: true,
    inverseRate: true,
    rateType: true,
    fetchedAt: true,

    // Internal metadata for authenticated consumers
    source: true,
    expiresAt: true,

    // Audit timestamps
    createdAt: true,
    updatedAt: true
});

export type ExchangeRateProtected = z.infer<typeof ExchangeRateProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA — ExchangeRate
 *
 * Contains ALL fields including internal flags.
 * Used for admin dashboard and management.
 *
 * This is essentially the full schema.
 */
export const ExchangeRateAdminSchema = ExchangeRateSchema;

export type ExchangeRateAdmin = z.infer<typeof ExchangeRateAdminSchema>;

// ============================================================================
// EXCHANGE RATE CONFIG ACCESS SCHEMAS
// ============================================================================

/**
 * PUBLIC ACCESS SCHEMA — ExchangeRateConfig
 *
 * Exposes only the fields relevant to end-user display:
 * whether a conversion disclaimer should be shown and its text.
 * Internal fetch intervals and source configuration are withheld.
 */
export const ExchangeRateConfigPublicSchema = ExchangeRateConfigSchema.pick({
    // Identification
    id: true,

    // Display settings safe for public consumers
    showConversionDisclaimer: true,
    disclaimerText: true
});

export type ExchangeRateConfigPublic = z.infer<typeof ExchangeRateConfigPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA — ExchangeRateConfig
 *
 * Exposes public fields plus the default rate type.
 * Authenticated users (e.g., contributors) may need to know which rate type is active.
 * Internal scheduling intervals remain admin-only.
 */
export const ExchangeRateConfigProtectedSchema = ExchangeRateConfigSchema.pick({
    // All public fields
    id: true,
    showConversionDisclaimer: true,
    disclaimerText: true,

    // Rate type is useful for authenticated views
    defaultRateType: true,

    // Audit timestamp
    updatedAt: true
});

export type ExchangeRateConfigProtected = z.infer<typeof ExchangeRateConfigProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA — ExchangeRateConfig
 *
 * Contains ALL configuration fields.
 * Used for admin dashboard where operators manage fetch intervals and toggle auto-fetch.
 *
 * This is essentially the full schema.
 */
export const ExchangeRateConfigAdminSchema = ExchangeRateConfigSchema;

export type ExchangeRateConfigAdmin = z.infer<typeof ExchangeRateConfigAdminSchema>;
