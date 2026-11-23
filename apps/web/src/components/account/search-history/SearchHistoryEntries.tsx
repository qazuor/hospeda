/**
 * @file SearchHistoryEntries.tsx
 * @description The saved-search rows of the history page (HOS-2501): one kit
 * `ListRow` per entry inside a kit `DataList`, each with a «Repetir búsqueda»
 * link and an «Eliminar» button. Presentational: the delete request and its
 * confirmation live in `SearchHistoryList.client.tsx`.
 */

import type { SearchHistoryFilters } from '@repo/schemas';
import { formatRelativeTime } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { Button, DataList, LinkButton, ListRow, StatusPill } from '../ui';
import { buildRerunUrl, countActiveFilters } from './search-history-url';

/** Longest query text shown before it is cut with an ellipsis. */
const MAX_QUERY_LENGTH = 70;

/** One stored search, as the API returns it. */
export interface SearchHistoryEntry {
    readonly id: string;
    readonly queryText: string | null;
    readonly filtersJson: SearchHistoryFilters | null;
    readonly resultCount: number | null;
    /** ISO timestamp string from JSON serialization. */
    readonly createdAt: string;
}

/** Props of {@link SearchHistoryEntries}. */
export interface SearchHistoryEntriesProps {
    readonly entries: readonly SearchHistoryEntry[];
    readonly locale: SupportedLocale;
    /** Asks to delete one entry (the caller confirms and runs the request). */
    readonly onDelete: (entry: SearchHistoryEntry) => void;
}

/**
 * The list of saved searches.
 *
 * @param props - See {@link SearchHistoryEntriesProps}.
 */
export function SearchHistoryEntries({ entries, locale, onDelete }: SearchHistoryEntriesProps) {
    const { t, tPlural } = createTranslations(locale);
    const noQuery = t('account.searchHistory.noQuery');

    return (
        <DataList label={t('account.pages.searchHistory.title')}>
            {entries.map((entry) => {
                const filterCount = countActiveFilters(entry.filtersJson);
                const name = entry.queryText
                    ? entry.queryText.length > MAX_QUERY_LENGTH
                        ? `${entry.queryText.slice(0, MAX_QUERY_LENGTH)}…`
                        : entry.queryText
                    : noQuery;
                const label = entry.queryText ?? noQuery;
                return (
                    <ListRow
                        key={entry.id}
                        rowId={entry.id}
                        title={name}
                        meta={
                            <>
                                {filterCount > 0 && (
                                    <StatusPill tone="neutral">
                                        {tPlural(
                                            'account.searchHistory.filters.filterCount',
                                            filterCount
                                        )}
                                    </StatusPill>
                                )}{' '}
                                {entry.resultCount !== null &&
                                    (entry.resultCount === 0
                                        ? t('account.searchHistory.noResults')
                                        : tPlural(
                                              'account.searchHistory.results',
                                              entry.resultCount
                                          ))}{' '}
                                <time
                                    dateTime={entry.createdAt}
                                    title={new Date(entry.createdAt).toLocaleString()}
                                >
                                    {formatRelativeTime({ date: entry.createdAt, locale })}
                                </time>
                            </>
                        }
                        actions={[
                            <LinkButton
                                key="rerun"
                                variant="secondary"
                                size="sm"
                                href={buildRerunUrl({
                                    locale,
                                    queryText: entry.queryText,
                                    filtersJson: entry.filtersJson
                                })}
                                aria-label={`${t('account.searchHistory.rerun')}: ${label}`}
                            >
                                {t('account.searchHistory.rerun')}
                            </LinkButton>,
                            <Button
                                key="delete"
                                variant="danger-ghost"
                                size="sm"
                                onClick={() => onDelete(entry)}
                                aria-label={`${t('account.searchHistory.deleteOne')}: ${label}`}
                            >
                                {t('account.searchHistory.deleteOne')}
                            </Button>
                        ]}
                    />
                );
            })}
        </DataList>
    );
}
