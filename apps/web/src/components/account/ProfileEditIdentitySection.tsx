/**
 * @file ProfileEditIdentitySection.tsx
 * @description "Tu identidad" section of the profile edit form: avatar,
 * display name, first and last name, birth date.
 *
 * Presentational. State, the avatar pick and the upload live in
 * `ProfileEditForm.client.tsx`.
 */

import type { ChangeEvent, Ref } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { ProfileTextField } from './ProfileEditFields';
import type { ProfileEditFieldErrors } from './ProfileEditForm.helpers';
import styles from './ProfileEditForm.module.css';
import { Button } from './ui/Button';
import { Section } from './ui/Section';

/** Accepted image MIME types, kept in sync with the orchestrator. */
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Props of {@link ProfileEditIdentitySection}. */
export interface ProfileEditIdentitySectionProps {
    readonly locale: SupportedLocale;
    readonly t: (key: string, fallback?: string) => string;
    readonly displayName: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly birthDate: string;
    readonly fieldErrors: ProfileEditFieldErrors;
    readonly submitting: boolean;
    /** Blob preview, then persisted URL, then null. */
    readonly activeImageUrl: string | null;
    readonly initials: string;
    readonly avatarUploading: boolean;
    /** The picked image is being resized in the browser (HOS-1936). */
    readonly avatarCompressing: boolean;
    readonly fileInputRef: Ref<HTMLInputElement>;
    readonly onChangeClick: () => void;
    readonly onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
    readonly onDisplayNameChange: (value: string) => void;
    readonly onFirstNameChange: (value: string) => void;
    readonly onLastNameChange: (value: string) => void;
    readonly onBirthDateChange: (value: string) => void;
}

/**
 * Identity section.
 *
 * @param props - See {@link ProfileEditIdentitySectionProps}.
 */
export function ProfileEditIdentitySection({
    locale,
    t,
    displayName,
    firstName,
    lastName,
    birthDate,
    fieldErrors,
    submitting,
    activeImageUrl,
    initials,
    avatarUploading,
    avatarCompressing,
    fileInputRef,
    onChangeClick,
    onFileChange,
    onDisplayNameChange,
    onFirstNameChange,
    onLastNameChange,
    onBirthDateChange
}: ProfileEditIdentitySectionProps) {
    const todayIso = new Date().toISOString().split('T')[0];

    return (
        <Section
            title={t('account.pages.editProfile.identitySection')}
            helpId="section:profile.identity"
        >
            <div className={styles.avatarRow}>
                <div
                    className={styles.avatarPreview}
                    aria-hidden="true"
                >
                    {activeImageUrl ? (
                        <img
                            src={activeImageUrl}
                            alt=""
                            className={styles.avatarImg}
                        />
                    ) : (
                        initials
                    )}
                </div>
                <div className={styles.avatarActions}>
                    <Button
                        variant="secondary"
                        onClick={onChangeClick}
                        disabled={avatarUploading || avatarCompressing || submitting}
                    >
                        {t('account.avatar.changeButton')}
                    </Button>
                    {avatarUploading ? (
                        <p className={styles.avatarStatus}>{t('account.avatar.uploading')}</p>
                    ) : null}
                    {avatarCompressing ? (
                        <p className={styles.avatarStatus}>
                            {t('account.avatar.actions.processing', 'Optimizando…')}
                        </p>
                    ) : null}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES.join(',')}
                        className={styles.hiddenInput}
                        onChange={onFileChange}
                        aria-label={t('account.avatar.fileInputLabel')}
                    />
                </div>
            </div>
            <div className={styles.grid}>
                <ProfileTextField
                    name="displayName"
                    label={t('account.editProfile.fields.displayName', 'Nombre visible')}
                    locale={locale}
                    value={displayName}
                    onChange={onDisplayNameChange}
                    error={fieldErrors.displayName}
                    required
                    maxLength={50}
                    autoComplete="nickname"
                    disabled={submitting}
                    full
                />
                <ProfileTextField
                    name="firstName"
                    label={t('account.editProfile.fields.firstName', 'Nombre')}
                    locale={locale}
                    value={firstName}
                    onChange={onFirstNameChange}
                    error={fieldErrors.firstName}
                    required
                    maxLength={50}
                    autoComplete="given-name"
                    disabled={submitting}
                />
                <ProfileTextField
                    name="lastName"
                    label={t('account.editProfile.fields.lastName', 'Apellido')}
                    locale={locale}
                    value={lastName}
                    onChange={onLastNameChange}
                    error={fieldErrors.lastName}
                    required
                    maxLength={50}
                    autoComplete="family-name"
                    disabled={submitting}
                />
                <ProfileTextField
                    name="birthDate"
                    label={t('account.editProfile.fields.birthDate')}
                    locale={locale}
                    type="date"
                    value={birthDate}
                    onChange={onBirthDateChange}
                    error={fieldErrors.birthDate}
                    hint={t('account.editProfile.fields.birthDateHint')}
                    max={todayIso}
                    // The native date picker follows this hint; es-AR nudges
                    // Chromium-based browsers towards dd/mm/yyyy.
                    lang="es-AR"
                    disabled={submitting}
                />
            </div>
        </Section>
    );
}
