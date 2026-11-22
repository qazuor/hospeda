/**
 * @file HelpSearch.client.tsx
 * @description Search box of the help landing (HOS-2410 `docs/web-ui.md` §3,
 * AC-6, AC-7, AC-8).
 *
 * It searches the compact projection the page passes as a prop with the
 * shared `searchOwnerHelp` from `@repo/help`, the same tokenizer and ranking
 * `get_help` uses, so it never issues a network request. Results update on
 * every input once the query has two characters. A toggle, on by default,
 * keeps only the articles of the selected audience tab. On mount it reads the
 * tab the page shows (`[data-help-tabs]` `data-selected`, else `?para=`), so
 * it agrees with the tabs whatever order the two `client:idle` islands
 * hydrate in; later changes arrive through {@link HELP_AUDIENCE_CHANGED_EVENT}.
 *
 * Hydration: `client:idle`. The server renders the same markup, including the
 * results of an initial `?q=` (SSR-first), so the list never appears only after
 * hydration.
 */

import { type HelpAudience, searchOwnerHelp } from '@repo/help';
import { useEffect, useId, useMemo, useState } from 'react';
import {
    HELP_AUDIENCE_CHANGED_EVENT,
    HELP_AUDIENCE_LABEL_KEYS,
    type HelpAudienceEventDetail,
    parseHelpAudience,
    readSelectedHelpAudience,
    withHelpAudienceParam
} from '@/lib/help/help-audience-shared';
import type { HelpSearchEntry } from '@/lib/help/help-catalog';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './HelpSearch.module.css';

/** Most results the web search shows (web-ui §3; `get_help` keeps three). */
export const HELP_SEARCH_LIMIT = 10;

/** Shortest query that is searched. */
export const HELP_SEARCH_MIN_CHARS = 2;

/** Props of {@link HelpSearch}. */
export interface HelpSearchProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** The compact projection of the locale's articles. Never the full index. */
    readonly articles: readonly HelpSearchEntry[];
    /** The audience tab the server selected. */
    readonly initialAudience: HelpAudience;
    /** The `?q=` the page was opened with, searched on first render. */
    readonly initialQuery?: string;
    /** Path of each article, by id, built by the page. */
    readonly articlePaths: Readonly<Record<string, string>>;
    /** Path of the FAQ page (no-match fallback). */
    readonly faqPath: string;
    /** Path of the contact page (no-match fallback). */
    readonly contactPath: string;
}

/**
 * The articles a query finds, best first.
 *
 * @param args.articles - The projection
 * @param args.query - What the reader typed
 * @param args.audience - The audience to keep, or `undefined` for all
 * @returns At most {@link HELP_SEARCH_LIMIT} entries; empty below two characters
 */
export function findHelpResults({
    articles,
    query,
    audience
}: {
    readonly articles: readonly HelpSearchEntry[];
    readonly query: string;
    readonly audience: HelpAudience | undefined;
}): readonly HelpSearchEntry[] {
    if (query.trim().length < HELP_SEARCH_MIN_CHARS) {
        return [];
    }
    return searchOwnerHelp({
        topics: articles,
        question: query,
        audience,
        limit: HELP_SEARCH_LIMIT
    });
}

/**
 * What the polite live region announces: the result count, or the no-match
 * sentence when a real query found nothing (an empty region announces nothing,
 * which leaves a screen-reader user guessing). Nothing below two characters.
 *
 * @param args.searched - Whether the query is long enough to search
 * @param args.count - How many results were found
 * @param args.countText - The localized «N resultados» for a count
 * @param args.noMatchText - The localized «No encontramos ayuda para eso»
 * @returns The announcement, or `''`
 */
export function helpSearchAnnouncement({
    searched,
    count,
    countText,
    noMatchText
}: {
    readonly searched: boolean;
    readonly count: number;
    readonly countText: (count: number) => string;
    readonly noMatchText: string;
}): string {
    if (!searched) {
        return '';
    }
    return count > 0 ? countText(count) : noMatchText;
}

/**
 * Help landing search island.
 *
 * @param props - See {@link HelpSearchProps}
 * @returns The search landmark with its results
 */
