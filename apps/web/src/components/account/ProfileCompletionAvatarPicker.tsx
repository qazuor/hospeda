/**
 * @file ProfileCompletionAvatarPicker.tsx
 * @description Lightweight avatar file picker for the ProfileCompletion form.
 *
 * Wraps a hidden `<input type="file">` triggered by the "Change photo"
 * button. On selection, validates file type + size, uploads the file to
 * `POST /api/v1/protected/media/upload`, and reports the resulting URL
 * back to the parent via `onUploaded(url)`. The parent (orchestrator)
 * keeps the URL in `imageUrl` state and includes it in the profile
 * completion payload — no separate PATCH to /users/{id} is made here
 * because the orchestrator's submit handles persistence.
 *
 * Unlike `AvatarUpload.client.tsx` (account dashboard), this component:
 *   - Does NOT patch the user profile directly (orchestrator owns persistence)
 *   - Does NOT need a `userId` prop (profile is not yet complete)
 *   - Renders only the change button, not a preview circle (BasicFields
 *     already renders the avatar preview using `imageUrl`)
 *
 * Not a `.client.tsx` — mounts inside the already-hydrated parent island.
 */

import { useRef, useState } from 'react';
import styles from './ProfileCompletion.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Response shape of POST /api/v1/protected/media/upload. */
interface UploadResponse {
    readonly success?: boolean;
    readonly data?: { readonly url?: string };
    readonly error?: { readonly message?: string };
}

/** Props for the avatar picker. */
export interface ProfileCompletionAvatarPickerProps {
    /** API base URL (PUBLIC_API_URL — same value the orchestrator uses). */
    readonly apiUrl: string;
    /** Whether the parent form is currently submitting (disables the picker). */
    readonly disabled: boolean;
    /** Translation function from the parent island. */
    readonly t: (key: string, fallback: string) => string;
    /** Called with the uploaded URL after a successful upload. */
    readonly onUploaded: (url: string) => void;
    /** Called when the picker encounters an error (validation or upload). */
    readonly onError?: (message: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Avatar file picker for the profile completion form.
 *
 * @param props - Component props (see {@link ProfileCompletionAvatarPickerProps})
 */
export function ProfileCompletionAvatarPicker({
    apiUrl,
    disabled,
    t,
    onUploaded,
    onError
}: ProfileCompletionAvatarPickerProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [pickerError, setPickerError] = useState<string | null>(null);

    function reportError(message: string): void {
        setPickerError(message);
        onError?.(message);
    }

    function handleButtonClick(): void {
        if (disabled || isUploading) return;
        setPickerError(null);
        fileInputRef.current?.click();
    }

    async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
        const file = event.target.files?.[0];
        // Reset value so the same file can be re-picked after an error.
        event.target.value = '';
        if (!file) return;

        if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
            reportError(
                t(
                    'account.profileCompletion.avatar.errors.invalidType',
                    'El archivo debe ser una imagen JPG, PNG o WebP.'
                )
            );
            return;
        }

        if (file.size > MAX_FILE_BYTES) {
            reportError(
                t(
                    'account.profileCompletion.avatar.errors.fileTooLarge',
                    'La imagen no puede superar los 5 MB.'
                )
            );
            return;
        }

        setIsUploading(true);
        setPickerError(null);

        try {
            const base = apiUrl.replace(/\/$/, '');
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${base}/api/v1/protected/media/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!response.ok) {
                let message = t(
                    'account.profileCompletion.avatar.errors.uploadFailed',
                    'No pudimos subir la imagen. Probá de nuevo.'
                );
                try {
                    const errBody = (await response.json()) as UploadResponse;
                    if (errBody.error?.message) message = errBody.error.message;
                } catch {
                    // ignore JSON parse errors
                }
                reportError(message);
                return;
            }

            const body = (await response.json()) as UploadResponse;
            const url = body.data?.url;
            if (!url) {
                reportError(
                    t(
                        'account.profileCompletion.avatar.errors.unexpectedResponse',
                        'Respuesta inesperada del servidor.'
                    )
                );
                return;
            }

            onUploaded(url);
        } catch {
            reportError(
                t(
                    'account.profileCompletion.avatar.errors.uploadFailed',
                    'No pudimos subir la imagen. Probá de nuevo.'
                )
            );
        } finally {
            setIsUploading(false);
        }
    }

    return (
        <>
            <button
                type="button"
                className={styles.avatarChangeBtn}
                onClick={handleButtonClick}
                disabled={disabled || isUploading}
                aria-busy={isUploading}
            >
                {isUploading
                    ? t('account.profileCompletion.avatar.uploading', 'Subiendo...')
                    : t('account.profileCompletion.avatar.change', 'Cambiar foto')}
            </button>
            <input
                ref={fileInputRef}
                id="pc-avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={styles.srOnly}
                onChange={handleFileChange}
                aria-hidden="true"
                tabIndex={-1}
                disabled={disabled || isUploading}
            />
            {pickerError && (
                <p
                    className={styles.errorMsg}
                    role="alert"
                >
                    {pickerError}
                </p>
            )}
        </>
    );
}
