import { z } from 'zod';

// Regex for slugs (e.g.: my-slug-123)
export const SlugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Regex for time in HH:mm format (24h)
export const TimeRegExp = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Regex for international phone number (E.164)
export const InternationalPhoneRegex = /^\+[1-9]\d{1,14}(?:\s\d{1,15})*$/;

// Regex for social network URLs
export const FacebookUrlRegex = /^https?:\/\/(www\.)?facebook\.com\//;
export const InstagramUrlRegex = /^https?:\/\/(www\.)?instagram\.com\//;
export const TwitterUrlRegex = /^https?:\/\/(www\.)?twitter\.com\//;
export const LinkedInUrlRegex = /^https?:\/\/(www\.)?linkedin\.com\//;
export const TikTokUrlRegex = /^https?:\/\/(www\.)?tiktok\.com\//;
export const YouTubeUrlRegex = /^https?:\/\/(www\.)?youtube\.com\//;

export const isValidLatitude = (val: string) => {
    if (val.trim() === '') return false; // Reject empty strings
    const n = Number(val);
    return !Number.isNaN(n) && Number.isFinite(n) && n >= -90 && n <= 90;
};
export const isValidLongitude = (val: string) => {
    if (val.trim() === '') return false; // Reject empty strings
    const n = Number(val);
    return !Number.isNaN(n) && Number.isFinite(n) && n >= -180 && n <= 180;
};

// Common fields to omit in CRUD actions (auto-managed by system)
export const omittedSystemFieldsForActions = [
    'id',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'deletedById'
];

/**
 * Transform helper for numeric fields that may come as strings from database (Drizzle numeric/decimal)
 * Accepts both string and number, transforms string to number, then validates as number
 *
 * @example
 * ```ts
 * // Basic usage
 * const schema = numericField();
 *
 * // With validation
 * const schema = numericField(z.number().positive().min(0).max(100));
 * ```
 */
export const numericField = (validation?: z.ZodNumber) => {
    const baseTransform = z
        .union([z.string(), z.number()])
        .transform((val: string | number) =>
            typeof val === 'string' ? Number.parseFloat(val) : val
        );

    return validation ? baseTransform.pipe(validation) : baseTransform.pipe(z.number());
};
