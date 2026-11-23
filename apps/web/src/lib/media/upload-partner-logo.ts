/**
 * @file upload-partner-logo.ts
 * @description Uploads a partner logo through
 * `POST /api/v1/protected/partners/mine/logo` (HOS-2506).
 *
 * The endpoint stores the image in the media provider under the caller's own
 * partner folder and answers its URL. It persists nothing: the caller saves
 * that URL into `logoUrl` through the normal partner PATCH, which sends the
 * change to admin review.
 */

import { type ApiErrorShape, translateApiError } from '@/lib/api-errors';
import { getApiUrl } from '@/lib/env';
import { createT, type SupportedLocale } from '@/lib/i18n';

/** Outcome of {@link uploadPartnerLogo}, shaped for the kit `ImageUploader`. */
export type UploadPartnerLogoResult =
    | { readonly ok: true; readonly url: string }
    | { readonly ok: false; readonly message: string };

/** The API envelope this endpoint answers. */
interface UploadEnvelope {
    readonly data?: { readonly url?: string };
    readonly error?: ApiErrorShape;
}

/**
 * Uploads one logo file for the caller's own partner listing.
 *
 * Never throws: network failures and non-JSON answers become `{ ok: false }`
 * with a localized message.
 *
 * @param input - The file and the active locale.
 * @param input.file - The (already compressed) image file.
 * @param input.locale - Locale for the error copy.
 * @returns The stored URL, or a localized failure message.
 */
export async function uploadPartnerLogo({
    file,
    locale
}: {
    readonly file: File;
    readonly locale: SupportedLocale;
}): Promise<UploadPartnerLogoResult> {
    const t = createT(locale);
    const fallback = t('account.ui.imageUploader.errors.uploadFailed');
    try {
        const body = new FormData();
        body.append('file', file);
        const response = await fetch(`${getApiUrl()}/api/v1/protected/partners/mine/logo`, {
            method: 'POST',
            credentials: 'include',
            body
        });
        let envelope: UploadEnvelope | null = null;
        try {
            envelope = (await response.json()) as UploadEnvelope;
        } catch {
            envelope = null;
        }
        if (!response.ok) {
            return {
                ok: false,
                message: translateApiError({
                    error: envelope?.error ? { ...envelope.error, status: response.status } : null,
                    t,
                    fallback
                })
            };
        }
        const url = envelope?.data?.url;
        return url ? { ok: true, url } : { ok: false, message: fallback };
    } catch {
        return { ok: false, message: fallback };
    }
}
