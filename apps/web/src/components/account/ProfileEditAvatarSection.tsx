/**
 * @file ProfileEditAvatarSection.tsx
 * @description Avatar preview + change button for the profile edit form.
 *
 * Pure presentational subcomponent — all state lives in
 * `ProfileEditForm.client.tsx`. The orchestrator owns the file picker
 * trigger via a ref and handles the actual upload + persistence on submit.
 */

import type { Ref } from 'react';
import styles from './ProfileEditForm.module.css';

/** Accepted image MIME types — kept in sync with the orchestrator constant. */
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Props for the avatar section. */
export interface ProfileEditAvatarSectionProps {
    /** Active image to render (blob URL preview, then persisted URL, then null). */
    readonly activeImageUrl: string | null;
    /** Initials fallback when no image is set. */
    readonly initials: string;
    /** Whether an upload is currently in-flight (disables the change button). */
    readonly avatarUploading: boolean;
    /** Whether the form is submitting (disables the change button). */
    readonly submitting: boolean;
    /** Ref forwarded to the hidden file input so the parent can trigger it. */
    readonly fileInputRef: Ref<HTMLInputElement>;
    /** Translation function from the orchestrator. */
    readonly t: (key: string, fallback?: string) => string;
    /** Click handler for the visible "Cambiar foto" button. */
    readonly onChangeClick: () => void;
    /** Change handler for the hidden file input. */
    readonly onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Avatar section — preview + change button + hidden file input.
 *
 * @param props - Component props (see {@link ProfileEditAvatarSectionProps})
 */
export function ProfileEditAvatarSection({
    activeImageUrl,
    initials,
    avatarUploading,
    submitting,
    fileInputRef,
    t,
    onChangeClick,
    onFileChange
}: ProfileEditAvatarSectionProps) {
    return (
        <section
            className={styles.section}
            aria-labelledby="avatar-section-title"
        >
            <h3
                className={styles.sectionTitle}
                id="avatar-section-title"
            >
                {t('account.pages.editProfile.avatarSection', 'Foto de perfil')}
            </h3>
            <div className={styles.avatarRow}>
                <div
                    className={styles.avatarPreviewWrap}
                    aria-hidden="true"
                >
                    {activeImageUrl ? (
                        <img
                            src={activeImageUrl}
                            alt=""
                            className={styles.avatarPreviewImg}
                        />
                    ) : (
                        <div className={styles.avatarPreviewInitials}>{initials}</div>
                    )}
                </div>
                <div className={styles.avatarActions}>
                    <button
                        type="button"
                        className={styles.avatarUploadBtn}
                        onClick={onChangeClick}
                        disabled={avatarUploading || submitting}
                    >
                        {t('account.avatar.changeButton', 'Cambiar foto')}
                    </button>
                    {avatarUploading && (
                        <span className={styles.avatarUploading}>
                            {t('account.avatar.uploading', 'Subiendo…')}
                        </span>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES.join(',')}
                        className={styles.avatarHiddenInput}
                        onChange={onFileChange}
                        aria-label={t(
                            'account.avatar.fileInputLabel',
                            'Seleccionar imagen de perfil'
                        )}
                    />
                </div>
            </div>
        </section>
    );
}
