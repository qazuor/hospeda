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

import { useRef, useState } from 'react';
import { translateApiError } from '@/lib/api-errors';
import { getInitials } from '@/lib/avatar-utils';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { ProfileEditAvatarSection } from './ProfileEditAvatarSection';
import { ProfileEditExtrasSection } from './ProfileEditExtrasSection';
import {
    buildInitialProfileSnapshot,
    buildProfilePatch,
    ProfileEditFormSchema,
    type ProfileSnapshot
} from './ProfileEditForm.helpers';
import styles from './ProfileEditForm.module.css';
import { ProfileEditLocationSection } from './ProfileEditLocationSection';
import { ProfileEditPersonalSection } from './ProfileEditPersonalSection';
import { ProfileEditSocialSection } from './ProfileEditSocialSection';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

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
}

interface ProfileEditFormProps {
    readonly initialUser: ProfileEditUser;
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
}

interface ApiResponse<T> {
    readonly success: boolean;
    readonly data?: T;
    readonly error?: { readonly message: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Upload a file to the media endpoint and return the persisted URL.
 */
async function uploadAvatarFile({
    file,
    base,
    locale,
    fallbackMessage
}: {
    readonly file: File;
    readonly base: string;
    readonly locale?: SupportedLocale;
    readonly fallbackMessage: string;
}): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${base}/api/v1/protected/media/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
    });

    if (!res.ok) {
        let apiError: { code?: string; message?: string } | undefined;
        try {
            const body = (await res.json()) as ApiResponse<unknown>;
            if (body.error) apiError = body.error;
        } catch {
            // ignore — keep apiError undefined; helper will use fallback
        }
        throw new Error(translateApiError({ error: apiError, locale, fallback: fallbackMessage }));
    }

    const body = (await res.json()) as ApiResponse<{ url: string }>;
    const url = body.data?.url;
    if (!url) throw new Error(fallbackMessage);
    return url;
}

/**
 * Drop keys whose value is `undefined`. `ProfileEditSchema` is a
 * `z.strictObject`, so unknown keys cause validation failures — but a
 * field literally set to `undefined` still counts as a present key in
 * JS (`{a: undefined}` has key `a`). Filtering them out keeps the
 * payload compatible with the strict schema while letting the caller
 * write the natural `value || undefined` pattern.
 */
function omitUndefined(input: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
        if (v !== undefined) out[k] = v;
    }
    return out;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Profile edit form island. Pre-fills from the server-fetched user,
 * validates with `ProfileEditSchema`, uploads avatar then PATCHes the
 * profile.
 *
 * @param props - Component props (see {@link ProfileEditFormProps})
 */
