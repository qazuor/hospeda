/**
 * @file useProfileEditSubmit.ts
 * @description Submit logic of the profile edit form, extracted from
 * `ProfileEditForm.client.tsx` to keep that file under the size limit.
 *
 * Owns the submit state (`submitting`, `saved`), the avatar upload, the
 * diff-against-baseline PATCH and the toasts the form raises. Every toast it
 * raises (or that the shared validation hook raises on its behalf) is tracked by
 * id, so the next submit dismisses only THOSE and leaves other islands' toasts
 * alone (HOS-2444).
 */

import {
    type Dispatch,
    type FormEvent,
    type RefObject,
    type SetStateAction,
    useRef,
    useState
} from 'react';
import { translateApiError } from '@/lib/api-errors';
import { type UseZodFormResult, useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { addToast, getToasts, removeToast } from '@/store/toast-store';
import {
    buildProfilePatch,
    focusFirstInvalidProfileField,
    ProfileEditFormSchema,
    type ProfileSnapshot
} from './ProfileEditForm.helpers';

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

/** Avatar state the submit reads and updates. */
export interface ProfileEditSubmitAvatar {
    readonly file: File | null;
    readonly url: string;
    readonly previewUrl: string | null;
    readonly setUrl: (url: string) => void;
    readonly setPreviewUrl: (url: string | null) => void;
    readonly setFile: (file: File | null) => void;
    readonly setUploading: (uploading: boolean) => void;
}

/** Inputs of {@link useProfileEditSubmit}. */
export interface UseProfileEditSubmitParams {
    readonly userId: string;
    readonly base: string;
    readonly locale: SupportedLocale;
    readonly t: (key: string, fallback?: string, params?: Record<string, unknown>) => string;
    /** Reads the current form state as a snapshot to diff against the baseline. */
    readonly snapshotFromState: () => ProfileSnapshot;
    readonly baseline: ProfileSnapshot;
    readonly setBaseline: Dispatch<SetStateAction<ProfileSnapshot>>;
    readonly avatar: ProfileEditSubmitAvatar;
    /** The `<form>` element, so focus lookups stay inside it. */
    readonly formRef: RefObject<HTMLFormElement | null>;
}

/** Result of {@link useProfileEditSubmit}. */
export interface UseProfileEditSubmitResult {
    /** Field-level errors from client validation and API 400 details. */
    readonly fieldErrors: UseZodFormResult<typeof ProfileEditFormSchema>['fieldErrors'];
    /** Form-level error banner text, or `null`. */
    readonly formError: string | null;
    /** Clears one field's error (call from that field's change handler). */
    readonly clearError: (field: string) => void;
    readonly submitting: boolean;
    /** `true` after a successful save, until the user edits something again. */
    readonly saved: boolean;
    readonly setSaved: (saved: boolean) => void;
    readonly handleSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
}

/**
 * Submit state + handler of the profile edit form.
 *
 * @param params - See {@link UseProfileEditSubmitParams}.
 * @returns See {@link UseProfileEditSubmitResult}.
 */
export function useProfileEditSubmit({
    userId,
    base,
    locale,
    t,
    snapshotFromState,
    baseline,
    setBaseline,
    avatar,
    formRef
}: UseProfileEditSubmitParams): UseProfileEditSubmitResult {
    // Validation is delegated to the shared `useZodForm` primitive (HOS-190
    // slice 3). It lives HERE, next to the submit that clears and sets its banner.
    const { fieldErrors, formError, validate, handleApiError, clearError, setFormError } =
        useZodForm({ schema: ProfileEditFormSchema, t });
    const { file: avatarFile, url: avatarUrl, previewUrl } = avatar;
    const {
        setUrl: setAvatarUrl,
        setPreviewUrl,
        setFile: setAvatarFile,
        setUploading: setAvatarUploading
    } = avatar;
    const [submitting, setSubmitting] = useState(false);
    const [saved, setSaved] = useState(false);
    const ownToastIds = useRef<Set<string>>(new Set());

    /** Raises a toast and remembers it as this form's own. */
    function notify(toast: Parameters<typeof addToast>[0]): void {
        ownToastIds.current.add(addToast(toast));
    }

    /** Removes the toasts this form raised earlier, and only those. */
    function dismissOwnToasts(): void {
        for (const id of ownToastIds.current) removeToast(id);
        ownToastIds.current.clear();
    }

    /** Runs `fn` and claims any toast that appeared while it ran (the validation hook raises its own). */
    function trackToastsAddedBy<T>(fn: () => T): T {
        const before = new Set(getToasts().map((toast) => toast.id));
        const result = fn();
        for (const toast of getToasts()) {
            if (!before.has(toast.id)) ownToastIds.current.add(toast.id);
        }
        return result;
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setFormError(null);
        setSaved(false);
        // HOS-2444: one live toast at a time, so a new result replaces the old
        // one instead of stacking beneath it.
        dismissOwnToasts();

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
            notify({
                type: 'error',
                message: t('validation.formHasErrors')
            });
            focusFirstInvalidProfileField({
                form: formRef.current,
                fieldNames: clearedRequiredNames
            });
            return;
        }

        // BETA-189 P2 + F6: only report success when a real change was persisted.
        // A diff-empty submit shows a "no changes" info toast (mirroring the
        // AccommodationEditor) instead of a misleading "profile updated".
        const avatarChanged = avatarFile !== null || avatarUrl !== baseline.avatarUrl;
        if (Object.keys(fieldPayload).length === 0 && !avatarChanged) {
            notify({
                type: 'info',
                message: t('account.editProfile.noChanges', 'No hay cambios para guardar')
            });
            return;
        }

        // Validate ONLY the changed fields (read⊇write): a pre-existing invalid
        // value the user is not touching never blocks an unrelated save. This is
        // also where the server-aligned bio bound (min 10 / max 300) is enforced
        // client-side — BETA-189 P4.
        const parsed = trackToastsAddedBy(() => validate(omitUndefined(flatChanged)));

        if (!parsed.success) {
            focusFirstInvalidProfileField({
                form: formRef.current,
                fieldNames: parsed.error.issues.map((issue) => String(issue.path[0] ?? ''))
            });
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

            const res = await fetch(`${base}/api/v1/protected/users/${userId}`, {
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
                notify({ type: 'error', message: msg });
                return;
            }

            // F6: resync the baseline to what is now persisted (the current
            // snapshot, carrying the uploaded avatar URL) so a subsequent revert
            // of a just-saved field is correctly detected as a change.
            setBaseline({ ...current, avatarUrl: finalAvatarUrl ?? current.avatarUrl });
            setSaved(true);
            notify({
                type: 'success',
                message: t('account.editProfile.success', 'Perfil actualizado correctamente')
            });
        } catch (err) {
            const msg =
                err instanceof Error
                    ? err.message
                    : t('account.editProfile.errors.saveFailed', 'No se pudo guardar el perfil');
            setFormError(msg);
            notify({ type: 'error', message: msg });
        } finally {
            setSubmitting(false);
        }
    }

    return {
        fieldErrors,
        formError,
        clearError,
        submitting,
        saved,
        setSaved,
        handleSubmit
    };
}
