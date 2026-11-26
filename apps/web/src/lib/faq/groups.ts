import type { DetailFaq } from '@/data/types';
import type { SupportedLocale } from '@/lib/i18n';

/** Groups detail FAQs by named category, with uncategorized questions last. */
export function groupDetailFaqs({
    faqs,
    locale
}: {
    readonly faqs: readonly DetailFaq[];
    readonly locale: SupportedLocale;
}) {
    const byTitle = new Map<string, DetailFaq[]>();
    for (const faq of faqs) {
        const title = faq.category?.trim() ?? '';
        const items = byTitle.get(title) ?? [];
        items.push(faq);
        byTitle.set(title, items);
    }
    const groups = [...byTitle]
        .sort(([a], [b]) => Number(!a) - Number(!b) || a.localeCompare(b, locale))
        .map(([title, items]) => ({ title, items }));
    return { groups };
}
