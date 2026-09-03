/**
 * @file AvatarUpload.client.tsx
 * @description React island for uploading and updating the user's avatar image.
 * Handles file validation, preview, upload to the media endpoint, and profile update.
 */

import { ImageIcon, UploadIcon } from '@repo/icons';
import { DEFAULT_AVATAR_MAX_FILE_SIZE_MB, getMediaUrl, mbToBytes } from '@repo/media';
import { useRef, useState } from 'react';
import { translateApiError } from '@/lib/api-errors';
import { getInitials } from '@/lib/avatar-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { compressImageForUpload, isCompressionUnavailable } from '@/lib/media/compress-image';
import styles from './AvatarUpload.module.css';

/**
 * Accepted image MIME types.
 *
 * HOS-332: `image/heic` was added by owner decision — the server already
 * accepted it; the compression pipeline (`@/lib/media/compress-image`) falls
 * back to uploading it as-is on a browser that cannot decode HEIC (Chrome).
 */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;

/** Maximum avatar size in bytes, from the canonical cap in `@repo/media`. */
const MAX_FILE_BYTES = mbToBytes(DEFAULT_AVATAR_MAX_FILE_SIZE_MB);

/** Upload result from the media endpoint */
interface UploadResult {
    readonly url: string;
}

/** API response wrapper */
interface ApiResponse<T> {
    readonly success: boolean;
    readonly data: T;
    readonly error?: {
        readonly code?: string | null;
        readonly message?: string | null;
        readonly reason?: string | null;
    };
}

interface AvatarUploadProps {
    /** Current avatar URL to display, or null/undefined for placeholder */
    readonly currentImageUrl?: string | null;
    /** User's display name (used to generate initials placeholder) */
    readonly userName?: string;
    /** User's email (fallback for initials when name is empty) */
    readonly userEmail?: string;
    /** Authenticated user's ID for profile update */
    readonly userId: string;
    /** API base URL (PUBLIC_API_URL from Astro) */
    readonly apiUrl: string;
    /** Active locale for UI strings */
    readonly locale: SupportedLocale;
}

/**
 * React island for avatar image upload.
 * Validates the selected file, shows a preview, uploads to
 * `POST /api/v1/protected/media/upload`, then patches the user profile
 * with the returned URL via `PATCH /api/v1/protected/users/{id}`.
 */
