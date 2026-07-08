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

/** `social_settings` key for the Cloudinary upload folder BASE prefix. */
export const SOCIAL_ASSETS_FOLDER_KEY = 'social_assets_folder';

/**
 * Fallback BASE prefix for `social_assets_folder` when the setting is missing
 * or empty.
 *
 * This is a PREFIX only — the environment segment and `/assets` suffix are
 * always appended by {@link buildSocialAssetsFolder}, never sourced from this
 * setting. This guarantees environment isolation (staging vs. prod share one
 * Cloudinary account) regardless of what an admin configures here.
 */
export const SOCIAL_ASSETS_FOLDER_BASE_FALLBACK = 'hospeda/social';

/** Input for {@link buildSocialAssetsFolder}. */
export interface BuildSocialAssetsFolderInput {
    /**
     * The configured (or fallback) BASE prefix, e.g. `hospeda/social`. Must
     * NOT already include an environment segment or the `assets` suffix —
     * this function always appends both.
     */
    base: string;
    /** Resolved deploy environment (`'dev' | 'test' | 'preview' | 'prod'`). */
    environment: string;
}

/**
 * Composes the final Cloudinary folder for social-pipeline uploads as
 * `${base}/${environment}/assets`, so that every upload is ALWAYS
 * environment-isolated regardless of the admin-configured base prefix.
 *
 * This guarantees separation between environments (e.g. staging and prod,
 * which share a single Cloudinary account) — the admin-controlled
 * `social_assets_folder` setting only controls the base prefix; the
 * environment segment and `assets` suffix are never influenced by DB/seed
 * data.
 *
 * @param input - The base prefix and resolved environment.
 * @returns The composed Cloudinary folder path.
 *
 * @example
 * ```ts
 * buildSocialAssetsFolder({ base: 'hospeda/social', environment: 'prod' });
 * // "hospeda/social/prod/assets"
 *
 * buildSocialAssetsFolder({ base: 'hospeda/social', environment: 'preview' });
 * // "hospeda/social/preview/assets"
 * ```
 */
export function buildSocialAssetsFolder(input: BuildSocialAssetsFolderInput): string {
    const { base, environment } = input;
    return `${base}/${environment}/assets`;
}
