/**
 * Public error reasons of the listing translation endpoints (HOS-2658).
 *
 * @module services/translation/listing-translation-errors
 */

/**
 * `VALIDATION_ERROR` reason when "Traducir con IA" is asked for a field whose
 * Spanish source is empty (AC-20). Its `details` (`{ reason }`) are published
 * with debug errors off, gated on this exact top-level reason
 * (`handleRouteError`, `apps/api/docs/error-contract.md`).
 */
export const NO_SOURCE_TEXT_REASON = 'NO_SOURCE_TEXT' as const;
