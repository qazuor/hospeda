import { type VenueModel, venueModel } from '@repo/db';
import {
    ServiceErrorCode,
    type VenuePublicFilterOptions,
    VenuePublicFilterOptionsQuerySchema,
    VenuePublicFilterOptionsSchema,
    VenueTypeEnum
} from '@repo/schemas';
import type { ServiceOutput } from '../../types';

/** Reads the public filter options supported by published venue listings. */
export async function getVenuePublicFilterOptions({
    input,
    model = venueModel
}: {
    input: unknown;
    model?: VenueModel;
}): Promise<ServiceOutput<VenuePublicFilterOptions>> {
    const parsed = VenuePublicFilterOptionsQuerySchema.safeParse(input);
    if (!parsed.success) {
        const messages = parsed.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
        return {
            error: {
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: `Validation failed: ${messages}`
            }
        };
    }
    try {
        const result = await model.findPublicFilterOptions({
            businessLine: parsed.data.businessLine
        });
        const data = VenuePublicFilterOptionsSchema.parse({
            types: [...result.types].sort(
                (a, b) =>
                    Object.values(VenueTypeEnum).indexOf(a as VenueTypeEnum) -
                    Object.values(VenueTypeEnum).indexOf(b as VenueTypeEnum)
            ),
            amenityIds: [...result.amenityIds].sort(),
            featureIds: [...result.featureIds].sort()
        });
        return { data };
    } catch (error) {
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message:
                    error instanceof Error ? error.message : 'Failed to read venue filter options'
            }
        };
    }
}
