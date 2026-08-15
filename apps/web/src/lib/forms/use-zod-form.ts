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
     * until they opt in with a prefix of their own.
     *
     * This is the form's id NAMESPACE, e.g. `'acc'` or `'ce'`. It replaced a
     * per-editor `FieldInputIdMap` in HOS-385: the id is now DERIVED from the
     * Zod key by `buildFieldId`, the same call the field wrapper makes, so
     * opting in costs one string instead of a table that could silently rot.
     */
    readonly fieldIdPrefix?: string;
    /**
     * The form's shared sub-control suffix map, for Zod keys rendered as more
     * than one control (`phone` → country combobox + number input). Only
     * meaningful alongside `fieldIdPrefix`, and MUST be the same constant the
     * render site reads.
     */
    readonly fieldIdSuffixes?: Readonly<Record<string, string>>;
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
     * Maps an API 400 error to field errors (via {@link apiErrorToFieldErrors},
     * localized when a `t` was supplied) AND sets `formError` from
     * `translateApiError` (or the raw `message`/`fallback` when no `t` was
     * supplied).
     *
     * The banner is set even when per-field errors were mapped, because a
     * caller may not render those fields at all — `HostTradeEditForm` and
     * `PartnerEditForm` read only `formError`, so returning early on a mapped
     * error left them with a submit that looked like it did nothing (the same
     * silence H-28 produced in the admin).
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
    fieldIdPrefix,
    fieldIdSuffixes
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
                // Opt-in (HOS-373): only forms that declared an id namespace get
                // the focus move. Runs after the toast so the toast is never
                // what steals focus.
                if (fieldIdPrefix) {
                    focusFirstInvalidField({
                        fieldNames: Object.keys(mapped),
                        prefix: fieldIdPrefix,
                        suffixes: fieldIdSuffixes
                    });
                }
            }
            return result;
        },
        [schema, t, fieldIdPrefix, fieldIdSuffixes]
    );

    const handleApiError = useCallback(
        (apiError: HandleApiErrorInput, fallback?: string) => {
            const mapped = apiErrorToFieldErrors(apiError, t);
            const markedSomeFields = Object.keys(mapped).length > 0;
            if (markedSomeFields) {
                setFieldErrors((prev) => ({ ...prev, ...mapped }));
            }

            const message = t
                ? translateApiError({ error: apiError ?? null, t, fallback })
                : (apiError?.message ?? fallback ?? null);

            // Only send the user looking for marked fields once some are marked
            // (H-108). The `VALIDATION_ERROR` copy used to carry "Revisá los
            // campos marcados" unconditionally, and in production it almost never
            // could be true: `details` is stripped whenever
            // HOSPEDA_API_DEBUG_ERRORS is false, so there is nothing to map and
            // nothing gets highlighted. A live rejection in the editor rendered
            // exactly that sentence with no field marked anywhere on the page —
            // which does not read as "vague", it reads as "look elsewhere" or
            // "this page is broken".
            const reviewInvite = markedSomeFields
                ? (t?.('validation.reviewMarkedFields', 'Revisá los campos marcados.') ??
                  'Revisá los campos marcados.')
                : null;

            setFormErrorState(
                message && reviewInvite ? `${message} ${reviewInvite}` : (message ?? null)
            );
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
