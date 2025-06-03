/**
 * Normalizes a mock Accommodation object to a plain, service-compatible input for update/create.
 * - Converts all Date fields to ISO strings.
 * - Converts enums to string values.
 * - Removes nested objects/arrays (owner, destination, media, features, tags, reviews, faqs, adminInfo, etc.).
 * - Keeps only the fields required by the service input schema.
 *
 * Usage:
 *   const input = normalizeAccommodationInput({ ...getMockAccommodation(), ...overrides });
 *
 * @param input Partial<AccommodationType> (mock or real)
 * @returns Plain object compatible with update/create input schema
 */
import type { AccommodationType } from '@repo/types';
import type { UpdateInput } from '../../services/accommodation/accommodation.schemas';

export const normalizeAccommodationInput = (input: Partial<AccommodationType>): UpdateInput => {
    const {
        id,
        slug,
        name,
        summary,
        type,
        description,
        ownerId,
        destinationId,
        lifecycleState,
        visibility,
        moderationState,
        isFeatured,
        reviewsCount,
        averageRating,
        seo
    } = input;
    // Throw explicit error if any required field is missing
    const required = {
        id,
        slug,
        name,
        summary,
        type,
        description,
        ownerId,
        destinationId,
        lifecycleState,
        visibility,
        moderationState
    };
    for (const [key, value] of Object.entries(required)) {
        if (value === undefined || value === null) {
            throw new Error(`normalizeAccommodationInput: missing required field '${key}'`);
        }
    }
    return {
        id: String(id) as UpdateInput['id'],
        slug: String(slug),
        name: String(name),
        summary: String(summary),
        type: String(type),
        description: String(description),
        ownerId: String(ownerId),
        destinationId: String(destinationId),
        lifecycleState: String(lifecycleState),
        visibility: String(visibility),
        moderationState: String(moderationState),
        isFeatured: isFeatured ?? false,
        reviewsCount: reviewsCount ?? 0,
        averageRating: averageRating ?? 0,
        seo
    };
};

export const getNormalizedUpdateInput = (base: object, overrides: object = {}) =>
    normalizeAccommodationInput({ ...base, ...overrides });
