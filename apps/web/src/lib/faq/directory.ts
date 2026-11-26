import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations, getTranslations } from '@/lib/i18n';

interface FaqGroup {
    readonly id: string;
    readonly title: string;
    readonly items: { readonly question: string; readonly answer: string }[];
}

/** Builds the public directory from the localized corpus, in catalog order. */
export function buildFaqDirectory({ locale }: { readonly locale: SupportedLocale }): FaqGroup[] {
    const { t } = createTranslations(locale);
    const groups = new Map<string, FaqGroup>();

    for (const key of Object.keys(getTranslations({ locale, namespace: 'faq' }))) {
        const match = /^categories\.([^.]+)\.items\.[^.]+\.question$/.exec(key);
        if (!match) continue;
        const [, category] = match;
        const item = {
            question: t(`faq.${key}`),
            answer: t(`faq.${key.replace(/\.question$/, '.answer')}`)
        };
        const group = groups.get(category);
        if (group) {
            group.items.push(item);
        } else {
            groups.set(category, {
                id: `cat-${category}`,
                title: t(`faq.categories.${category}.title`),
                items: [item]
            });
        }
    }

    return [...groups.values()];
}
