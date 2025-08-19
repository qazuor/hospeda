// NOTE: This file is deprecated. Service-layer schemas for Destination
// have been centralized under @repo/schemas to establish a single source of truth.
// Keeping the file to avoid sudden import breaks during migration.
export {
    GetDestinationAccommodationsInputSchema,
    GetDestinationStatsInputSchema,
    GetDestinationSummaryInputSchema,
    type DestinationStats,
    type DestinationSummaryType,
    type GetDestinationAccommodationsInput,
    type GetDestinationStatsInput,
    type GetDestinationSummaryInput
} from '@repo/schemas';