export function AvatarUpload({
    currentImageUrl,
    userName,
    userEmail,
    userId,
    apiUrl,
    locale
}: AvatarUploadProps) {
    const { t } = createTranslations(locale);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [displayUrl, setDisplayUrl] = useState<string | null>(currentImageUrl ?? null);
    const [isLoading, setIsLoading] = useState(false);
    /**
     * Whether the selected file is currently being resized/recompressed
     * client-side (HOS-332), BEFORE the upload itself starts. Shares the
     * overlay spinner with `isLoading` so a large file never looks stuck.
     */
    const [isCompressing, setIsCompressing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // `previewUrl` is a transient `blob:` URL from URL.createObjectURL and must
    // never pass through getMediaUrl (which would treat it as non-Cloudinary
    // and return it unchanged, but explicitly segregating avoids mistakes).
    // `displayUrl` is the persisted avatar URL returned by the media endpoint
    // and is the only value that gets the `avatar` Cloudinary preset applied.
    const activeImageUrl =
        previewUrl ?? (displayUrl ? getMediaUrl(displayUrl, { preset: 'avatar' }) : null);
    const initials = getInitials({ name: userName, email: userEmail });
    const base = apiUrl.replace(/\/$/, '');
    const avatarAlt = userName ?? t('account.avatar.alt', 'Avatar');
    const isBusy = isLoading || isCompressing;

    function handleButtonClick() {
        fileInputRef.current?.click();
    }

    function clearMessages() {
        setError(null);
        setSuccessMsg(null);
    }

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!event.target.files) return;

        // Reset input value so the same file can be re-selected after an error
        event.target.value = '';

        if (!file) return;

        clearMessages();

        if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
            setError(t('account.avatar.errors.invalidType'));
            return;
        }

        // Size is checked AFTER compression (HOS-332, inside `uploadFile`),
        // so a heavy original that shrinks under the cap is still accepted.

        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);

        void uploadFile(file, objectUrl);
    }

    async function uploadFile(file: File, localPreview: string) {
        setIsLoading(true);
        clearMessages();

        try {
            // HOS-332: resize/recompress before the size cap is checked. Any
            // failure to compress (unsupported format, no canvas support)
            // falls back to the original file — never blocks the upload.
            setIsCompressing(true);
            const compression = await compressImageForUpload({ file });
            setIsCompressing(false);

            const uploadableFile = compression.file;
            if (uploadableFile.size > MAX_FILE_BYTES) {
                throw new Error(
                    isCompressionUnavailable(compression)
                        ? t(
                              'account.avatar.errors.compressionUnsupportedTooLarge',
                              'No pudimos optimizar esta imagen automáticamente (tu navegador no puede procesar este formato) y supera el máximo de {{maxSize}} MB. Probá convertirla a JPG antes de subirla, o elegí una foto más liviana.',
                              { maxSize: DEFAULT_AVATAR_MAX_FILE_SIZE_MB }
                          )
                        : t(
                              'account.avatar.errors.fileTooLarge',
                              'Archivo muy grande (máx. {{maxSize}} MB)',
                              { maxSize: DEFAULT_AVATAR_MAX_FILE_SIZE_MB }
                          )
                );
            }

            // Step 1: Upload the file as multipart form data
            const formData = new FormData();
            formData.append('file', uploadableFile);

            const uploadResponse = await fetch(`${base}/api/v1/protected/media/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!uploadResponse.ok) {
                let message = t('account.avatar.errors.uploadFailed');
                try {
                    const errBody = (await uploadResponse.json()) as ApiResponse<unknown>;
                    message = translateApiError({
                        error: errBody.error,
                        t,
                        fallback: message
                    });
                } catch {
                    // ignore JSON parse errors
                }
                throw new Error(message);
            }

            const uploadBody = (await uploadResponse.json()) as ApiResponse<UploadResult>;
            const imageUrl = uploadBody.data?.url;

            if (!imageUrl) {
                throw new Error(t('account.avatar.errors.unexpectedResponse'));
            }

            // Step 2: Update the user profile with the new image URL
            const patchResponse = await fetch(`${base}/api/v1/protected/users/${userId}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageUrl })
            });

            if (!patchResponse.ok) {
                let message = t('account.avatar.errors.updateFailed');
                try {
                    const errBody = (await patchResponse.json()) as ApiResponse<unknown>;
                    message = translateApiError({
                        error: errBody.error,
                        t,
                        fallback: message
                    });
                } catch {
                    // ignore JSON parse errors
                }
                throw new Error(message);
            }

            // Update the displayed avatar and release the local object URL
            setDisplayUrl(imageUrl);
            setPreviewUrl(null);
            URL.revokeObjectURL(localPreview);
            setSuccessMsg(t('account.avatar.success'));
        } catch (err) {
            setError(err instanceof Error ? err.message : t('account.avatar.errors.uploadFailed'));
            // Revert preview on failure
            setPreviewUrl(null);
            URL.revokeObjectURL(localPreview);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className={styles.wrapper}>
            {/* Avatar circle */}
            <div className={styles.avatarContainer}>
                {activeImageUrl ? (
                    <img
                        src={activeImageUrl}
                        alt={avatarAlt}
                        className={styles.avatarImage}
                        width={150}
                        height={150}
                        loading="lazy"
                        decoding="async"
                    />
                ) : (
                    <div
                        className={styles.avatarPlaceholder}
                        aria-hidden="true"
                    >
                        <span className={styles.initials}>{initials}</span>
                    </div>
                )}

                {/* Hover / loading overlay */}
                <div
                    className={`${styles.overlay} ${isBusy ? styles.overlayVisible : ''}`}
                    aria-hidden="true"
                >
                    {isBusy ? (
                        <span className={styles.spinner} />
                    ) : (
                        <ImageIcon
                            size={24}
                            weight="regular"
                            color="white"
                        />
                    )}
                </div>
            </div>

            {/* Change button */}
            <button
                type="button"
                className={styles.changeButton}
                onClick={handleButtonClick}
                disabled={isBusy}
                aria-busy={isBusy}
            >
                <UploadIcon
                    size={16}
                    weight="regular"
                    aria-hidden="true"
                />
                {isCompressing
                    ? t('account.avatar.actions.processing', 'Optimizando…')
                    : isLoading
                      ? t('account.avatar.actions.uploading')
                      : t('account.avatar.actions.change')}
            </button>

            <p className={styles.hint}>
                {t('account.avatar.hint', 'Solo JPEG, PNG, WebP y HEIC · Máx. {{maxSize}} MB', {
                    maxSize: DEFAULT_AVATAR_MAX_FILE_SIZE_MB
                })}
            </p>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                className={styles.fileInput}
                onChange={handleFileChange}
                aria-hidden="true"
                tabIndex={-1}
            />

            {/* Feedback messages */}
            {error && (
                <p
                    className={styles.errorMsg}
                    role="alert"
                >
                    {error}
                </p>
            )}
            {successMsg && !error && (
                <p
                    className={styles.successMsg}
                    aria-live="polite"
                >
                    {successMsg}
                </p>
            )}
        </div>
    );
}
