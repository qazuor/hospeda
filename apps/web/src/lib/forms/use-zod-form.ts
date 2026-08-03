/**
 * @file use-zod-form.ts
 * @description Shared form-validation hook (HOS-190 slice 2). Wraps a Zod
 * schema + the mapping utils in `field-errors.ts` into the small piece of
 * state every hand-rolled form in `apps/web` (ContactForm, ContributionForm,
 * ChangePasswordForm, CommerceLead, PromotionForm, ProfileEditForm...)
 * duplicates: a `fieldErrors` record, a form-level `formError` banner string,
 * a `validate()` that runs `schema.safeParse` and populates `fieldErrors` on
 * failure, and a clear-on-edit handler.
 *
 * Deliberately agnostic of the form's own field shape — it does not own
 * `<input>` state. The caller builds its own payload object and calls
 * `validate(payload)`; this hook only validates + maps errors.
 *
 * This is SLICE 2 of HOS-190: it builds the primitive. It does NOT migrate
 * any existing form (that is slice 3) — do not wire this into ContactForm et
 * al. as part of this change.
 */

import { useCallback, useState } from 'react';
import type { ZodTypeAny, z } from 'zod';
import type { FieldInputIdMap } from '@/components/ui/FieldError';
import type { TranslationFn } from '@/lib/api-errors';
import { translateApiError } from '@/lib/api-errors';
import { addToast } from '@/store/toast-store';
import {
    type ApiErrorWithDetails,
    apiErrorToFieldErrors,
    type FieldErrors,
    zodIssuesToFieldErrors
} from './field-errors';
import { focusFirstInvalidField } from './focus-first-invalid-field';

/** Result of `schema.safeParse(payload)` for a given schema — version-agnostic. */
type SafeParseResult<TSchema extends ZodTypeAny> = ReturnType<TSchema['safeParse']>;

/** Options accepted by {@link useZodForm}. */
export interface UseZodFormOptions<TSchema extends ZodTypeAny> {
    /** The Zod schema the form payload is validated against. */
    readonly schema: TSchema;
    /**
     * Optional translation function (`(key, fallback?, params?) => string`,
     * e.g. the `t` returned by `createTranslations(locale)`). When provided,
     * `fieldErrors` values are fully resolved/translated text instead of raw
     * i18n keys, and `handleApiError`'s banner fallback is localized via
     * `translateApiError`.
     */
    readonly t?: TranslationFn;
    /**
     * When supplied, a failed `validate()` also moves focus to the first
     * invalid field on the page (HOS-373 phase 2). Omit it and behaviour is
     * exactly as before — the other consumers of this hook are unaffected
     * until they opt in with a map of their own.
     */
    readonly fieldInputIds?: FieldInputIdMap;
}

/** API error payload shape accepted by `handleApiError` — a superset of `ApiErrorWithDetails`. */
export type HandleApiErrorInput =
    | (ApiErrorWithDetails & {
          readonly code?: string | null;
          readonly message?: string | null;
          readonly reason?: string | null;
      })
    | null
    | undefined;

/** Return value of {@link useZodForm}. */
export interface UseZodFormResult<TSchema extends ZodTypeAny> {
    /** Field-level errors keyed by dotted path (e.g. `contactInfo.mobilePhone`). */
    readonly fieldErrors: FieldErrors;
    /** Form-level banner error (network failure, or an API error with no per-field details). */
    readonly formError: string | null;
    /**
     * Validates `payload` against `schema`. On failure, populates
     * `fieldErrors` (via {@link zodIssuesToFieldErrors}) and leaves
     * `formError` untouched. On success, clears `fieldErrors`. Always
     * returns the typed `safeParse` result so the caller can branch on
     * `.success`/read `.data`.
     */
    readonly validate: (payload: unknown) => SafeParseResult<TSchema>;
    /**
     * Maps an API 400 error to field errors (via {@link apiErrorToFieldErrors}).
     * When the API sent no per-field details (the common production case for
     * `ServiceError`-driven 400s — see `field-errors.ts` module doc), falls
     * back to setting `formError` from `translateApiError` (or the raw
     * `message`/`fallback` when no `t` was supplied).
     */
    readonly handleApiError: (apiError: HandleApiErrorInput, fallback?: string) => void;
    /** Clears a single field's error (call on that field's `onChange`). */
    readonly clearError: (field: string) => void;
    /** Sets (or clears, with `null`) the form-level banner directly. */
    readonly setFormError: (message: string | null) => void;
    /** Clears both `fieldErrors` and `formError`. */
    readonly reset: () => void;
}

/**
 * Shared Zod-backed form-validation primitive. See the file doc for scope
 * and the `field-errors.ts` module doc for the real API 400 shape this was
 * designed against.
 *
 * @example
 * ```tsx
 * const { fieldErrors, formError, validate, handleApiError, clearError } =
 *   useZodForm({ schema: ContactSubmitSchema, t });
 *
 * async function handleSubmit(e: FormEvent<HTMLFormElement>) {
 *   e.preventDefault();
 *   const result = validate({ ...fields, accommodationId: undefined });
 *   if (!result.success) return;
 *
 *   const res = await fetch(url, { method: 'POST', body: JSON.stringify(result.data) });
 *   if (!res.ok) {
 *     const body = await res.json().catch(() => ({}));
 *     handleApiError(body.error);
 *     return;
 *   }
 * }
 * ```
 */
export function useZodForm<TSchema extends ZodTypeAny>({
    schema,
    t,
    fieldInputIds
}: UseZodFormOptions<TSchema>): UseZodFormResult<TSchema> {
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [formError, setFormErrorState] = useState<string | null>(null);

    const validate = useCallback(
        (payload: unknown): SafeParseResult<TSchema> => {
            const result = schema.safeParse(payload) as SafeParseResult<TSchema>;
            if (result.success) {
                setFieldErrors({});
            } else {
                const parseError = (result as { error: z.ZodError }).error;
                const mapped = zodIssuesToFieldErrors(parseError.issues, t);
                setFieldErrors(mapped);
                // Consistent submit-time feedback across every form: a single
                // error toast announcing the form has field errors to review,
                // alongside the inline <FieldError> messages the caller renders.
                addToast({
                    type: 'error',
                    message: t
                        ? t('validation.formHasErrors', 'Revisá los campos marcados')
                        : 'Revisá los campos marcados'
                });
                // Opt-in (HOS-373): only forms that supplied a field-to-input-id
                // map get the focus move. Runs after the toast so the toast is
                // never what steals focus.
                if (fieldInputIds) {
                    focusFirstInvalidField({
                        fieldNames: Object.keys(mapped),
                        map: fieldInputIds
                    });
                }
            }
            return result;
        },
        [schema, t, fieldInputIds]
    );

    const handleApiError = useCallback(
        (apiError: HandleApiErrorInput, fallback?: string) => {
            const mapped = apiErrorToFieldErrors(apiError);
            if (Object.keys(mapped).length > 0) {
                setFieldErrors((prev) => ({ ...prev, ...mapped }));
                return;
            }

            const message = t
                ? translateApiError({ error: apiError ?? null, t, fallback })
                : (apiError?.message ?? fallback ?? null);
            setFormErrorState(message ?? null);
        },
        [t]
    );

    const clearError = useCallback((field: string) => {
        setFieldErrors((prev) => {
            if (!(field in prev)) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    }, []);

    const setFormError = useCallback((message: string | null) => {
        setFormErrorState(message);
    }, []);

    const reset = useCallback(() => {
        setFieldErrors({});
        setFormErrorState(null);
    }, []);

    return { fieldErrors, formError, validate, handleApiError, clearError, setFormError, reset };
}
