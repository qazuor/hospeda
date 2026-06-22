/**
 * @file social-post-detail.utils.ts
 * @description Shared utility helpers for the social post detail page (SPEC-254 T-040).
 */

import type { TranslationKey } from '@repo/i18n';

/**
 * Maps a raw API error message to a user-facing i18n key.
 *
 * @param message - The raw error message from the API.
 * @param t - The translation function.
 * @returns A translated, user-facing error string.
 */
export function mapApiError(message: string, t: (key: TranslationKey) => string): string {
    if (message.includes('MISSING_MEDIA')) {
        return t('social.posts.detail.actions.approveMissingMedia' as TranslationKey);
    }
    if (message.includes('INVALID_STATE')) {
        return t('social.posts.detail.actions.approveInvalidState' as TranslationKey);
    }
    return message;
}
