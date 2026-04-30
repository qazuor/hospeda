/**
 * @file ProfileEditForm.client.tsx
 * @description React island for editing a user's public profile.
 *
 * Validates input client-side using `ProfileEditSchema` from `@repo/schemas`.
 * On submit, optionally uploads a new avatar via the media endpoint (T-036),
 * then PATCHes the user profile. Uses only native HTML form + React state —
 * no react-hook-form (web-app convention: native forms only).
 *
 * Hydration: caller must use `client:load`.
 */

import { getInitials } from '@/lib/avatar-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import type { ProfileEditInput } from '@repo/schemas';
import { ProfileEditSchema } from '@repo/schemas';
import { useRef, useState } from 'react';
import styles from './ProfileEditForm.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Accepted image MIME types for avatar upload */
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Max avatar file size (5 MB) */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal user shape needed to pre-populate the form */
export interface ProfileEditUser {
    readonly id: string;
    readonly displayName?: string | null;
    readonly firstName?: string | null;
    readonly lastName?: string | null;
    readonly avatarUrl?: string | null;
    readonly phone?: string | null;
    readonly profile?: {
        readonly bio?: string | null;
    } | null;
}

interface ProfileEditFormProps {
    /** Pre-populated user data */
    readonly initialUser: ProfileEditUser;
    /** Active locale for i18n */
    readonly locale: SupportedLocale;
    /** API base URL (PUBLIC_API_URL from env) */
    readonly apiUrl: string;
}

/** Validated field errors keyed by field name */
type FieldErrors = Partial<Record<keyof ProfileEditInput, string>>;

/** API response wrapper shape */
interface ApiResponse<T> {
    readonly success: boolean;
    readonly data?: T;
    readonly error?: { readonly message: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve field-level Zod error messages into a simple record.
 * Accepts generic Zod issue shape (path is PropertyKey[] in Zod v4).
 */
function parseZodErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of issues) {
        const key = String(issue.path[0] ?? '');
        if (key) errors[key] = issue.message;
    }
    return errors as FieldErrors;
}

/**
 * Upload a file to the media endpoint.
 *
 * @returns The uploaded image URL.
 */
async function uploadAvatarFile({
    file,
    base
}: {
    readonly file: File;
    readonly base: string;
}): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${base}/api/v1/protected/media/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
    });

    if (!res.ok) {
        let msg = 'Error al subir la imagen';
        try {
            const body = (await res.json()) as ApiResponse<unknown>;
            if (body.error?.message) msg = body.error.message;
        } catch {
            // ignore
        }
        throw new Error(msg);
    }

    const body = (await res.json()) as ApiResponse<{ url: string }>;
    const url = body.data?.url;
    if (!url) throw new Error('Respuesta inesperada del servidor al subir imagen');
    return url;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Profile edit form island.
 *
 * Validates fields with `ProfileEditSchema`, supports avatar preview + upload
 * before saving, and patches the user via the protected API.
 */
