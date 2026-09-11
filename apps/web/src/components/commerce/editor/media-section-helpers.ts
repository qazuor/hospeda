/**
 * @file media-section-helpers.ts
 * @description Pure helpers for `MediaSection.client.tsx` (HOS-332).
 *
 * Extracted so file-type/size validation stays unit-testable in isolation
 * from React rendering, and so the two checks can be split around the
 * client-side compression step: type is checked BEFORE compression (no
 * point compressing a rejected file), size is checked AFTER (a heavy
 * original that compression shrinks under the cap must be accepted).
 * Mirrors the equivalent split in the accommodation editor's
 * `photo-section-helpers.ts`.
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';

/** Translator function shape (matches the editor's `createTranslations().t`). */
export type Translate = (
    key: string,
    fallback?: string,
    params?: Record<string, string | number>
) => string;

/**
 * MIME types accepted from the commerce media picker.
 *
 * HOS-332: `image/heic` was added by owner decision. The server has accepted
 * it since before this change
 * (`packages/media/src/server/validate-media-file.ts`); this list used to be
 * the only thing standing in the way. Chrome cannot DECODE HEIC (only Safari
 * can), but that is fine here — the compression pipeline
 * (`@/lib/media/compress-image`) falls back to uploading an undecodable file
 * as-is.
 */
export const MEDIA_SECTION_ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic'
] as const;

const MAX_SIZE_BYTES = mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB);

/**
 * Validate a file's MIME type against the commerce media allowlist.
 *
 * @param file - The file selected by the owner
 * @param t - Active translator
 * @returns A localized error message, or `null` when the type is accepted
 */
export function validateMediaFileType(file: File, t: Translate): string | null {
    if (!(MEDIA_SECTION_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
        return t(
            'commerce.owner.editor.media.invalidType',
            'Solo se permiten archivos JPG, PNG, WebP o HEIC'
        );
    }
    return null;
}

/**
 * Validate a file's size against the shared entity upload limit.
 *
 * Called AFTER client-side compression (HOS-332) against the (possibly
 * shrunk) file that will actually be uploaded, so a heavy original that
 * compresses under the cap is accepted.
 *
 * @param file - The file to check (post-compression, when applicable)
 * @param t - Active translator
 * @returns A localized error message, or `null` when the size is within cap
 */
export function validateMediaFileSize(file: File, t: Translate): string | null {
    if (file.size > MAX_SIZE_BYTES) {
        return t(
            'commerce.owner.editor.media.tooLarge',
            'El archivo no puede superar {{maxSize}}MB',
            { maxSize: DEFAULT_ENTITY_MAX_FILE_SIZE_MB }
        );
    }
    return null;
}

/**
 * Message shown when a file could not be compressed (the browser cannot
 * decode its format — the canonical case is HEIC on Chrome) AND it still
 * exceeds the upload size cap after that failed attempt.
 *
 * Distinct from {@link validateMediaFileSize}'s generic message: the fix
 * here is different (convert the format, or use a device/browser that can
 * decode it), not "pick a smaller photo".
 *
 * @param t - Active translator
 * @returns A localized, actionable error message
 */
export function buildMediaCompressionUnsupportedTooLargeMessage(t: Translate): string {
    return t(
        'commerce.owner.editor.media.compressionUnsupportedTooLarge',
        'No pudimos optimizar esta imagen automáticamente (tu navegador no puede procesar este formato) y supera el máximo de {{maxSize}}MB. Probá convertirla a JPG antes de subirla, o elegí una foto más liviana.',
        { maxSize: DEFAULT_ENTITY_MAX_FILE_SIZE_MB }
    );
}
