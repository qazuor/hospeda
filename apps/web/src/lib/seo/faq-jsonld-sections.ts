/**
 * @file faq-jsonld-sections.ts
 * @description Shared mapping from a listing's FAQs to the props of
 * `FAQPageJsonLd.astro` (HOS-2579 §6.6). Used by the accommodation, venue and
 * experience detail pages, which render `FAQPageJsonLd` in `head-extra` only
 * when `sections` is non-empty.
 *
 * `inLanguage` comes from {@link faqSetInLanguage}: the page locale only when
 * every FAQ's text really is in that locale (HOS-117), `es` otherwise.
 *
 * A FAQ with a blank question or answer is dropped: a `Question` without a
 * name or an `Answer` without text is invalid structured data, and the venue
 * and experience fallback mappers turn a missing field into `''`.
 */

import type { DetailFaq } from '@/data/types';
import { faqSetInLanguage } from '@/lib/api/transforms';

/** One Q/A pair, structurally identical to `FAQSection` in `FAQPageJsonLd.astro`. */
export interface FaqJsonLdSection {
    /** The question. */
    readonly heading: string;
    /** The answer. */
    readonly body: string;
}

/** Input of {@link buildFaqJsonLdSections}. */
export interface BuildFaqJsonLdSectionsInput {
    /** The FAQs the page renders. */
    readonly faqs: ReadonlyArray<Pick<DetailFaq, 'question' | 'answer' | 'resolvedLocale'>>;
    /** Active page locale. */
    readonly locale: string;
}

/** Result of {@link buildFaqJsonLdSections}. */
export interface BuildFaqJsonLdSectionsResult {
    /** One Q/A pair per publishable FAQ, in input order. Empty means no JSON-LD. */
    readonly sections: readonly FaqJsonLdSection[];
    /** BCP-47 language of the FAQ set, for `FAQPage.inLanguage`. */
    readonly inLanguage: string;
}

/**
 * Maps a listing's FAQs to `FAQPageJsonLd` props.
 *
 * @param input - {@link BuildFaqJsonLdSectionsInput}
 * @returns `{ sections, inLanguage }`; render the JSON-LD only when `sections` is non-empty.
 *
 * @example
 * ```ts
 * const { sections, inLanguage } = buildFaqJsonLdSections({ faqs, locale });
 * // {sections.length > 0 && <FAQPageJsonLd slot="head-extra" sections={sections} inLanguage={inLanguage} />}
 * ```
 */
export function buildFaqJsonLdSections(
    input: BuildFaqJsonLdSectionsInput
): BuildFaqJsonLdSectionsResult {
    const { faqs, locale } = input;
    const publishable = faqs.filter(
        (faq) => faq.question.trim().length > 0 && faq.answer.trim().length > 0
    );
    return {
        sections: publishable.map((faq) => ({ heading: faq.question, body: faq.answer })),
        inLanguage: faqSetInLanguage(publishable, locale)
    };
}
