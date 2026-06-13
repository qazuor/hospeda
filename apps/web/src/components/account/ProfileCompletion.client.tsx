/**
 * @file ProfileCompletion.client.tsx
 * @description React island for the post-signup profile completion form (SPEC-113).
 *
 * Orchestrator: owns ALL state and handlers, then delegates rendering to
 * four pure subcomponents (in render order):
 *   1. ProfileCompletionBasicFields   (avatar, name, displayName, birthDate)
 *   2. ProfileCompletionContactFields (phone, locale)
 *   3. ProfileCompletionMoreDetails   (collapsible: bio, website, occupation, socials, location)
 *   4. ProfileCompletionConsentFields (newsletter opt-in, terms acceptance)
 *
 * Consent fields are kept at the END of the form so the user makes those
 * decisions after providing all profile data.
 *
 * On success, redirects to the set-password screen if `requiresSetPassword === true`,
 * otherwise to `/[lang]/mi-cuenta/`.
 *
 * Hydration: caller MUST use `client:load`.
 */

import { refreshBetterAuthSession } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useState } from 'react';
import {
    type ProfileCompletionFieldErrors,
    type ProfileCompletionPayload,
    type SocialPlatform,
    computeDisplayName,
    validateProfileCompletionFields
} from './ProfileCompletion.helpers';
import styles from './ProfileCompletion.module.css';
import { ProfileCompletionBasicFields } from './ProfileCompletionBasicFields';
import { ProfileCompletionConsentFields } from './ProfileCompletionConsentFields';
import { ProfileCompletionContactFields } from './ProfileCompletionContactFields';
import { ProfileCompletionMoreDetails } from './ProfileCompletionMoreDetails';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the ProfileCompletion island. */
export interface ProfileCompletionProps {
    /** Active locale for i18n and locale pre-fill. */
    readonly locale: SupportedLocale;
    /** API base URL (PUBLIC_API_URL from env). */
    readonly apiUrl: string;
    /**
     * Pre-filled display name from the session (OAuth provider or email signup).
     * @deprecated Use initialFirstName + initialLastName when available.
     */
    readonly initialDisplayName?: string;
    /** Pre-filled first name from the OAuth provider profile. */
    readonly initialFirstName?: string;
    /** Pre-filled last name from the OAuth provider profile. */
    readonly initialLastName?: string;
    /** OAuth avatar URL from the provider (users.image). */
    readonly initialAvatarUrl?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Converts a dd/mm/yyyy string into ISO YYYY-MM-DD. Returns null when the
 * input doesn't match the expected shape so the caller can skip the field.
 */
function ddmmyyyyToIso(value: string): string | null {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Profile completion form island.
 *
 * Renders a form that collects baseline profile data for first-time users.
 * Posts to the profile completion endpoint and redirects based on the response.
 *
 * @param props - Component props (see {@link ProfileCompletionProps})
 */
export function ProfileCompletion({
    locale,
    apiUrl,
    initialDisplayName = '',
    initialFirstName = '',
    initialLastName = '',
    initialAvatarUrl
}: ProfileCompletionProps) {
    const { t } = createTranslations(locale);

    // ── Required fields ───────────────────────────────────────────────────────

    const [firstName, setFirstName] = useState(initialFirstName);
    const [lastName, setLastName] = useState(initialLastName);

    const [displayNameOverride, setDisplayNameOverride] = useState(
        initialDisplayName && !initialFirstName ? initialDisplayName : ''
    );
    const [displayNameTouched, setDisplayNameTouched] = useState(false);

    const derivedDisplayName = computeDisplayName({
        firstName,
        lastName,
        override: displayNameTouched ? displayNameOverride : ''
    });

    function handleDisplayNameChange(value: string): void {
        setDisplayNameOverride(value);
        setDisplayNameTouched(true);
    }

    function handleFirstNameChange(value: string): void {
        setFirstName(value);
        if (!displayNameTouched) setDisplayNameOverride('');
    }

    function handleLastNameChange(value: string): void {
        setLastName(value);
        if (!displayNameTouched) setDisplayNameOverride('');
    }

    // ── Optional fields ───────────────────────────────────────────────────────

    const [birthDate, setBirthDate] = useState('');
    const [imageUrl, setImageUrl] = useState(initialAvatarUrl ?? '');
    const [phoneCode, setPhoneCode] = useState('+54');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>(locale);
    // Newsletter defaults to TRUE — pre-checked so the user opts OUT explicitly.
    // The terms checkbox stays unchecked: acceptance must be an explicit action.
    const [newsletter, setNewsletter] = useState(true);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    // ── "Más detalles" section ────────────────────────────────────────────────

    const [detailsOpen, setDetailsOpen] = useState(false);
    const [bio, setBio] = useState('');
    const [website, setWebsite] = useState('');
    const [occupation, setOccupation] = useState('');
    const [socialNetworks, setSocialNetworks] = useState<Partial<Record<SocialPlatform, string>>>(
        {}
    );
    const [locationCountry, setLocationCountry] = useState('');
    const [locationRegion, setLocationRegion] = useState('');
    const [locationCity, setLocationCity] = useState('');

    // ── Form meta state ───────────────────────────────────────────────────────

    const [errors, setErrors] = useState<ProfileCompletionFieldErrors>({});
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Build E.164-compatible phone string. */
    function buildPhone(): string | undefined {
        const trimmed = phoneNumber.trim();
        if (!trimmed) return undefined;
        return `${phoneCode}${trimmed.replace(/[\s\-().]/g, '')}`;
    }

    /**
     * Map raw validation error tokens to translated messages, returning an
     * errors object with human-readable strings for subcomponent rendering.
     */
    function translateErrors(raw: ProfileCompletionFieldErrors): ProfileCompletionFieldErrors {
        const map: Record<string, string> = {
            firstName_required: t(
                'account.profileCompletion.errors.firstNameRequired',
                'El nombre es obligatorio.'
            ),
            firstName_max: t(
                'account.profileCompletion.errors.firstNameMax',
                'El nombre no puede superar los 50 caracteres.'
            ),
            lastName_required: t(
                'account.profileCompletion.errors.lastNameRequired',
                'El apellido es obligatorio.'
            ),
            lastName_max: t(
                'account.profileCompletion.errors.lastNameMax',
                'El apellido no puede superar los 50 caracteres.'
            ),
            birthDate_invalid: t(
                'account.profileCompletion.errors.birthDateInvalid',
                'Ingresá una fecha válida (dd/mm/yyyy).'
            ),
            phone_format: t(
                'account.profileCompletion.errors.phoneFormat',
                'Ingresá un número de teléfono válido con código de país.'
            ),
            terms_required: t(
                'account.profileCompletion.errors.termsRequired',
                'Tenés que aceptar los términos para continuar.'
            ),
            bio_min: t(
                'account.profileCompletion.errors.bioMin',
                'La bio debe tener al menos 10 caracteres.'
            ),
            bio_max: t(
                'account.profileCompletion.errors.bioMax',
                'La bio no puede superar los 300 caracteres.'
            ),
            website_url: t(
                'account.profileCompletion.errors.websiteUrl',
                'Ingresá una URL válida (ej: https://mipagina.com).'
            ),
            occupation_min: t(
                'account.profileCompletion.errors.occupationMin',
                'La ocupación debe tener al menos 2 caracteres.'
            ),
            occupation_max: t(
                'account.profileCompletion.errors.occupationMax',
                'La ocupación no puede superar los 100 caracteres.'
            )
        };

        const translated: ProfileCompletionFieldErrors = {};
        for (const [field, token] of Object.entries(raw) as [
            keyof ProfileCompletionFieldErrors,
            string
        ][]) {
            translated[field] = map[`${field}_${token}`] ?? `${field}: ${token}`;
        }
        return translated;
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setGlobalError(null);

        const phone = buildPhone() ?? '';
        const rawErrors = validateProfileCompletionFields({
            firstName,
            lastName,
            phone,
            birthDate,
            acceptedTerms,
            bio: bio || undefined,
            website: website || undefined,
            occupation: occupation || undefined
        });

        if (Object.keys(rawErrors).length > 0) {
            setErrors(translateErrors(rawErrors));
            if (rawErrors.bio || rawErrors.website || rawErrors.occupation) {
                setDetailsOpen(true);
            }
            return;
        }

        setErrors({});
        setSubmitting(true);

        try {
            // The birthDate input collects dd/mm/yyyy; the API expects ISO
            // YYYY-MM-DD per the Zod schema. Drop the field when the user
            // hasn't typed a complete date.
            const birthDateIso = ddmmyyyyToIso(birthDate);

            const body: ProfileCompletionPayload = {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                displayName: derivedDisplayName,
                acceptedTerms: true,
                ...(birthDateIso && { birthDate: birthDateIso }),
                ...(imageUrl && imageUrl !== initialAvatarUrl && { imageUrl }),
                ...(phone && { phone }),
                locale: selectedLocale,
                newsletterOptIn: newsletter,
                ...(bio.trim() && { bio: bio.trim() }),
                ...(website.trim() && { website: website.trim() }),
                ...(occupation.trim() && { occupation: occupation.trim() }),
                ...(Object.keys(socialNetworks).length > 0 && { socialNetworks }),
                ...(locationCountry && {
                    location: {
                        country: locationCountry,
                        ...(locationRegion.trim() && { region: locationRegion.trim() }),
                        ...(locationCity.trim() && { city: locationCity.trim() })
                    }
                })
            };

            const response = await fetch(`${apiUrl}/api/v1/protected/profile/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = (await response.json()) as {
                    error?: { message?: string };
                };
                setGlobalError(
                    errorData?.error?.message ??
                        t(
                            'account.profileCompletion.errors.submitFailed',
                            'No se pudo completar el perfil. Intentá nuevamente.'
                        )
                );
                return;
            }

            const result = (await response.json()) as {
                data?: { profileCompleted?: boolean; requiresSetPassword?: boolean };
            };

            await refreshBetterAuthSession();

            if (result.data?.requiresSetPassword) {
                window.location.href = `/${locale}/mi-cuenta/agregar-contrasena/`;
            } else {
                window.location.href = `/${locale}/mi-cuenta/`;
            }
        } catch {
            setGlobalError(
                t(
                    'account.profileCompletion.errors.submitFailed',
                    'No se pudo completar el perfil. Intentá nuevamente.'
                )
            );
        } finally {
            setSubmitting(false);
        }
    }

    // ── Social network handler ────────────────────────────────────────────────

    function handleSocialNetworkChange(platform: SocialPlatform, value: string): void {
        setSocialNetworks((prev) => ({ ...prev, [platform]: value || undefined }));
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <h1 className={styles.heading}>
                    {t('account.profileCompletion.heading', '¡Bienvenido a Hospeda!')}
                </h1>
                <p className={styles.subheading}>
                    {t(
                        'account.profileCompletion.subheading',
                        'Antes de continuar, completá tu perfil para que podamos personalizar tu experiencia.'
                    )}
                </p>
            </div>

            <div className={styles.card}>
                <form
                    className={styles.form}
                    onSubmit={handleSubmit}
                    noValidate
                >
                    <ProfileCompletionBasicFields
                        locale={locale}
                        apiUrl={apiUrl}
                        firstName={firstName}
                        lastName={lastName}
                        displayNameValue={
                            displayNameTouched ? displayNameOverride : derivedDisplayName
                        }
                        birthDate={birthDate}
                        imageUrl={imageUrl}
                        initialAvatarUrl={initialAvatarUrl}
                        errors={errors}
                        submitting={submitting}
                        t={t}
                        onFirstNameChange={handleFirstNameChange}
                        onLastNameChange={handleLastNameChange}
                        onDisplayNameChange={handleDisplayNameChange}
                        onBirthDateChange={setBirthDate}
                        onImageUrlChange={setImageUrl}
                        derivedDisplayName={derivedDisplayName}
                    />

                    <ProfileCompletionContactFields
                        phoneCode={phoneCode}
                        phoneNumber={phoneNumber}
                        selectedLocale={selectedLocale}
                        errors={errors}
                        submitting={submitting}
                        t={t}
                        onPhoneCodeChange={setPhoneCode}
                        onPhoneNumberChange={setPhoneNumber}
                        onLocaleChange={setSelectedLocale}
                    />

                    <ProfileCompletionMoreDetails
                        detailsOpen={detailsOpen}
                        bio={bio}
                        website={website}
                        occupation={occupation}
                        socialNetworks={socialNetworks}
                        locationCountry={locationCountry}
                        locationRegion={locationRegion}
                        locationCity={locationCity}
                        errors={errors}
                        submitting={submitting}
                        t={t}
                        onDetailsToggle={() => setDetailsOpen((v) => !v)}
                        onBioChange={setBio}
                        onWebsiteChange={setWebsite}
                        onOccupationChange={setOccupation}
                        onSocialNetworkChange={handleSocialNetworkChange}
                        onLocationCountryChange={setLocationCountry}
                        onLocationRegionChange={setLocationRegion}
                        onLocationCityChange={setLocationCity}
                    />

                    <ProfileCompletionConsentFields
                        locale={locale}
                        newsletter={newsletter}
                        acceptedTerms={acceptedTerms}
                        errors={errors}
                        submitting={submitting}
                        t={t}
                        onNewsletterChange={setNewsletter}
                        onAcceptedTermsChange={setAcceptedTerms}
                    />

                    {/* ── Global error banner ────────────────────────────── */}
                    {globalError && (
                        <div
                            className={`${styles.feedbackBanner} ${styles.feedbackBannerError}`}
                            role="alert"
                        >
                            {globalError}
                        </div>
                    )}

                    {/* ── Submit ─────────────────────────────────────────── */}
                    <div className={styles.submitRow}>
                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <span
                                        className={styles.spinner}
                                        aria-hidden="true"
                                    />
                                    {t('account.profileCompletion.submitting', 'Guardando...')}
                                </>
                            ) : (
                                t('account.profileCompletion.submit', 'Completar perfil')
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
