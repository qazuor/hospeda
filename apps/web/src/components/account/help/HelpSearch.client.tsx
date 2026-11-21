/**
 * @file HelpSearch.client.tsx
 * @description Search box of the help landing (HOS-2410 `docs/web-ui.md` §3,
 * AC-6, AC-7, AC-8).
 *
 * It searches the compact projection the page passes as a prop with the
 * shared `searchOwnerHelp` from `@repo/help`, the same tokenizer and ranking
 * `get_help` uses, so it never issues a network request. Results update on
 * every input once the query has two characters. A toggle, on by default,
 * keeps only the articles of the selected audience tab; the tab selection
 * arrives through {@link HELP_AUDIENCE_CHANGED_EVENT}.
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
    type HelpAudienceEventDetail
} from '@/lib/help/help-audience';
import { type HelpSearchEntry, parseHelpAudience } from '@/lib/help/help-catalog';
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
                onSubmit={(event) => event.preventDefault()}
            >
                <label
                    className={styles.label}
                    htmlFor={inputId}
                >
                    {t('account.help.search.label')}
                </label>
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
                className={styles.status}
                aria-live="polite"
            >
                {searched && results.length > 0
                    ? tPlural('account.help.search.results', results.length)
                    : ''}
            </p>

            {searched && results.length > 0 && (
                <ul className={styles.results}>
                    {results.map((entry) => (
                        <li
                            key={entry.id}
                            className={styles.result}
                        >
                            <a
                                className={styles.resultLink}
                                href={articlePaths[entry.id]}
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
                <div
                    className={styles.empty}
                    role="status"
                >
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