export function ProfileEditForm({ initialUser, locale, apiUrl }: ProfileEditFormProps) {
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

    // ── Form meta ─────────────────────────────────────────────────────────
    //
    // Validation is delegated to the shared `useZodForm` primitive (HOS-190
    // slice 3) instead of the old locally-owned `fieldErrors`/`formError`
    // state + `parseZodErrors` helper.

    const { fieldErrors, formError, validate, handleApiError, clearError, setFormError } =
        useZodForm({ schema: ProfileEditFormSchema, t });
    const [submitting, setSubmitting] = useState(false);

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
            avatarUrl
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

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
            addToast({ type: 'error', message: t('account.avatar.errors.invalidType') });
            return;
        }
        if (file.size > MAX_AVATAR_BYTES) {
            addToast({ type: 'error', message: t('account.avatar.errors.fileTooLarge') });
            return;
        }

        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const blobUrl = URL.createObjectURL(file);
        setPreviewUrl(blobUrl);
        setAvatarFile(file);
    }

    // ── Submit ────────────────────────────────────────────────────────────

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setFormError(null);

        const current = snapshotFromState();
        const {
            flatChanged,
            payload: fieldPayload,
            clearedRequiredNames
        } = buildProfilePatch({ current, baseline });

        // BETA-189 P1: a visually-required name (displayName/firstName/lastName)
        // that HAD a value at baseline and is now empty is a "clear" the server
        // silently drops — block + announce it inline instead of reporting a
        // misleading success. A name that was NEVER set (baseline empty) stays
        // omitted, so an incomplete OAuth signup can still save unrelated fields
        // (read⊇write).
        if (clearedRequiredNames.length > 0) {
            handleApiError({
                details: clearedRequiredNames.map((field) => ({
                    field,
                    message: t(
                        `account.editProfile.errors.${field}Required`,
                        'Este campo es obligatorio'
                    )
                }))
            });
            addToast({
                type: 'error',
                message: t('validation.formHasErrors', 'Revisá los campos marcados')
            });
            return;
        }

        // BETA-189 P2 + F6: only report success when a real change was persisted.
        // A diff-empty submit shows a "no changes" info toast (mirroring the
        // AccommodationEditor) instead of a misleading "profile updated".
        const avatarChanged = avatarFile !== null || avatarUrl !== baseline.avatarUrl;
        if (Object.keys(fieldPayload).length === 0 && !avatarChanged) {
            addToast({
                type: 'info',
                message: t('account.editProfile.noChanges', 'No hay cambios para guardar')
            });
            return;
        }

        // Validate ONLY the changed fields (read⊇write): a pre-existing invalid
        // value the user is not touching never blocks an unrelated save. This is
        // also where the server-aligned bio bound (min 10 / max 300) is enforced
        // client-side — BETA-189 P4.
        const parsed = validate(omitUndefined(flatChanged));

        if (!parsed.success) {
            return;
        }

        setSubmitting(true);

        try {
            let finalAvatarUrl: string | undefined = avatarUrl || undefined;

            if (avatarFile) {
                setAvatarUploading(true);
                try {
                    const uploaded = await uploadAvatarFile({
                        file: avatarFile,
                        base,
                        locale,
                        fallbackMessage: t(
                            'account.avatar.errors.uploadFailed',
                            'No se pudo subir la imagen. Probá de nuevo.'
                        )
                    });
                    finalAvatarUrl = uploaded;
                    setAvatarUrl(uploaded);
                    if (previewUrl) {
                        URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                    }
                    setAvatarFile(null);
                } finally {
                    setAvatarUploading(false);
                }
            }

            // Assemble the API payload from the computed diff (see
            // `buildProfilePatch` for the flat→JSONB nesting rules:
            // phone→contactInfo.mobilePhone, bio/website/occupation→profile.*,
            // country/province/city/…→location.*, facebookUrl/…→socialNetworks.*)
            // plus the avatar, which is only sent when it actually changed vs the
            // baseline (so an unchanged existing avatar never forces a non-empty
            // PATCH and defeats the "no changes" path above).
            const payload: Record<string, unknown> = { ...fieldPayload };
            if (finalAvatarUrl !== undefined && finalAvatarUrl !== baseline.avatarUrl) {
                payload.image = finalAvatarUrl;
            }

            const res = await fetch(`${base}/api/v1/protected/users/${initialUser.id}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const localizedFallback = t(
                    'account.editProfile.errors.saveFailed',
                    'No se pudo guardar el perfil'
                );
                let apiError: { code?: string; message?: string } | undefined;
                try {
                    const body = (await res.json()) as ApiResponse<unknown>;
                    if (body.error) apiError = body.error;
                } catch {
                    // ignore — keep apiError undefined; helper will use fallback
                }
                // handleApiError sets fieldErrors/formError via the shared
                // primitive (falls back to the banner since this route sends
                // no per-field `details` in production — see field-errors.ts
                // module doc); the toast reuses the same resolved text.
                const msg = translateApiError({
                    error: apiError,
                    t,
                    fallback: localizedFallback
                });
                handleApiError(apiError, localizedFallback);
                addToast({ type: 'error', message: msg });
                return;
            }

            // F6: resync the baseline to what is now persisted (the current
            // snapshot, carrying the uploaded avatar URL) so a subsequent revert
            // of a just-saved field is correctly detected as a change.
            setBaseline({ ...current, avatarUrl: finalAvatarUrl ?? current.avatarUrl });
            addToast({
                type: 'success',
                message: t('account.editProfile.success', 'Perfil actualizado correctamente')
            });
        } catch (err) {
            const msg =
                err instanceof Error
                    ? err.message
                    : t('account.editProfile.errors.saveFailed', 'No se pudo guardar el perfil');
            setFormError(msg);
            addToast({ type: 'error', message: msg });
        } finally {
            setSubmitting(false);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <form
            className={styles.form}
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
                fieldErrors={fieldErrors}
                submitting={submitting}
                t={t}
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

            {formError && (
                <div
                    className={`${styles.feedbackBanner} ${styles.feedbackBannerError}`}
                    role="alert"
                    aria-live="polite"
                >
                    {formError}
                </div>
            )}

            <div className={styles.submitRow}>
                <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={submitting || avatarUploading}
                >
                    {submitting
                        ? t('account.editProfile.saving', 'Guardando…')
                        : t('account.editProfile.save', 'Guardar cambios')}
                </button>
            </div>
        </form>
    );
}
