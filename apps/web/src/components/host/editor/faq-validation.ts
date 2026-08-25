/**
 * @file faq-validation.ts
 * @description Client-side validation for the accommodation editor's FAQ
 * add/edit forms (HOS-794).
 *
 * Both submit handlers used to `return` silently on empty fields, making
 * "Guardar" indistinguishable from a broken button. This module reuses
 * {@link FaqWithChannelVisibilityCreatePayloadSchema} — the exact contract
 * the protected FAQ endpoints enforce — so an invalid FAQ is rejected in the
 * browser with per-field messages (same shape as `useZodForm.validate()`),
 * instead of a silent no-op or a round-trip to a generic 400 toast.
 *
 * An empty field reports the `required` message ("La pregunta es
 * obligatoria"), while a short-but-present field reports the schema's `min`
 * message with the `{{min}}` count interpolated — the minimum is
 * communicated BEFORE the user hits the server (HOS-794 AC-2).
 */

import { FaqWithChannelVisibilityCreatePayloadSchema } from '@repo/schemas';
import { zodIssuesToFieldErrors } from '@/lib/forms/field-errors';
import type { TranslationFn } from '@/lib/i18n';

/** The two FAQ fields the editor validates. */
export type FaqFieldName = 'question' | 'answer';

/** Per-field validation errors for one FAQ editor form. */
export type FaqFieldErrors = Partial<Record<FaqFieldName, string>>;

/** The editable text fields of a FAQ (the visibility flags need no validation). */
export interface FaqEditorValues {
    readonly question: string;
    readonly answer: string;
}

/**
 * Drops one field's error, returning a new record (or the same one when the
 * field had no error). Called on every keystroke so an error message does not
 * linger after the user fixed the field — matching the editor-wide behavior
 * of `useZodForm`'s `clearError`.
 */
export function clearFaqFieldError(errors: FaqFieldErrors, field: FaqFieldName): FaqFieldErrors {
    if (!errors[field]) {
        return errors;
    }
    const next = { ...errors };
    delete next[field];
    return next;
}

/**
 * Validates a FAQ form's question + answer against the shared FAQ payload
 * schema.
 *
 * Empty fields short-circuit to the `required` messages (the schema itself
 * would report them as `min` length failures, which reads wrong for a field
 * the user never touched). Everything else — minimum/maximum length — is
 * resolved through {@link zodIssuesToFieldErrors}, so the copy and the
 * `{{min}}`/`{{max}}` interpolation come from the same i18n catalogue the
 * rest of the editor uses.
 *
 * @param values - The raw editor values (trailing/leading whitespace is
 * trimmed before validating, matching what the handlers send).
 * @param t - Active locale translator.
 * @returns The per-field errors; `{}` when the values would pass the API.
 */
export function validateFaqEditorValues(values: FaqEditorValues, t: TranslationFn): FaqFieldErrors {
    const question = values.question.trim();
    const answer = values.answer.trim();

    const requiredErrors: FaqFieldErrors = {};
    if (question.length === 0) {
        requiredErrors.question = t(
            'validation.common.faq.question.required',
            'La pregunta es obligatoria'
        );
    }
    if (answer.length === 0) {
        requiredErrors.answer = t(
            'validation.common.faq.answer.required',
            'La respuesta es obligatoria'
        );
    }
    if (requiredErrors.question !== undefined || requiredErrors.answer !== undefined) {
        return requiredErrors;
    }

    const result = FaqWithChannelVisibilityCreatePayloadSchema.safeParse({
        question,
        answer
    });
    if (result.success) {
        return {};
    }

    const fieldErrors = zodIssuesToFieldErrors(result.error.issues, t);
    return {
        question: fieldErrors.question,
        answer: fieldErrors.answer
    };
}