export function ProfileEditForm({ initialUser, locale, apiUrl }: ProfileEditFormProps) {
    const { t } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Form state ────────────────────────────────────────────────────────

    const [displayName, setDisplayName] = useState(initialUser.displayName ?? '');
    const [firstName, setFirstName] = useState(initialUser.firstName ?? '');
    const [lastName, setLastName] = useState(initialUser.lastName ?? '');
    const [bio, setBio] = useState(initialUser.profile?.bio ?? '');
    const [phone, setPhone] = useState(initialUser.phone ?? '');

    // avatarUrl tracks the final persisted URL; previewUrl is the blob: URL
    const [avatarUrl, setAvatarUrl] = useState<string>(initialUser.avatarUrl ?? '');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarUploading, setAvatarUploading] = useState(false);

    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Active preview image: local blob first, then persisted URL, then null
    const activeImageUrl = previewUrl ?? (avatarUrl || null);
    const initials = getInitials({ name: initialUser.displayName, email: undefined });

    // ── Avatar handling ───────────────────────────────────────────────────

    function handleAvatarButtonClick() {
        fileInputRef.current?.click();
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        // Reset so same file can be re-selected
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

        // Revoke any prior blob URL
        if (previewUrl) URL.revokeObjectURL(previewUrl);

        const blobUrl = URL.createObjectURL(file);
        setPreviewUrl(blobUrl);
        setAvatarFile(file);
    }

    // ── Form validation ───────────────────────────────────────────────────

    function validateForm(): ProfileEditInput | null {
        const result = ProfileEditSchema.safeParse({
            displayName: displayName.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            bio: bio.trim() || undefined,
            avatarUrl: avatarUrl || undefined,
            phone: phone.trim() || undefined
        });

        if (!result.success) {
            setFieldErrors(parseZodErrors(result.error.issues));
            return null;
        }

        setFieldErrors({});
        return result.data;
    }

    // ── Submit ────────────────────────────────────────────────────────────

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setFormError(null);

        const validated = validateForm();
        if (!validated) return;

        setSubmitting(true);

        try {
            let finalAvatarUrl = validated.avatarUrl;

            // T-036: upload pending avatar file before saving profile
            if (avatarFile) {
                setAvatarUploading(true);
                try {
                    const uploaded = await uploadAvatarFile({ file: avatarFile, base });
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

            const payload: Record<string, unknown> = {
                displayName: validated.displayName,
                firstName: validated.firstName,
                lastName: validated.lastName
            };
            if (validated.bio !== undefined) payload.bio = validated.bio;
            if (finalAvatarUrl !== undefined) payload.image = finalAvatarUrl;
            if (validated.phone !== undefined) payload.phone = validated.phone;

            const res = await fetch(`${base}/api/v1/protected/users/${initialUser.id}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                let msg = t(
                    'account.editProfile.errors.saveFailed',
                    'No se pudo guardar el perfil'
                );
                try {
                    const body = (await res.json()) as ApiResponse<unknown>;
                    if (body.error?.message) msg = body.error.message;
                } catch {
                    // ignore
                }
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
            {/* ── Avatar section (T-036) ─────────────────────────────── */}
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
                            onClick={handleAvatarButtonClick}
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
                            onChange={handleFileChange}
                            aria-label={t(
                                'account.avatar.fileInputLabel',
                                'Seleccionar imagen de perfil'
                            )}
                        />
                    </div>
                </div>
            </section>

            {/* ── Personal info ──────────────────────────────────────── */}
            <section
                className={styles.section}
                aria-labelledby="personal-section-title"
            >
                <h3
                    className={styles.sectionTitle}
                    id="personal-section-title"
                >
                    {t('account.pages.editProfile.personalSection', 'Información personal')}
                </h3>
                <div className={styles.grid}>
                    {/* displayName */}
                    <div className={`${styles.field} ${styles.fullWidth}`}>
                        <label
                            className={styles.label}
                            htmlFor="displayName"
                        >
                            {t('account.editProfile.fields.displayName', 'Nombre visible')}
                            <span
                                className={styles.required}
                                aria-hidden="true"
                            >
                                *
                            </span>
                        </label>
                        <input
                            id="displayName"
                            type="text"
                            className={`${styles.input} ${fieldErrors.displayName ? styles.inputError : ''}`}
                            value={displayName}
                            onChange={(e) => {
                                setDisplayName(e.target.value);
                                if (fieldErrors.displayName) {
                                    setFieldErrors((prev) => ({ ...prev, displayName: undefined }));
                                }
                            }}
                            aria-required="true"
                            aria-describedby={
                                fieldErrors.displayName ? 'displayName-error' : undefined
                            }
                            maxLength={100}
                            autoComplete="nickname"
                        />
                        {fieldErrors.displayName && (
                            <p
                                id="displayName-error"
                                className={styles.errorMsg}
                                role="alert"
                            >
                                {fieldErrors.displayName}
                            </p>
                        )}
                    </div>

                    {/* firstName */}
                    <div className={styles.field}>
                        <label
                            className={styles.label}
                            htmlFor="firstName"
                        >
                            {t('account.editProfile.fields.firstName', 'Nombre')}
                            <span
                                className={styles.required}
                                aria-hidden="true"
                            >
                                *
                            </span>
                        </label>
                        <input
                            id="firstName"
                            type="text"
                            className={`${styles.input} ${fieldErrors.firstName ? styles.inputError : ''}`}
                            value={firstName}
                            onChange={(e) => {
                                setFirstName(e.target.value);
                                if (fieldErrors.firstName) {
                                    setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
                                }
                            }}
                            aria-required="true"
                            aria-describedby={fieldErrors.firstName ? 'firstName-error' : undefined}
                            maxLength={100}
                            autoComplete="given-name"
                        />
                        {fieldErrors.firstName && (
                            <p
                                id="firstName-error"
                                className={styles.errorMsg}
                                role="alert"
                            >
                                {fieldErrors.firstName}
                            </p>
                        )}
                    </div>

                    {/* lastName */}
                    <div className={styles.field}>
                        <label
                            className={styles.label}
                            htmlFor="lastName"
                        >
                            {t('account.editProfile.fields.lastName', 'Apellido')}
                            <span
                                className={styles.required}
                                aria-hidden="true"
                            >
                                *
                            </span>
                        </label>
                        <input
                            id="lastName"
                            type="text"
                            className={`${styles.input} ${fieldErrors.lastName ? styles.inputError : ''}`}
                            value={lastName}
                            onChange={(e) => {
                                setLastName(e.target.value);
                                if (fieldErrors.lastName) {
                                    setFieldErrors((prev) => ({ ...prev, lastName: undefined }));
                                }
                            }}
                            aria-required="true"
                            aria-describedby={fieldErrors.lastName ? 'lastName-error' : undefined}
                            maxLength={100}
                            autoComplete="family-name"
                        />
                        {fieldErrors.lastName && (
                            <p
                                id="lastName-error"
                                className={styles.errorMsg}
                                role="alert"
                            >
                                {fieldErrors.lastName}
                            </p>
                        )}
                    </div>

                    {/* phone */}
                    <div className={styles.field}>
                        <label
                            className={styles.label}
                            htmlFor="phone"
                        >
                            {t('account.editProfile.fields.phone', 'Teléfono')}
                        </label>
                        <input
                            id="phone"
                            type="tel"
                            className={`${styles.input} ${fieldErrors.phone ? styles.inputError : ''}`}
                            value={phone}
                            onChange={(e) => {
                                setPhone(e.target.value);
                                if (fieldErrors.phone) {
                                    setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                                }
                            }}
                            aria-describedby={fieldErrors.phone ? 'phone-error' : 'phone-hint'}
                            autoComplete="tel"
                        />
                        {fieldErrors.phone ? (
                            <p
                                id="phone-error"
                                className={styles.errorMsg}
                                role="alert"
                            >
                                {fieldErrors.phone}
                            </p>
                        ) : (
                            <p
                                id="phone-hint"
                                className={styles.hint}
                            >
                                {t(
                                    'account.editProfile.fields.phoneHint',
                                    'Formato E.164: +541134567890'
                                )}
                            </p>
                        )}
                    </div>

                    {/* bio */}
                    <div className={`${styles.field} ${styles.fullWidth}`}>
                        <label
                            className={styles.label}
                            htmlFor="bio"
                        >
                            {t('account.editProfile.fields.bio', 'Biografía')}
                        </label>
                        <textarea
                            id="bio"
                            className={`${styles.textarea} ${fieldErrors.bio ? styles.inputError : ''}`}
                            value={bio}
                            onChange={(e) => {
                                setBio(e.target.value);
                                if (fieldErrors.bio) {
                                    setFieldErrors((prev) => ({ ...prev, bio: undefined }));
                                }
                            }}
                            aria-describedby={fieldErrors.bio ? 'bio-error' : 'bio-hint'}
                            maxLength={1000}
                            rows={4}
                        />
                        {fieldErrors.bio ? (
                            <p
                                id="bio-error"
                                className={styles.errorMsg}
                                role="alert"
                            >
                                {fieldErrors.bio}
                            </p>
                        ) : (
                            <p
                                id="bio-hint"
                                className={styles.hint}
                            >
                                {bio.length}/1000
                            </p>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Feedback banner ────────────────────────────────────── */}
            {formError && (
                <div
                    className={`${styles.feedbackBanner} ${styles.feedbackBannerError}`}
                    role="alert"
                    aria-live="polite"
                >
                    {formError}
                </div>
            )}

            {/* ── Submit ─────────────────────────────────────────────── */}
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
