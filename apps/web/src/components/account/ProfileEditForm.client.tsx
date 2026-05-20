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

import { translateApiError } from '@/lib/api-errors';
import { getInitials } from '@/lib/avatar-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { ProfileEditSchema } from '@repo/schemas';
import { useRef, useState } from 'react';
import { ProfileEditAvatarSection } from './ProfileEditAvatarSection';
import { ProfileEditExtrasSection } from './ProfileEditExtrasSection';
import { type ProfileEditFieldErrors, parseZodErrors } from './ProfileEditForm.helpers';
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

    const [fieldErrors, setFieldErrors] = useState<ProfileEditFieldErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

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
    function bindChange(
        field: keyof ProfileEditFieldErrors,
        setter: (value: string) => void
    ): (value: string) => void {
        return (value) => {
            setter(value);
            if (fieldErrors[field]) {
                setFieldErrors((prev) => {
                    if (!prev[field]) return prev;
                    const next = { ...prev };
                    delete next[field];
                    return next;
                });
            }
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

        const parsed = ProfileEditSchema.safeParse(
            omitUndefined({
                displayName: displayName.trim(),
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                bio: bio.trim() || undefined,
                avatarUrl: avatarUrl || undefined,
                phone: phone.trim() || undefined,
                birthDate: birthDate || undefined,
                website: website.trim() || undefined,
                occupation: occupation.trim() || undefined,
                facebookUrl: facebookUrl.trim() || undefined,
                instagramUrl: instagramUrl.trim() || undefined,
                twitterUrl: twitterUrl.trim() || undefined,
                linkedinUrl: linkedinUrl.trim() || undefined,
                youtubeUrl: youtubeUrl.trim() || undefined,
                addressLine1: addressLine1.trim() || undefined,
                city: city.trim() || undefined,
                province: province.trim() || undefined,
                country: country.trim() || undefined,
                postalCode: postalCode.trim() || undefined
            })
        );

        if (!parsed.success) {
            setFieldErrors(parseZodErrors(parsed.error.issues));
            return;
        }

        setFieldErrors({});
        setSubmitting(true);

        try {
            let finalAvatarUrl = parsed.data.avatarUrl;

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

            // Build payload — required fields always; optional fields only
            // when they differ from the initial value (avoids clobbering
            // server state with stale empty strings).
            //
            // SPEC-113 follow-up: the User entity in the DB stores several
            // groups of fields inside JSONB columns instead of as separate
            // top-level columns. The form surface uses flat field names
            // (phone, country, facebookUrl, …) for UX reasons; the PATCH
            // payload has to nest them so the API actually persists them.
            //
            //   - phone        → contactInfo.mobilePhone
            //   - website      → profile.website (and contactInfo.website)
            //   - bio/occupation → profile.{bio, occupation}
            //   - country/province/city/addressLine1/postalCode → location.*
            //   - facebookUrl/instagramUrl/… → socialNetworks.{facebook, …}
            const payload: Record<string, unknown> = {
                displayName: parsed.data.displayName,
                firstName: parsed.data.firstName,
                lastName: parsed.data.lastName
            };
            if (finalAvatarUrl !== undefined) payload.image = finalAvatarUrl;
            if (parsed.data.birthDate !== undefined) {
                payload.birthDate = parsed.data.birthDate;
            }

            // ── profile JSONB (bio, website, occupation) ──────────────────
            // Send the FULL profile block whenever any of its fields
            // changed, so the API receives a self-consistent JSONB value
            // regardless of whether it shallow-merges or replaces.
            const bioTrim = bio.trim();
            const websiteTrim = website.trim();
            const occupationTrim = occupation.trim();
            const originalWebsite = (
                initialUser.website ??
                initialUser.profile?.website ??
                ''
            ).trim();
            const profileChanged =
                bioTrim !== (initialUser.profile?.bio ?? '').trim() ||
                websiteTrim !== originalWebsite ||
                occupationTrim !== (initialUser.profile?.occupation ?? '').trim();
            if (profileChanged) {
                const profilePatch: Record<string, string> = {};
                if (bioTrim.length > 0) profilePatch.bio = bioTrim;
                if (websiteTrim.length > 0) profilePatch.website = websiteTrim;
                if (occupationTrim.length > 0) profilePatch.occupation = occupationTrim;
                payload.profile = profilePatch;
            }

            // ── contactInfo JSONB (mobilePhone) ───────────────────────────
            if (phone.trim() !== (initialUser.phone ?? '').trim()) {
                // Phone in DB is required-when-present per ContactInfoSchema,
                // so we omit the key entirely on clear; otherwise we set
                // contactInfo.mobilePhone to the new value.
                if (phone.trim().length > 0) {
                    payload.contactInfo = { mobilePhone: phone.trim() };
                }
            }

            // ── socialNetworks JSONB ──────────────────────────────────────
            const socialPatch: Record<string, string> = {};
            const socialMap: ReadonlyArray<{
                form: string;
                jsonKey: 'facebook' | 'instagram' | 'twitter' | 'linkedIn' | 'youtube';
                original: string | null | undefined;
            }> = [
                { form: facebookUrl, jsonKey: 'facebook', original: initialUser.facebookUrl },
                { form: instagramUrl, jsonKey: 'instagram', original: initialUser.instagramUrl },
                { form: twitterUrl, jsonKey: 'twitter', original: initialUser.twitterUrl },
                { form: linkedinUrl, jsonKey: 'linkedIn', original: initialUser.linkedinUrl },
                { form: youtubeUrl, jsonKey: 'youtube', original: initialUser.youtubeUrl }
            ];
            let socialChanged = false;
            for (const { form, jsonKey, original } of socialMap) {
                const trimmed = form.trim();
                if (trimmed !== (original ?? '').trim()) socialChanged = true;
                if (trimmed.length > 0) socialPatch[jsonKey] = trimmed;
            }
            if (socialChanged) {
                payload.socialNetworks = socialPatch;
            }

            // ── location JSONB ────────────────────────────────────────────
            const locationPatch: Record<string, string> = {};
            const locationChanged =
                country.trim() !== (initialUser.country ?? '').trim() ||
                province.trim() !== (initialUser.province ?? '').trim() ||
                city.trim() !== (initialUser.city ?? '').trim() ||
                addressLine1.trim() !== (initialUser.addressLine1 ?? '').trim() ||
                postalCode.trim() !== (initialUser.postalCode ?? '').trim();
            if (country.trim().length > 0) locationPatch.country = country.trim();
            if (province.trim().length > 0) locationPatch.region = province.trim();
            if (city.trim().length > 0) locationPatch.city = city.trim();
            if (addressLine1.trim().length > 0) locationPatch.addressLine1 = addressLine1.trim();
            if (postalCode.trim().length > 0) locationPatch.postalCode = postalCode.trim();
            if (locationChanged) {
                payload.location = locationPatch;
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
                const msg = translateApiError({
                    error: apiError,
                    t,
                    fallback: localizedFallback
                });
                setFormError(msg);
                addToast({ type: 'error', message: msg });
                return;
            }

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
