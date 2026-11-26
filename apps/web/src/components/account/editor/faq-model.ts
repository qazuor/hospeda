/**
 * @file faq-model.ts
 * @description Shared FAQ types, editor values, ordering, payloads and validation.
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
import type { AccommodationFaqItem } from '@/lib/api/endpoints-protected';
import { zodIssuesToFieldErrors } from '@/lib/forms/field-errors';
import type { TranslationFn } from '@/lib/i18n';

/** FAQ row contract shared by all owner listing verticals. */
export type ListingFaq = AccommodationFaqItem;

/** Add/update responses wrap the saved FAQ, never the row itself. */
export interface FaqEnvelope {
    readonly faq: ListingFaq;
}

/** Editable FAQ state; category is retained only by listing adapters. */
export interface FaqEditor extends FaqEditorValues {
    readonly category: string;
    readonly isVisibleOnListing: boolean;
    readonly isUsableByAi: boolean;
}

/** Initial and reset state. Both channels default to enabled. */
export const EMPTY_FAQ_EDITOR: FaqEditor = {
    question: '',
    answer: '',
    category: '',
    isVisibleOnListing: true,
    isUsableByAi: true
};

/** Explicit presentation and validation policy for a FAQ controller. */
export interface FaqConfig {
    readonly namespace: 'host.properties.editor.faq' | 'listing.owner.editor.faqManager';
    /** Retain the listing-only category in payloads; existing forms do not expose an input. */
    readonly showCategory: boolean;
    readonly errorSurface: 'toast' | 'inline';
    /** Schema validation also retains focus, toast and clear-on-edit behavior. */
    readonly validationMode: 'schema' | 'required';
}

/** Sorts a copy by display order, keeping null orders last. */
export function sortFaqs({
    faqs
}: {
    readonly faqs: readonly ListingFaq[];
}): readonly ListingFaq[] {
    return [...faqs].sort((a, b) => {
        if (a.displayOrder === null && b.displayOrder === null) return 0;
        if (a.displayOrder === null) return 1;
        if (b.displayOrder === null) return -1;
        return a.displayOrder - b.displayOrder;
    });
}

/** Keeps accommodation row/action labels short without losing the full question. */
export function toLabelSnippet({ question }: { readonly question: string }): string {
    const trimmed = question.trim();
    return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 60).trimEnd()}…`;
}

/** Builds the trimmed payload, omitting category for accommodations. */
export function buildFaqBody({
    values,
    showCategory
}: {
    readonly values: FaqEditor;
    readonly showCategory: boolean;
}) {
    return {
        question: values.question.trim(),
        answer: values.answer.trim(),
        ...(showCategory ? { category: values.category.trim() || undefined } : {}),
        isVisibleOnListing: values.isVisibleOnListing,
        isUsableByAi: values.isUsableByAi
    };
}

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
export function clearFaqFieldError({
    errors,
    field
}: {
    readonly errors: FaqFieldErrors;
    readonly field: FaqFieldName;
}): FaqFieldErrors {
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
export function validateFaqEditorValues({
    values,
    t,
    config
}: {
    readonly values: FaqEditorValues;
    readonly t: TranslationFn;
    readonly config: FaqConfig;
}): FaqFieldErrors {
    const question = values.question.trim();
    const answer = values.answer.trim();

    if (config.validationMode === 'required') {
        return {
            ...(question
                ? {}
                : {
                      question: t(
                          `${config.namespace}.questionRequired`,
                          'Escribí la pregunta antes de guardar.'
                      )
                  }),
            ...(answer
                ? {}
                : {
                      answer: t(
                          `${config.namespace}.answerRequired`,
                          'Escribí la respuesta antes de guardar.'
                      )
                  })
        };
    }

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
