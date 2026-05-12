/**
 * @file SubscriberFilters.tsx
 * @description Filter controls for the admin subscribers list page
 * (SPEC-101 T-101-38). Status / locale / source dropdowns + email
 * substring search input.
 */

import { useTranslations } from '@/hooks/use-translations';
import { NewsletterSourceEnum, NewsletterSubscriberStatusEnum } from '@repo/schemas';

export interface SubscriberFiltersValue {
    readonly subscriberStatus: NewsletterSubscriberStatusEnum | '';
    readonly locale: 'es' | 'en' | 'pt' | '';
    readonly source: NewsletterSourceEnum | '';
    readonly emailSearch: string;
}

export interface SubscriberFiltersProps {
    readonly value: SubscriberFiltersValue;
    readonly onChange: (next: SubscriberFiltersValue) => void;
}

const LOCALE_LABELS: Readonly<Record<'es' | 'en' | 'pt', string>> = {
    es: 'Español',
    en: 'English',
    pt: 'Português'
};

const SOURCE_LABELS: Readonly<Record<NewsletterSourceEnum, string>> = {
    [NewsletterSourceEnum.WEB_FOOTER]: 'Footer web',
    [NewsletterSourceEnum.ACCOUNT_PREFERENCES]: 'Preferencias',
    [NewsletterSourceEnum.MIGRATION]: 'Migración'
};

const STATUS_LABELS: Readonly<Record<NewsletterSubscriberStatusEnum, string>> = {
    [NewsletterSubscriberStatusEnum.ACTIVE]: 'Activo',
    [NewsletterSubscriberStatusEnum.PENDING_VERIFICATION]: 'Pendiente',
    [NewsletterSubscriberStatusEnum.UNSUBSCRIBED]: 'No suscripto',
    [NewsletterSubscriberStatusEnum.BOUNCED]: 'Bounced',
    [NewsletterSubscriberStatusEnum.COMPLAINED]: 'Spam'
};

export function SubscriberFilters({ value, onChange }: SubscriberFiltersProps) {
    const { t } = useTranslations();

    return (
        <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
                <label
                    htmlFor="filter-status"
                    className="text-muted-foreground text-xs"
                >
                    {t('admin-newsletter.subscribers.filterStatus')}
                </label>
                <select
                    id="filter-status"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    value={value.subscriberStatus}
                    onChange={(e) =>
                        onChange({
                            ...value,
                            subscriberStatus: e.target.value as NewsletterSubscriberStatusEnum | ''
                        })
                    }
                >
                    <option value="">Todos</option>
                    {Object.values(NewsletterSubscriberStatusEnum).map((s) => (
                        <option
                            key={s}
                            value={s}
                        >
                            {STATUS_LABELS[s]}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col gap-1">
                <label
                    htmlFor="filter-locale"
                    className="text-muted-foreground text-xs"
                >
                    {t('admin-newsletter.subscribers.filterLocale')}
                </label>
                <select
                    id="filter-locale"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    value={value.locale}
                    onChange={(e) =>
                        onChange({
                            ...value,
                            locale: e.target.value as 'es' | 'en' | 'pt' | ''
                        })
                    }
                >
                    <option value="">Todos</option>
                    {(Object.keys(LOCALE_LABELS) as Array<'es' | 'en' | 'pt'>).map((l) => (
                        <option
                            key={l}
                            value={l}
                        >
                            {LOCALE_LABELS[l]}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col gap-1">
                <label
                    htmlFor="filter-source"
                    className="text-muted-foreground text-xs"
                >
                    {t('admin-newsletter.subscribers.filterSource')}
                </label>
                <select
                    id="filter-source"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    value={value.source}
                    onChange={(e) =>
                        onChange({
                            ...value,
                            source: e.target.value as NewsletterSourceEnum | ''
                        })
                    }
                >
                    <option value="">Todos</option>
                    {Object.values(NewsletterSourceEnum).map((s) => (
                        <option
                            key={s}
                            value={s}
                        >
                            {SOURCE_LABELS[s]}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex flex-1 flex-col gap-1 md:max-w-sm">
                <label
                    htmlFor="filter-email"
                    className="text-muted-foreground text-xs"
                >
                    {t('admin-newsletter.subscribers.searchEmail')}
                </label>
                <input
                    id="filter-email"
                    type="search"
                    className="rounded-md border bg-background px-3 py-1.5 text-sm"
                    placeholder="email@dominio.com"
                    value={value.emailSearch}
                    onChange={(e) => onChange({ ...value, emailSearch: e.target.value })}
                />
            </div>
        </div>
    );
}
