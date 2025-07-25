import type { Actor } from '../../types';
import type {
    CreatePostSponsorshipInput,
    UpdatePostSponsorshipInput
} from './postSponsorship.schemas';

/**
 * Normalizes the input data for creating a post sponsorship.
 * Trims and cleans all string fields, normalizes dates and price if needed.
 * @param data The original input data for creation.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
 */
export const normalizeCreateInput = (
    data: CreatePostSponsorshipInput,
    _actor: Actor
): CreatePostSponsorshipInput => {
    return {
        ...data,
        message: typeof data.message === 'string' ? data.message.trim() : data.message,
        description: data.description.trim()
        // TODO: normalize paid, dates if needed
    };
};

/**
 * Normalizes the input data for updating a post sponsorship.
 * Trims and cleans all string fields, normalizes dates and price if needed.
 * @param data The original input data for update.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
 */
export const normalizeUpdateInput = (
    data: UpdatePostSponsorshipInput,
    _actor: Actor
): UpdatePostSponsorshipInput => {
    const normalized: UpdatePostSponsorshipInput = { ...data };
    if (typeof data.message === 'string') normalized.message = data.message.trim();
    if (typeof data.description === 'string') normalized.description = data.description.trim();
    // TODO: normalize paid, dates if needed
    return normalized;
};
