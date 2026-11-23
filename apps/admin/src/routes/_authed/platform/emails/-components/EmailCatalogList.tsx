/**
 * @file EmailCatalogList.tsx
 * @description Left column of the email previewer (HOS-2519 §6.4, §8): search
 * box, audience control, domain multi-select, "N de M" count and the catalog grouped by domain,
 * with the send-path badge and the "sin envío en producción" badge.
 */

import type { TranslationKey } from '@repo/i18n';
import type { EmailAudience, EmailCatalogDomain, EmailPreviewEntrySummary } from '@repo/schemas';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import {
    type EmailAudienceFilter,
    filterEmailCatalog,
    groupEmailCatalogByDomain,
    listCatalogDomains
} from './email-catalog-filter';

/** i18n key of a domain label. */
export const domainLabelKey = ({ domain }: { readonly domain: EmailCatalogDomain }) =>
    `admin-pages.emailPreviews.domains.${domain}` as TranslationKey;

/** Audience filter options, in display order. */
const AUDIENCE_OPTIONS = ['all', 'user', 'staff'] as const satisfies readonly (
    | 'all'
    | EmailAudience
)[];

/** i18n key of an audience filter option label. */
export const audienceLabelKey = ({ audience }: { readonly audience: EmailAudienceFilter }) =>
    `admin-pages.emailPreviews.audiences.${audience}` as TranslationKey;

/** i18n key of a send-path label. */
export const sendPathLabelKey = ({
    sendPath
}: {
    readonly sendPath: EmailPreviewEntrySummary['sendPath'];
}) => `admin-pages.emailPreviews.sendPaths.${sendPath}` as TranslationKey;

/** Props of {@link EmailCatalogList}. */
export interface EmailCatalogListProps {
    /** The whole catalog, in catalog order. */
    readonly entries: readonly EmailPreviewEntrySummary[];
    /** Key of the selected entry, if any. */
    readonly selectedKey: string | null;
    /** Called with the key of the clicked entry. */
    readonly onSelect: (input: { readonly key: string }) => void;
}

/**
 * Searchable, domain-filterable list of every catalog entry.
 *
 * @param props - See {@link EmailCatalogListProps}.
 */
export function EmailCatalogList({ entries, selectedKey, onSelect }: EmailCatalogListProps) {
    const { t } = useTranslations();
    const [search, setSearch] = useState('');
    const [audience, setAudience] = useState<EmailAudienceFilter>('all');
    const [domains, setDomains] = useState<readonly EmailCatalogDomain[]>([]);

    const allDomains = useMemo(() => listCatalogDomains({ entries }), [entries]);
    const filtered = useMemo(
        () => filterEmailCatalog({ entries, search, domains, audience }),
        [entries, search, domains, audience]
    );
    const groups = useMemo(() => groupEmailCatalogByDomain({ entries: filtered }), [filtered]);
    const isFiltered = search.trim() !== '' || domains.length > 0 || audience !== 'all';

    const toggleDomain = (domain: EmailCatalogDomain) => {
        setDomains((current) =>
            current.includes(domain)
                ? current.filter((value) => value !== domain)
                : [...current, domain]
        );
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <Input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('admin-pages.emailPreviews.searchPlaceholder')}
                    aria-label={t('admin-pages.emailPreviews.searchLabel')}
                />
                <fieldset className="flex flex-wrap gap-1.5">
                    <legend className="mb-1 text-muted-foreground text-xs">
                        {t('admin-pages.emailPreviews.audienceFilterLabel')}
                    </legend>
                    {AUDIENCE_OPTIONS.map((option) => {
                        const active = audience === option;
                        return (
                            <Button
                                key={option}
                                type="button"
                                size="sm"
                                variant={active ? 'default' : 'outline'}
                                aria-pressed={active}
                                data-testid={`email-audience-${option}`}
                                className="h-7 px-2 text-xs"
                                onClick={() => setAudience(option)}
                            >
                                {t(audienceLabelKey({ audience: option }))}
                            </Button>
                        );
                    })}
                </fieldset>
                <fieldset className="flex flex-wrap gap-1.5">
                    <legend className="mb-1 text-muted-foreground text-xs">
                        {t('admin-pages.emailPreviews.domainFilterLabel')}
                    </legend>
                    {allDomains.map((domain) => {
                        const active = domains.includes(domain);
                        return (
                            <Button
                                key={domain}
                                type="button"
                                size="sm"
                                variant={active ? 'default' : 'outline'}
                                aria-pressed={active}
                                className="h-7 px-2 text-xs"
                                onClick={() => toggleDomain(domain)}
                            >
                                {t(domainLabelKey({ domain }))}
                            </Button>
                        );
                    })}
                </fieldset>
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                    <span data-testid="email-catalog-count">
                        {t('admin-pages.emailPreviews.count', {
                            shown: filtered.length,
                            total: entries.length
                        })}
                    </span>
                    {isFiltered && (
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                                setSearch('');
                                setDomains([]);
                                setAudience('all');
                            }}
                        >
                            {t('admin-pages.emailPreviews.clearFilters')}
                        </Button>
                    )}
                </div>
            </div>

            {groups.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground text-sm">
                    {t('admin-pages.emailPreviews.empty')}
                </p>
            ) : (
                <nav
                    aria-label={t('admin-pages.emailPreviews.title')}
                    className="flex flex-col gap-4"
                >
                    {groups.map((group) => (
                        <section
                            key={group.domain}
                            aria-labelledby={`email-domain-${group.domain}`}
                        >
                            <h2
                                id={`email-domain-${group.domain}`}
                                className="mb-1 font-semibold text-muted-foreground text-xs uppercase tracking-wide"
                            >
                                {t(domainLabelKey({ domain: group.domain }))}
                            </h2>
                            <ul className="flex flex-col gap-1">
                                {group.entries.map((entry) => {
                                    const selected = entry.key === selectedKey;
                                    return (
                                        <li key={entry.key}>
                                            <button
                                                type="button"
                                                aria-current={selected ? 'true' : undefined}
                                                onClick={() => onSelect({ key: entry.key })}
                                                className={cn(
                                                    'flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                                                    selected
                                                        ? 'border-primary bg-muted'
                                                        : 'border-transparent'
                                                )}
                                            >
                                                <span className="font-medium">{entry.name}</span>
                                                <span className="flex flex-wrap items-center gap-1">
                                                    <Badge
                                                        variant="outline"
                                                        className="font-normal text-[10px]"
                                                    >
                                                        {t(
                                                            sendPathLabelKey({
                                                                sendPath: entry.sendPath
                                                            })
                                                        )}
                                                    </Badge>
                                                    {entry.audience === 'staff' && (
                                                        <Badge
                                                            variant="secondary"
                                                            className="font-normal text-[10px]"
                                                        >
                                                            {t(
                                                                'admin-pages.emailPreviews.staffBadge'
                                                            )}
                                                        </Badge>
                                                    )}
                                                    {!entry.wired && (
                                                        <Badge
                                                            variant="destructive"
                                                            className="font-normal text-[10px]"
                                                        >
                                                            {t(
                                                                'admin-pages.emailPreviews.notWired'
                                                            )}
                                                        </Badge>
                                                    )}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </nav>
            )}
        </div>
    );
}
