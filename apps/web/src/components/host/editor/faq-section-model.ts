/**
 * @file faq-section-model.ts
 * @description Pure types and helpers of the accommodation FAQ editor
 * (`FaqSection.client.tsx`, HOS-393 / HOS-2490).
 */

import type { AccommodationFaqItem } from '@/lib/api/endpoints-protected';

/**
 * Editor state for a single FAQ row: question + answer plus the two
 * channel-visibility flags (HOS-393). Both flags default to `true` so a new
 * FAQ behaves exactly as every FAQ did before the flags existed (G-3).
 */
export interface FaqEditor {
    readonly question: string;
    readonly answer: string;
    readonly isVisibleOnListing: boolean;
    readonly isUsableByAi: boolean;
}

/** Initial (and reset) value of the add and edit forms. */
export const EMPTY_FAQ_EDITOR: FaqEditor = {
    question: '',
    answer: '',
    isVisibleOnListing: true,
    isUsableByAi: true
};

/** Max characters of the question used as the row label and in action names. */
export const LABEL_SNIPPET_MAX = 60;

/**
 * Sorts FAQs by `displayOrder` ascending (nulls last).
 *
 * @param faqs - The FAQs to sort.
 * @returns A new, sorted array.
 */
export function sortFaqs(faqs: readonly AccommodationFaqItem[]): readonly AccommodationFaqItem[] {
    return [...faqs].sort((a, b) => {
        if (a.displayOrder === null && b.displayOrder === null) return 0;
        if (a.displayOrder === null) return 1;
        if (b.displayOrder === null) return -1;
        return a.displayOrder - b.displayOrder;
    });
}

/**
 * Truncates a FAQ question to a short snippet used as the visible row label.
 * The Repeater embeds that label in every per-row button name, so repeated
 * actions stay uniquely named instead of colliding on "Subir" / "Quitar".
 *
 * @param question - The full question.
 * @returns The trimmed question, ellipsized past the limit.
 */
export function toLabelSnippet(question: string): string {
    const trimmed = question.trim();
    if (trimmed.length <= LABEL_SNIPPET_MAX) {
        return trimmed;
    }
    return `${trimmed.slice(0, LABEL_SNIPPET_MAX).trimEnd()}…`;
}
