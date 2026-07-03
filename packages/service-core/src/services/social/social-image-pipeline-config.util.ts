/**
 * Pure fallback-resolution helpers for numeric/string `social_settings` values
 * consumed by the image pipeline (HOS-64 / SPEC-297a G-2).
 *
 * No DB/IO — callers resolve the raw stored value via `SocialSettingModel` and
 * pass it through the relevant resolver below, which falls back to the
 * hard-coded default when the row is missing, empty, or (for the numeric
 * case) not a finite number.
 */

/** Input for {@link resolveNumericSettingWithFallback}. */
export interface ResolveNumericSettingWithFallbackInput {
    /** Raw stored `social_settings.value`, or `undefined`/`null` if the row is missing. */
    rawValue: string | null | undefined;
    /** Value used when `rawValue` is missing, empty, or not a finite number. */
    fallback: number;
}

/**
 * Parses a `social_settings` numeric value, falling back to a hard-coded
 * default when missing, empty, or non-numeric.
 *
 * @param input - The raw setting value and its fallback.
 * @returns The parsed value if it is a finite number, otherwise `fallback`.
 */
export function resolveNumericSettingWithFallback(
    input: ResolveNumericSettingWithFallbackInput
): number {
    const { rawValue, fallback } = input;

    if (rawValue === null || rawValue === undefined || rawValue.trim() === '') {
        return fallback;
    }

    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/** Input for {@link resolveStringSettingWithFallback}. */
export interface ResolveStringSettingWithFallbackInput {
    /** Raw stored `social_settings.value`, or `undefined`/`null` if the row is missing. */
    rawValue: string | null | undefined;
    /** Value used when `rawValue` is missing or empty. */
    fallback: string;
}

/**
 * Resolves a `social_settings` string value, falling back to a hard-coded
 * default when missing or empty.
 *
 * @param input - The raw setting value and its fallback.
 * @returns `rawValue` if it is a non-empty string, otherwise `fallback`.
 */
export function resolveStringSettingWithFallback(
    input: ResolveStringSettingWithFallbackInput
): string {
    const { rawValue, fallback } = input;

    if (rawValue === null || rawValue === undefined || rawValue.trim() === '') {
        return fallback;
    }

    return rawValue;
}

/** `social_settings` key for the image download HTTP call timeout, in milliseconds. */
export const DOWNLOAD_TIMEOUT_MS_KEY = 'download_timeout_ms';

/** Fallback for `download_timeout_ms` when the setting is missing or invalid. */
export const DOWNLOAD_TIMEOUT_MS_FALLBACK = 15_000;

/** `social_settings` key for the Cloudinary upload folder path. */
export const SOCIAL_ASSETS_FOLDER_KEY = 'social_assets_folder';

/** Fallback for `social_assets_folder` when the setting is missing or empty. */
export const SOCIAL_ASSETS_FOLDER_FALLBACK = 'hospeda/social/assets';
