import type { z } from 'zod';
import { ExchangeRateConfigSchema } from './exchange-rate-config.schema.js';

/**
 * ExchangeRateConfig CRUD Schemas
 *
 * Simplified CRUD schemas for singleton configuration entity.
 * Only supports get and update operations (no create/delete/restore).
 *
 * Configuration is a singleton, meaning there is always exactly one row
 * that is initialized during database seeding and can only be modified.
 */

// ============================================================================
// GET SCHEMAS
// ============================================================================

/**
 * Schema for getting exchange rate configuration
 * Returns the complete configuration object
 */
export const ExchangeRateConfigGetOutputSchema = ExchangeRateConfigSchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating exchange rate configuration
 * All fields except id, updatedAt, and updatedById are optional (partial update)
 *
 * Supports updating:
 * - defaultRateType: Which ARS rate to use by default
 * - dolarApiFetchIntervalMinutes: How often to fetch from DolarAPI
 * - exchangeRateApiFetchIntervalHours: How often to fetch from ExchangeRateAPI
 * - showConversionDisclaimer: Whether to show disclaimer
 * - disclaimerText: Custom disclaimer text
 * - enableAutoFetch: Whether automatic fetching is enabled
 */
export const ExchangeRateConfigUpdateInputSchema = ExchangeRateConfigSchema.omit({
    id: true,
    updatedAt: true,
    updatedById: true
}).partial();

/**
 * Schema for config update response
 * Returns the complete updated configuration
 */
export const ExchangeRateConfigUpdateOutputSchema = ExchangeRateConfigSchema;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ExchangeRateConfigGetOutput = z.infer<typeof ExchangeRateConfigGetOutputSchema>;
export type ExchangeRateConfigUpdateInput = z.infer<typeof ExchangeRateConfigUpdateInputSchema>;
export type ExchangeRateConfigUpdateOutput = z.infer<typeof ExchangeRateConfigUpdateOutputSchema>;
