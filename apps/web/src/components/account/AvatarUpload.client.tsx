/**
 * @file AvatarUpload.client.tsx
 * @description React island for uploading and updating the user's avatar image.
 * Handles file validation, preview, upload to the media endpoint, and profile update.
 */

import { ImageIcon, UploadIcon } from '@repo/icons';
import { useRef, useState } from 'react';
import styles from './AvatarUpload.module.css';

/** Accepted image MIME types */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Maximum file size in bytes (5 MB) */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Upload result from the media endpoint */
interface UploadResult {
    readonly url: string;
}

/** API response wrapper */
interface ApiResponse<T> {
    readonly success: boolean;
    readonly data: T;
    readonly error?: { readonly message: string };
}

interface AvatarUploadProps {
    /** Current avatar URL to display, or null/undefined for placeholder */
    readonly currentImageUrl?: string | null;
    /** User's display name (used to generate initials placeholder) */
    readonly userName?: string;
    /** Authenticated user's ID for profile update */
    readonly userId: string;
    /** API base URL (PUBLIC_API_URL from Astro) */
    readonly apiUrl: string;
}

/**
 * Derive two-letter initials from a display name.
 * Returns '?' when the name is empty or undefined.
 */
function getInitials(name?: string): string {
    if (!name?.trim()) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * React island for avatar image upload.
 * Validates the selected file, shows a preview, uploads to
 * `POST /api/v1/protected/media/upload`, then patches the user profile
 * with the returned URL via `PATCH /api/v1/protected/users/{id}`.
 */
export function AvatarUpload({ currentImageUrl, userName, userId, apiUrl }: AvatarUploadProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [displayUrl, setDisplayUrl] = useState<string | null>(currentImageUrl ?? null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const activeImageUrl = previewUrl ?? displayUrl;
    const initials = getInitials(userName);
    const base = apiUrl.replace(/\/$/, '');

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
            setError('Solo JPEG, PNG y WebP son aceptados');
            return;
        }

        if (file.size > MAX_FILE_BYTES) {
            setError('Archivo muy grande (máx. 5 MB)');
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);

        void uploadFile(file, objectUrl);
    }

    async function uploadFile(file: File, localPreview: string) {
        setIsLoading(true);
        clearMessages();

        try {
            // Step 1: Upload the file as multipart form data
            const formData = new FormData();
            formData.append('file', file);

            const uploadResponse = await fetch(`${base}/api/v1/protected/media/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!uploadResponse.ok) {
                let message = 'Error al subir la imagen';
                try {
                    const errBody = (await uploadResponse.json()) as ApiResponse<unknown>;
                    if (errBody.error?.message) message = errBody.error.message;
                } catch {
                    // ignore JSON parse errors
                }
                throw new Error(message);
            }

            const uploadBody = (await uploadResponse.json()) as ApiResponse<UploadResult>;
            const imageUrl = uploadBody.data?.url;

            if (!imageUrl) {
                throw new Error('Respuesta inesperada del servidor');
            }

            // Step 2: Update the user profile with the new image URL
            const patchResponse = await fetch(`${base}/api/v1/protected/users/${userId}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageUrl })
            });

            if (!patchResponse.ok) {
                let message = 'Error al actualizar el perfil';
                try {
                    const errBody = (await patchResponse.json()) as ApiResponse<unknown>;
                    if (errBody.error?.message) message = errBody.error.message;
                } catch {
                    // ignore JSON parse errors
                }
                throw new Error(message);
            }

            // Update the displayed avatar and release the local object URL
            setDisplayUrl(imageUrl);
            setPreviewUrl(null);
            URL.revokeObjectURL(localPreview);
            setSuccessMsg('Avatar actualizado correctamente');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al subir la imagen');
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
                        alt={userName ?? 'Avatar'}
                        className={styles.avatarImage}
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
                    className={`${styles.overlay} ${isLoading ? styles.overlayVisible : ''}`}
                    aria-hidden="true"
                >
                    {isLoading ? (
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
                disabled={isLoading}
                aria-busy={isLoading}
            >
                <UploadIcon
                    size={16}
                    weight="regular"
                    aria-hidden="true"
                />
                {isLoading ? 'Subiendo...' : 'Cambiar avatar'}
            </button>

            <p className={styles.hint}>Solo JPEG, PNG y WebP · Máx. 5 MB</p>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
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
