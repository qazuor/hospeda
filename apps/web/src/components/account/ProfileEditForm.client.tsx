/**
 * @file ProfileEditForm.client.tsx
 * @description React island for editing a user's public profile.
 *
 * Orchestrator: owns ALL state + handlers + submit, then delegates
 * rendering to five pure subcomponents:
 *   1. ProfileEditAvatarSection    (image preview + change button)
 *   2. ProfileEditPersonalSection  (displayName, firstName, lastName,
 *                                   birthDate, phone, bio)
 *   3. ProfileEditExtrasSection    (website, occupation)
 *   4. ProfileEditSocialSection    (facebook/instagram/twitter/linkedin/youtube)
 *   5. ProfileEditLocationSection  (country, province, city, addressLine1,
 *                                   postalCode)
 *
 * Validates with `ProfileEditSchema` from `@repo/schemas`. On submit,
 * uploads any pending avatar via the media endpoint, then PATCHes the
 * user via `/api/v1/protected/users/:id`. Uses only native HTML form +
 * React state — no react-hook-form (web-app convention: native forms).
 *
 * Hydration: caller must use `client:load`.
 */

import { DEFAULT_AVATAR_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { useRef, useState } from 'react';
import { getInitials } from '@/lib/avatar-utils';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { compressImageForUpload, isCompressionUnavailable } from '@/lib/media/compress-image';
import { addToast } from '@/store/toast-store';
import { ProfileEditAvatarSection } from './ProfileEditAvatarSection';
import { ProfileEditExtrasSection } from './ProfileEditExtrasSection';
import {
    buildInitialProfileSnapshot,
    ProfileEditFormSchema,
    type ProfileSnapshot
} from './ProfileEditForm.helpers';
import styles from './ProfileEditForm.module.css';
import { ProfileEditLocationSection } from './ProfileEditLocationSection';
import { ProfileEditPersonalSection } from './ProfileEditPersonalSection';
import { ProfileEditSecuritySection } from './ProfileEditSecuritySection';
import { ProfileEditSocialSection } from './ProfileEditSocialSection';
import { useProfileEditSubmit } from './useProfileEditSubmit';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_AVATAR_BYTES = mbToBytes(DEFAULT_AVATAR_MAX_FILE_SIZE_MB);

// ─── Types ────────────────────────────────────────────────────────────────────

/** Profile JSONB block (subset of UserProfileSchema). */
export interface ProfileEditUserProfile {
    readonly bio?: string | null;
    readonly website?: string | null;
    readonly occupation?: string | null;
}

/** Pre-population shape — mirrors what the page.astro fetches from the API. */
export interface ProfileEditUser {
    readonly id: string;
    readonly displayName?: string | null;
    readonly firstName?: string | null;
    readonly lastName?: string | null;
    readonly avatarUrl?: string | null;
    readonly phone?: string | null;
    readonly birthDate?: string | null;
    readonly profile?: ProfileEditUserProfile | null;
    readonly website?: string | null;
    readonly facebookUrl?: string | null;
    readonly instagramUrl?: string | null;
    readonly twitterUrl?: string | null;
    readonly linkedinUrl?: string | null;
    readonly youtubeUrl?: string | null;
    readonly addressLine1?: string | null;
    readonly city?: string | null;
    readonly province?: string | null;
    readonly country?: string | null;
    readonly postalCode?: string | null;
    /**
     * `settings.publicProfileShowSocialNetworks` (HOS-375 §6.7). Flattened out
     * of the `settings` JSONB by the page, the same way `phone` is flattened
     * out of `contactInfo`. Absent/null means "never chosen", which is OFF.
     */
    readonly publicProfileShowSocialNetworks?: boolean | null;
}

interface ProfileEditFormProps {
    readonly initialUser: ProfileEditUser;
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
    /** Whether the account has an email+password login (HOS-2431). Defaults to true when unknown. */
    readonly hasPassword?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Profile edit form island. Pre-fills from the server-fetched user,
 * validates with `ProfileEditSchema`, uploads avatar then PATCHes the
 * profile.
 *
 * @param props - Component props (see {@link ProfileEditFormProps})
 */
export function ProfileEditForm({
    initialUser,
    locale,
    apiUrl,
    hasPassword = true
}: ProfileEditFormProps) {
    const { t } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Form state — personal ─────────────────────────────────────────────

    const [displayName, setDisplayName] = useState(initialUser.displayName ?? '');
    const [firstName, setFirstName] = useState(initialUser.firstName ?? '');
    const [lastName, setLastName] = useState(initialUser.lastName ?? '');
    const [birthDate, setBirthDate] = useState(initialUser.birthDate ?? '');
    const [phone, setPhone] = useState(initialUser.phone ?? '');
    const [bio, setBio] = useState(initialUser.profile?.bio ?? '');

    // ── Form state — extras ───────────────────────────────────────────────

    const [website, setWebsite] = useState(
        initialUser.website ?? initialUser.profile?.website ?? ''
    );
    const [occupation, setOccupation] = useState(initialUser.profile?.occupation ?? '');

    // ── Form state — social ───────────────────────────────────────────────

    const [facebookUrl, setFacebookUrl] = useState(initialUser.facebookUrl ?? '');
    const [instagramUrl, setInstagramUrl] = useState(initialUser.instagramUrl ?? '');
    const [twitterUrl, setTwitterUrl] = useState(initialUser.twitterUrl ?? '');
    const [linkedinUrl, setLinkedinUrl] = useState(initialUser.linkedinUrl ?? '');
    const [youtubeUrl, setYoutubeUrl] = useState(initialUser.youtubeUrl ?? '');
    // HOS-375 §6.7: opt-in, so it must initialize OFF for anyone who has never
    // chosen. `=== true` and not `??`, since the stored value can be null.
    const [publicProfileShowSocialNetworks, setPublicProfileShowSocialNetworks] = useState(
        initialUser.publicProfileShowSocialNetworks === true
    );

    // ── Form state — location ─────────────────────────────────────────────

    const [country, setCountry] = useState(initialUser.country ?? '');
    const [province, setProvince] = useState(initialUser.province ?? '');
    const [city, setCity] = useState(initialUser.city ?? '');
    const [addressLine1, setAddressLine1] = useState(initialUser.addressLine1 ?? '');
    const [postalCode, setPostalCode] = useState(initialUser.postalCode ?? '');

    // ── Avatar state ──────────────────────────────────────────────────────

    const [avatarUrl, setAvatarUrl] = useState<string>(initialUser.avatarUrl ?? '');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarCompressing, setAvatarCompressing] = useState(false);

    // ── Form meta ─────────────────────────────────────────────────────────
    //
    // Validation is delegated to the shared `useZodForm` primitive (HOS-190
    // slice 3) instead of the old locally-owned `fieldErrors`/`formError`
    // state + `parseZodErrors` helper.

    const { fieldErrors, formError, validate, handleApiError, clearError, setFormError } =
        useZodForm({ schema: ProfileEditFormSchema, t });

    // F6 (HOS-190): the PATCH diff is computed against this MUTABLE baseline,
    // resynced to the persisted values after every successful save (see
    // `handleSubmit`). Without the resync, reverting a just-saved field would
    // diff-empty against the load-time snapshot and be wrongly reported as "no
    // changes" while the DB still held the new value.
    const [baseline, setBaseline] = useState<ProfileSnapshot>(() =>
        buildInitialProfileSnapshot(initialUser)
    );

    /** Snapshot the current form field state for diffing against the baseline. */
    function snapshotFromState(): ProfileSnapshot {
        return {
            displayName,
            firstName,
            lastName,
            birthDate,
            phone,
            bio,
            website,
            occupation,
            facebookUrl,
            instagramUrl,
            twitterUrl,
            linkedinUrl,
            youtubeUrl,
            country,
            province,
            city,
            addressLine1,
            postalCode,
            avatarUrl,
            publicProfileShowSocialNetworks
        };
    }

    const activeImageUrl = previewUrl ?? (avatarUrl || null);
    const initials = getInitials({
        name: displayName || initialUser.displayName,
        email: undefined
    });

    /**
     * Wrap a setter so updating the value also clears that field's
     * inline error (matches the UX from before the polish refactor —
     * users get instant feedback that they've addressed the issue).
     */
    function bindChange(field: string, setter: (value: string) => void): (value: string) => void {
        return (value) => {
            setter(value);
            clearError(field);
        };
    }

    // ── Avatar handlers ───────────────────────────────────────────────────

    function handleAvatarButtonClick(): void {
        fileInputRef.current?.click();
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
            addToast({ type: 'error', message: t('account.avatar.errors.invalidType') });
            return;
        }

        // HOS-1936: resize/recompress BEFORE the size cap is checked, so a heavy
        // phone original that shrinks under the cap is accepted. A compression
        // failure falls back to the original file and never blocks the pick.
        setAvatarCompressing(true);
        let compression: Awaited<ReturnType<typeof compressImageForUpload>>;
        try {
            compression = await compressImageForUpload({ file });
        } finally {
            setAvatarCompressing(false);
        }

        const uploadableFile = compression.file;
        if (uploadableFile.size > MAX_AVATAR_BYTES) {
            addToast({
                type: 'error',
                message: isCompressionUnavailable(compression)
                    ? t('account.avatar.errors.compressionUnsupportedTooLarge', undefined, {
                          maxSize: DEFAULT_AVATAR_MAX_FILE_SIZE_MB
                      })
                    : t(
                          'account.avatar.errors.fileTooLarge',
                          'Archivo muy grande (máx. {{maxSize}} MB)',
                          { maxSize: DEFAULT_AVATAR_MAX_FILE_SIZE_MB }
                      )
            });
            return;
        }

        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const blobUrl = URL.createObjectURL(uploadableFile);
        setPreviewUrl(blobUrl);
        setAvatarFile(uploadableFile);
    }

    const formRef = useRef<HTMLFormElement>(null);
    const { submitting, saved, setSaved, handleSubmit } = useProfileEditSubmit({
        userId: initialUser.id,
        base,
        locale,
        t,
        snapshotFromState,
        baseline,
        setBaseline,
        avatar: {
            file: avatarFile,
            url: avatarUrl,
            previewUrl,
            setUrl: setAvatarUrl,
            setPreviewUrl,
            setFile: setAvatarFile,
            setUploading: setAvatarUploading
        },
        form: { validate, handleApiError, setFormError },
        formRef
    });

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <form
            ref={formRef}
            className={styles.form}
            // HOS-2444: editing anything after a save retires the inline success.
            onChange={() => setSaved(false)}
            onSubmit={(e) => {
                void handleSubmit(e);
            }}
            noValidate
            aria-label={t('account.pages.editProfile.title', 'Editar perfil')}
        >
            <ProfileEditAvatarSection
                activeImageUrl={activeImageUrl}
                initials={initials}
                avatarUploading={avatarUploading}
                avatarCompressing={avatarCompressing}
                submitting={submitting}
                fileInputRef={fileInputRef}
                t={t}
                onChangeClick={handleAvatarButtonClick}
                onFileChange={handleFileChange}
            />

            <ProfileEditPersonalSection
                displayName={displayName}
                firstName={firstName}
                lastName={lastName}
                birthDate={birthDate}
                phone={phone}
                bio={bio}
                fieldErrors={fieldErrors}
                submitting={submitting}
                t={t}
                onDisplayNameChange={bindChange('displayName', setDisplayName)}
                onFirstNameChange={bindChange('firstName', setFirstName)}
                onLastNameChange={bindChange('lastName', setLastName)}
                onBirthDateChange={bindChange('birthDate', setBirthDate)}
                onPhoneChange={bindChange('phone', setPhone)}
                onBioChange={bindChange('bio', setBio)}
            />

            <ProfileEditExtrasSection
                website={website}
                occupation={occupation}
                fieldErrors={fieldErrors}
                submitting={submitting}
                t={t}
                onWebsiteChange={bindChange('website', setWebsite)}
                onOccupationChange={bindChange('occupation', setOccupation)}
            />

            <ProfileEditSocialSection
                facebookUrl={facebookUrl}
                instagramUrl={instagramUrl}
                twitterUrl={twitterUrl}
                linkedinUrl={linkedinUrl}
                youtubeUrl={youtubeUrl}
                showOnPublicProfile={publicProfileShowSocialNetworks}
                fieldErrors={fieldErrors}
                submitting={submitting}
                t={t}
                onShowOnPublicProfileChange={setPublicProfileShowSocialNetworks}
                onFacebookChange={bindChange('facebookUrl', setFacebookUrl)}
                onInstagramChange={bindChange('instagramUrl', setInstagramUrl)}
                onTwitterChange={bindChange('twitterUrl', setTwitterUrl)}
                onLinkedinChange={bindChange('linkedinUrl', setLinkedinUrl)}
                onYoutubeChange={bindChange('youtubeUrl', setYoutubeUrl)}
            />

            <ProfileEditLocationSection
                country={country}
                province={province}
                city={city}
                addressLine1={addressLine1}
                postalCode={postalCode}
                fieldErrors={fieldErrors}
                submitting={submitting}
                t={t}
                onCountryChange={bindChange('country', setCountry)}
                onProvinceChange={bindChange('province', setProvince)}
                onCityChange={bindChange('city', setCity)}
                onAddressLine1Change={bindChange('addressLine1', setAddressLine1)}
                onPostalCodeChange={bindChange('postalCode', setPostalCode)}
            />

            <ProfileEditSecuritySection
                locale={locale}
                t={t}
                hasPassword={hasPassword}
            />

            {formError && (
                <div
                    className={`${styles.feedbackBanner} ${styles.feedbackBannerError}`}
                    role="alert"
                    aria-live="polite"
                >
                    {formError}
                </div>
            )}

            {saved && (
                <div
                    className={`${styles.feedbackBanner} ${styles.feedbackBannerSuccess}`}
                    role="status"
                >
                    {t('account.editProfile.success', 'Perfil actualizado correctamente')}
                </div>
            )}

            <div className={styles.submitRow}>
                <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={submitting || avatarUploading || avatarCompressing}
                >
                    {submitting
                        ? t('account.editProfile.saving', 'Guardando…')
                        : t('account.editProfile.save', 'Guardar cambios')}
                </button>
            </div>
        </form>
    );
}
