import { z } from 'zod';
import { I18nTextSchema } from '../../../common/i18n.schema.js';

/**
 * Climate seasons for a destination.
 *
 * Used as the `bestSeason` value and as the keys of the per-season climate map.
 */
export const ClimateSeasonEnum = z.enum(['spring', 'summer', 'autumn', 'winter']);
export type ClimateSeason = z.infer<typeof ClimateSeasonEnum>;

/**
 * Calendar months, used as the endpoints of the recommended-months range.
 *
 * Stored as locale-independent keys so the UI can render localized month names
 * (web + admin) instead of a hard-coded free-text label.
 */
export const ClimateMonthEnum = z.enum([
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec'
]);
export type ClimateMonth = z.infer<typeof ClimateMonthEnum>;

/**
 * Recommended-months range to visit a destination.
 *
 * Both endpoints are inclusive month keys; the range may wrap the year boundary
 * (e.g. `from: 'oct'`, `to: 'mar'`). Rendered as localized month names.
 */
export const DestinationBestMonthsSchema = z.object({
    from: ClimateMonthEnum,
    to: ClimateMonthEnum
});
export type DestinationBestMonths = z.infer<typeof DestinationBestMonthsSchema>;

/**
 * Per-season climate averages.
 *
 * Temperatures are integer Celsius (may be negative). Rainfall is integer
 * millimetres and optional. Values are approximate, hand-derived offline from
 * the Open-Meteo Climate API, and admin-editable.
 */
export const DestinationSeasonClimateSchema = z.object({
    avgTempMinC: z
        .number()
        .int({ message: 'zodError.destination.climate.avgTempMinC.int' })
        .min(-60, { message: 'zodError.destination.climate.avgTempMinC.min' })
        .max(60, { message: 'zodError.destination.climate.avgTempMinC.max' }),
    avgTempMaxC: z
        .number()
        .int({ message: 'zodError.destination.climate.avgTempMaxC.int' })
        .min(-60, { message: 'zodError.destination.climate.avgTempMaxC.min' })
        .max(60, { message: 'zodError.destination.climate.avgTempMaxC.max' }),
    rainfallMm: z
        .number()
        .int({ message: 'zodError.destination.climate.rainfallMm.int' })
        .min(0, { message: 'zodError.destination.climate.rainfallMm.min' })
        .max(20000, { message: 'zodError.destination.climate.rainfallMm.max' })
        .optional()
});
export type DestinationSeasonClimate = z.infer<typeof DestinationSeasonClimateSchema>;

/**
 * Structured seasonal climate for a destination.
 *
 * Stored as a nullable JSONB column on `destinations`. Carries the best season
 * to visit, an optional free-text month label, per-season temperature/rainfall
 * averages, and an optional localized note.
 */
export const DestinationClimateSchema = z.object({
    bestSeason: ClimateSeasonEnum,
    bestMonths: DestinationBestMonthsSchema.optional(),
    seasons: z.object({
        spring: DestinationSeasonClimateSchema.optional(),
        summer: DestinationSeasonClimateSchema.optional(),
        autumn: DestinationSeasonClimateSchema.optional(),
        winter: DestinationSeasonClimateSchema.optional()
    }),
    note: I18nTextSchema.nullish()
});
export type DestinationClimateInput = z.infer<typeof DestinationClimateSchema>;
