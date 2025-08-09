// NOTE: This file is deprecated. Service-layer schemas for Destination
// have been centralized under @repo/schemas to establish a single source of truth.
// Keeping the file to avoid sudden import breaks during migration.
export {
    GetAccommodationsInputSchema,
    GetStatsInputSchema,
    GetSummaryInputSchema,
    type DestinationStats,
    type DestinationSummaryType,
    type GetAccommodationsInput,
    type GetStatsInput,
    type GetSummaryInput
} from '@repo/schemas';