export function HelpSearch({
    locale,
    articles,
    initialAudience,
    initialQuery = '',
    articlePaths,
    faqPath,
    contactPath
}: HelpSearchProps) {
    const { t, tPlural } = createTranslations(locale);
    const inputId = useId();
    const [query, setQuery] = useState(initialQuery);
    const [onlyMine, setOnlyMine] = useState(true);
    const [audience, setAudience] = useState<HelpAudience>(initialAudience);

    useEffect(() => {
        const current = readSelectedHelpAudience();
        if (current !== undefined) {
            setAudience(current);
        }
        const onChange = (event: Event): void => {
            const next = parseHelpAudience({
                value: (event as CustomEvent<Partial<HelpAudienceEventDetail>>).detail?.audience
            });
            if (next !== undefined) {
                setAudience(next);
            }
        };
        window.addEventListener(HELP_AUDIENCE_CHANGED_EVENT, onChange);
        return () => window.removeEventListener(HELP_AUDIENCE_CHANGED_EVENT, onChange);
    }, []);

    const results = useMemo(
        () => findHelpResults({ articles, query, audience: onlyMine ? audience : undefined }),
        [articles, query, audience, onlyMine]
    );
    const searched = query.trim().length >= HELP_SEARCH_MIN_CHARS;

    return (
        <search className={styles.search}>
            <form
                className={styles.form}
                onSubmit={(event) => {
                    // Results already follow every keystroke; the button only
                    // moves the reader to the first one (same affordance as the
                    // article page's search, which submits to this landing).
                    event.preventDefault();
                    const first = (
                        event.currentTarget.parentElement ?? document
                    ).querySelector<HTMLAnchorElement>('[data-help-result] a');
                    first?.focus();
                }}
            >
                <label
                    className={styles.label}
                    htmlFor={inputId}
                >
                    {t('account.help.search.label')}
                </label>
                <div className={styles.row}>
                    <input
                        id={inputId}
                        className={styles.input}
                        type="search"
                        name="q"
                        autoComplete="off"
                        value={query}
                        placeholder={t('account.help.search.placeholder')}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                setQuery('');
                            }
                        }}
                    />
                    <button
                        className={styles.button}
                        type="submit"
                    >
                        {t('account.help.search.submit')}
                    </button>
                </div>
                <label className={styles.toggle}>
                    <input
                        type="checkbox"
                        checked={onlyMine}
                        onChange={(event) => setOnlyMine(event.target.checked)}
                    />
                    <span>{t('account.help.search.onlyMine')}</span>
                </label>
            </form>

            <p
                className="sr-only"
                aria-live="polite"
                data-help-search-status
            >
                {helpSearchAnnouncement({
                    searched,
                    count: results.length,
                    countText: (count) => tPlural('account.help.search.results', count),
                    noMatchText: t('account.help.search.noMatch')
                })}
            </p>

            {searched && results.length > 0 && (
                <ul className={styles.results}>
                    {results.map((entry) => (
                        <li
                            key={entry.id}
                            className={styles.result}
                            data-help-result
                        >
                            <a
                                className={styles.resultLink}
                                href={withHelpAudienceParam({
                                    href: articlePaths[entry.id] ?? '',
                                    audience: onlyMine ? audience : undefined,
                                    audiences: entry.audiences
                                })}
                            >
                                {entry.title}
                            </a>
                            <p className={styles.resultSummary}>{entry.summary}</p>
                            <ul
                                className={styles.chips}
                                aria-label={t('account.help.audiencesLabel')}
                            >
                                {entry.audiences.map((item) => (
                                    <li
                                        key={item}
                                        className={styles.chip}
                                    >
                                        {t(HELP_AUDIENCE_LABEL_KEYS[item])}
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>
            )}

            {searched && results.length === 0 && (
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>{t('account.help.search.noMatch')}</p>
                    <p className={styles.emptyLinks}>
                        <a href={faqPath}>{t('account.help.fallback.faq')}</a>
                        <a href={contactPath}>{t('account.help.fallback.contact')}</a>
                    </p>
                </div>
            )}
        </search>
    );
}
