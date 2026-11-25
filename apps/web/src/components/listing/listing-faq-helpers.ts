/**
 * Pure types and helpers of the listing FAQ manager (SPEC-253 T-024, HOS-2490).
 *
 * Split out of `ListingFaqManager.client.tsx` so the composition component, the
 * state hook and the field components all share one definition and none of
 * them grows past the file-size ceiling.
 *
 * @module components/listing/listing-faq-helpers
 */

import type { TranslationFn } from '@/lib/i18n';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';

/** A single FAQ entry as returned by the protected getById endpoint. */
export interface ListingFaq {
    readonly id: string;
    readonly question: string;
    readonly answer: string;
    readonly category: string | null;
    readonly displayOrder: number | null;
    /**
     * Whether the FAQ appears on the listing's public page. Enforced
     * server-side (HOS-400, adopting the HOS-393 pattern) — this flag is
     * display-only here, the manager never filters by it.
     */
    readonly isVisibleOnListing: boolean;
    /**
     * Whether the AI chat assistant may use this FAQ to answer questions.
     * Enforced where the prompt is assembled (HOS-400). A FAQ that is
     * AI-usable but not `isVisibleOnListing` is NOT private — the assistant
     * will still say it to anyone who asks in chat.
     */
    readonly isUsableByAi: boolean;
}

/**
 * Envelope the add / update endpoints answer with (HOS-841).
 *
 * `ExperienceFaqSingleOutputSchema` and `VenueFaqSingleOutputSchema` are
 * both `z.object({ faq: … })`, so the FAQ arrives one level down. Typing these
 * two calls as `ListingFaq` compiled fine and put the ENVELOPE into the list:
 * `question`/`answer` rendered blank and `id` was `undefined`, which then sent
 * `PUT …/faqs/undefined` (400) on the next edit — while the row had in fact
 * been written. Delete and reorder are unaffected: they answer `SuccessSchema`.
 */
export interface ListingFaqEnvelope {
    readonly faq: ListingFaq;
}

/**
 * Editor state for a single FAQ form: question + answer + category plus the
 * two channel-visibility flags (HOS-400). Both flags default to `true` so a
 * new FAQ behaves exactly as every FAQ did before the flags existed.
 */
export interface FaqEditor {
    readonly question: string;
    readonly answer: string;
    readonly category: string;
    readonly isVisibleOnListing: boolean;
    readonly isUsableByAi: boolean;
}

/** Per-field validation messages for one FAQ form. */
export interface FaqFieldErrors {
    readonly question?: string;
    readonly answer?: string;
}

/** A blank form. */
export const EMPTY_EDITOR: FaqEditor = {
    question: '',
    answer: '',
    category: '',
    isVisibleOnListing: true,
    isUsableByAi: true
};

/** The "nothing is wrong" validation result. */
export const NO_FIELD_ERRORS: FaqFieldErrors = {};

/**
 * Validates one FAQ form, returning a message per offending field.
 *
 * Mirrors the API's own requirement (question and answer are both `notNull`),
 * so a submit this rejects would have been rejected server-side anyway. The
 * point is not the rule — it is that the rejection is VISIBLE (HOS-811): a
 * silent early return is indistinguishable from a dead button.
 *
 * @param params.values - Current form values.
 * @param params.t - Translator for the messages.
 * @returns One entry per invalid field; empty when the form may be submitted.
 */
export function validateFaqEditor({
    values,
    t
}: {
    readonly values: FaqEditor;
    readonly t: TranslationFn;
}): FaqFieldErrors {
    const errors: { question?: string; answer?: string } = {};

    if (!values.question.trim()) {
        errors.question = t(
            'listing.owner.editor.faqManager.questionRequired',
            'Escribí la pregunta antes de guardar.'
        );
    }
    if (!values.answer.trim()) {
        errors.answer = t(
            'listing.owner.editor.faqManager.answerRequired',
            'Escribí la respuesta antes de guardar.'
        );
    }

    return errors;
}

/**
 * Whether a validation result blocks submission.
 *
 * @param errors - Result of {@link validateFaqEditor}.
 * @returns `true` when at least one field is invalid.
 */
export function hasFieldErrors(errors: FaqFieldErrors): boolean {
    return Boolean(errors.question || errors.answer);
}

/**
 * Builds the base FAQ endpoint prefix for a given vertical + listing.
 *
 * @param params.vertical - Listing vertical.
 * @param params.listingId - UUID of the listing.
 * @returns The `/api/v1/protected/.../faqs` path.
 */
export function faqBasePath({
    vertical,
    listingId
}: {
    readonly vertical: VenueOrExperience;
    readonly listingId: string;
}): string {
    const entity = vertical === 'venue' ? 'venues' : 'experiences';
    return `/api/v1/protected/${entity}/${listingId}/faqs`;
}

/**
 * Sorts FAQs by `displayOrder` ascending (nulls last).
 *
 * @param faqs - The FAQs to sort.
 * @returns A new, sorted array.
 */
export function sortFaqs(faqs: readonly ListingFaq[]): readonly ListingFaq[] {
    return [...faqs].sort((a, b) => {
        if (a.displayOrder === null && b.displayOrder === null) return 0;
        if (a.displayOrder === null) return 1;
        if (b.displayOrder === null) return -1;
        return a.displayOrder - b.displayOrder;
    });
}

/**
 * The request body of an add / update call from a form's values.
 *
 * @param values - Current form values.
 * @returns The trimmed payload the API expects.
 */
export function buildFaqBody(values: FaqEditor): {
    readonly question: string;
    readonly answer: string;
    readonly category: string | undefined;
    readonly isVisibleOnListing: boolean;
    readonly isUsableByAi: boolean;
} {
    return {
        question: values.question.trim(),
        answer: values.answer.trim(),
        category: values.category.trim() || undefined,
        isVisibleOnListing: values.isVisibleOnListing,
        isUsableByAi: values.isUsableByAi
    };
}
