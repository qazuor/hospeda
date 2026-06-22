import type {
    SocialAudienceModel,
    SocialCampaignModel,
    SocialContentBatchModel,
    SocialHashtagSetModel,
    SocialPostFooterModel
} from '@repo/db';
import { createUniqueSlug } from '@repo/utils';

/**
 * Normalizes a raw hashtag string to its canonical form:
 * lowercase, with a leading `#` prefix.
 *
 * @example
 * normalizeHashtag('Playa')      // '#playa'
 * normalizeHashtag('#VERANO')    // '#verano'
 * normalizeHashtag('  #Hospeda ') // '#hospeda'
 *
 * @param raw - The raw hashtag as entered by the user.
 * @returns The normalized hashtag string (lowercase, `#`-prefixed, trimmed).
 */
export function normalizeHashtag(raw: string): string {
    const trimmed = raw.trim().toLowerCase();
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

/**
 * Generates a unique slug for a social campaign.
 *
 * @param name - The name to derive the slug from.
 * @param model - The SocialCampaignModel (or compatible mock) used for uniqueness checks.
 * @returns A promise resolving to a unique URL-safe slug string.
 */
export async function generateCampaignSlug(
    name: string,
    model: Pick<SocialCampaignModel, 'findOne'>
): Promise<string> {
    return createUniqueSlug(name, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}

/**
 * Generates a unique slug for a social content batch.
 *
 * @param name - The name to derive the slug from.
 * @param model - The SocialContentBatchModel (or compatible mock) used for uniqueness checks.
 * @returns A promise resolving to a unique URL-safe slug string.
 */
export async function generateContentBatchSlug(
    name: string,
    model: Pick<SocialContentBatchModel, 'findOne'>
): Promise<string> {
    return createUniqueSlug(name, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}

/**
 * Generates a unique slug for a social audience.
 *
 * @param name - The name to derive the slug from.
 * @param model - The SocialAudienceModel (or compatible mock) used for uniqueness checks.
 * @returns A promise resolving to a unique URL-safe slug string.
 */
export async function generateAudienceSlug(
    name: string,
    model: Pick<SocialAudienceModel, 'findOne'>
): Promise<string> {
    return createUniqueSlug(name, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}

/**
 * Generates a unique slug for a social hashtag set.
 *
 * @param name - The name to derive the slug from.
 * @param model - The SocialHashtagSetModel (or compatible mock) used for uniqueness checks.
 * @returns A promise resolving to a unique URL-safe slug string.
 */
export async function generateHashtagSetSlug(
    name: string,
    model: Pick<SocialHashtagSetModel, 'findOne'>
): Promise<string> {
    return createUniqueSlug(name, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}

/**
 * Generates a unique slug for a social post footer.
 *
 * @param name - The name to derive the slug from.
 * @param model - The SocialPostFooterModel (or compatible mock) used for uniqueness checks.
 * @returns A promise resolving to a unique URL-safe slug string.
 */
export async function generatePostFooterSlug(
    name: string,
    model: Pick<SocialPostFooterModel, 'findOne'>
): Promise<string> {
    return createUniqueSlug(name, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}
