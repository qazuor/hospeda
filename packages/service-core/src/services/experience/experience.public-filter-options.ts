import { type ExperienceModel, experienceModel } from '@repo/db';
import {
    type ExperiencePublicFilterOptions,
    ExperiencePublicFilterOptionsQuerySchema,
    ExperiencePublicFilterOptionsSchema,
    ServiceErrorCode
} from '@repo/schemas';
import type { ServiceOutput } from '../../types';

/**
 * Reads the public filter options supported by published experience listings
 * (HOS-2085): the amenity and feature ids held by at least one published
 * experience. Mirrors `getVenuePublicFilterOptions`.
 *
 * @param params.input - Raw query input; validated against the strict empty query schema.
 * @param params.model - Experience model, injectable for tests.
 * @returns The sorted amenity and feature ids, or a typed service error.
 */
export async function getExperiencePublicFilterOptions({
    input,
    model = experienceModel
}: {
    input: unknown;
    model?: ExperienceModel;
}): Promise<ServiceOutput<ExperiencePublicFilterOptions>> {
    const parsed = ExperiencePublicFilterOptionsQuerySchema.safeParse(input);
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
        const result = await model.findPublicFilterOptions();
        const data = ExperiencePublicFilterOptionsSchema.parse({
            amenityIds: [...result.amenityIds].sort(),
            featureIds: [...result.featureIds].sort()
        });
        return { data };
    } catch (error) {
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to read experience filter options'
            }
        };
    }
}
