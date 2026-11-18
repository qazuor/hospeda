/**
 * @file AiActivityHistory.client.tsx
 * @description React island of the assistant history (HOS-2348, spec
 * HOS-2335 §6.9): what the user's AI assistants did on their behalf, newest
 * first, one page at a time.
 *
 * Per-user data is fetched here, in the browser, so the Astro page stays
 * session-blind. The API only ever returns the session user's rows.
 *
 * - Writes only by default; the "mostrar también lo que solo miró" toggle
 *   adds the read-only calls (decision D-12).
 * - A result filter narrows to done, refused or failed calls.
 * - A page past the last one (the history shrank, e.g. after the 12-month
 *   retention) moves back to the last page instead of showing the empty state.
 * - A 401 (the session ended) offers to sign in again instead of retrying.
 */

import { AskToAiIcon } from '@repo/icons';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AccountEmptyState } from '@/components/account/AccountEmptyState';
import { SkeletonCardList } from '@/components/shared/feedback/SkeletonCard';
import {
    AI_ACTIVITY_OUTCOMES,
    type AiActivityItem as AiActivityItemData,
    type AiActivityOutcome,
    buildAiActivityUrl,
    parseAiActivityPage
} from '@/lib/ai-activity';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './AiActivityHistory.module.css';
import { AiActivityItem } from './AiActivityItem';

/** Props of {@link AiActivityHistory}. */
export interface AiActivityHistoryProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** API base URL. */
    readonly apiUrl: string;
    /** The "Asistentes de IA" page, where the connect instructions live. */
    readonly connectUrl: string;
    /** Sign-in page that returns here, offered when the session ended (401). */
    readonly signinUrl: string;
}

type LoadState =
    | { readonly kind: 'loading' }
    | { readonly kind: 'error' }
    | { readonly kind: 'signedOut' }
    | {
          readonly kind: 'ready';
          readonly items: readonly AiActivityItemData[];
          readonly totalPages: number;
      };

const KEY = 'account.aiAssistants.activity';

/** Narrows the select's value to an outcome, or no filter. */
function toOutcome(value: string): AiActivityOutcome | undefined {
    return AI_ACTIVITY_OUTCOMES.find((outcome) => outcome === value);
}

/**
 * The assistant history list, with its filters and pagination.
 *
 * @example
 * ```astro
 * <AiActivityHistory client:load locale={locale} apiUrl={apiUrl} connectUrl={connectUrl} />
 * ```
 */
export function AiActivityHistory({
    locale,
    apiUrl,
    connectUrl,
    signinUrl
}: AiActivityHistoryProps) {
    const { t } = useMemo(() => createTranslations(locale), [locale]);
    const toggleId = useId();
    const hintId = useId();
    const outcomeId = useId();

    const [page, setPage] = useState(1);
    const [includeReads, setIncludeReads] = useState(false);
    const [outcome, setOutcome] = useState<AiActivityOutcome | undefined>(undefined);
    const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
    const requestSeq = useRef(0);

    const loadPage = useCallback(async () => {
        requestSeq.current += 1;
        const seq = requestSeq.current;
        setLoad({ kind: 'loading' });
        try {
            const res = await fetch(
                buildAiActivityUrl({ apiUrl, page, includeReads, outcome, locale }),
                {
                    credentials: 'include'
                }
            );
            if (res.status === 401) {
                if (seq === requestSeq.current) setLoad({ kind: 'signedOut' });
                return;
            }
            const parsed = res.ok ? parseAiActivityPage({ body: await res.json() }) : null;
            if (seq !== requestSeq.current) return;
            setLoad(
                parsed?.ok
                    ? { kind: 'ready', items: parsed.items, totalPages: parsed.totalPages }
                    : { kind: 'error' }
            );
        } catch {
            if (seq === requestSeq.current) setLoad({ kind: 'error' });
        }
    }, [apiUrl, page, includeReads, outcome, locale]);

    useEffect(() => {
        void loadPage();
        return () => {
            // A later request (or unmount) makes this one's answer stale.
            requestSeq.current += 1;
        };
    }, [loadPage]);

    useEffect(() => {
        // An empty page past the first: the history shrank under the user.
        // Go back to the last page that exists (or the first) and refetch.
        if (load.kind !== 'ready' || load.items.length > 0 || page === 1) return;
        setPage(Math.max(1, Math.min(page - 1, load.totalPages)));
    }, [load, page]);

    const filtered = includeReads || outcome !== undefined;
    const emptyOnFirstPage = load.kind === 'ready' && load.items.length === 0 && page === 1;
    const totalPages = load.kind === 'ready' ? Math.max(1, load.totalPages) : 1;

    return (
        <div className={styles.root}>
            <section
                className={styles.filters}
                aria-label={t(`${KEY}.filters.title`, 'Filtrar el historial')}
            >
                <div className={styles.toggleRow}>
                    <input
                        id={toggleId}
                        type="checkbox"
                        className={styles.toggle}
                        aria-describedby={hintId}
                        checked={includeReads}
                        onChange={(event) => {
                            setIncludeReads(event.target.checked);
                            setPage(1);
                        }}
                    />
                    <div>
                        <label
                            htmlFor={toggleId}
                            className={styles.toggleLabel}
                        >
                            {t(`${KEY}.filters.includeReads`, 'Mostrar también lo que solo miró')}
                        </label>
                        <span
                            id={hintId}
                            className={styles.hint}
                        >
                            {t(
                                `${KEY}.filters.includeReadsHint`,
                                'Acciones en las que el asistente solo vio datos, sin cambiar nada.'
                            )}
                        </span>
                    </div>
                </div>
                <div className={styles.selectRow}>
                    <label
                        htmlFor={outcomeId}
                        className={styles.selectLabel}
                    >
                        {t(`${KEY}.filters.outcome`, 'Resultado')}
                    </label>
                    <select
                        id={outcomeId}
                        className={styles.select}
                        value={outcome ?? ''}
                        onChange={(event) => {
                            setOutcome(toOutcome(event.target.value));
                            setPage(1);
                        }}
                    >
                        <option value="">
                            {t(`${KEY}.filters.outcomeAll`, 'Todos los resultados')}
                        </option>
                        {AI_ACTIVITY_OUTCOMES.map((value) => (
                            <option
                                key={value}
                                value={value}
                            >
                                {t(`${KEY}.outcomes.${value}`, value)}
                            </option>
                        ))}
                    </select>
                </div>
            </section>

            {load.kind === 'loading' && (
                <div
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                    aria-label={t(`${KEY}.loading`, 'Cargando el historial...')}
                >
                    <SkeletonCardList
                        count={4}
                        cardHeight="5.5rem"
                        gap="var(--space-4, 16px)"
                    />
                </div>
            )}

            {load.kind === 'error' && (
                <div
                    className={styles.errorWrap}
                    role="alert"
                >
                    <span>
                        {t(
                            `${KEY}.errors.loadFailed`,
                            'No pudimos cargar el historial. Probá de nuevo.'
                        )}
                    </span>
                    <button
                        type="button"
                        className={styles.retryBtn}
                        onClick={() => void loadPage()}
                    >
                        {t(`${KEY}.errors.retry`, 'Reintentar')}
                    </button>
                </div>
            )}

            {load.kind === 'signedOut' && (
                <div
                    className={styles.errorWrap}
                    role="alert"
                >
                    <span>
                        {t(
                            `${KEY}.errors.signedOut`,
                            'Tu sesión terminó. Volvé a ingresar para ver el historial.'
                        )}
                    </span>
                    <a
                        className={styles.signInLink}
                        href={signinUrl}
                    >
                        {t(`${KEY}.errors.signIn`, 'Ingresar')}
                    </a>
                </div>
            )}

            {emptyOnFirstPage && !filtered && (
                <AccountEmptyState
                    title={t(`${KEY}.empty.title`, 'Todavía no hay acciones de tus asistentes')}
                    description={t(
                        `${KEY}.empty.description`,
                        'Cuando conectes un asistente de IA y le pidas algo, acá vas a ver lo que hizo con tu cuenta.'
                    )}
                    icon={<AskToAiIcon size={28} />}
                    ctaHref={connectUrl}
                    ctaLabel={t(`${KEY}.empty.cta`, 'Cómo conectar un asistente')}
                />
            )}

            {emptyOnFirstPage && filtered && (
                <p className={styles.notice}>
                    {t(`${KEY}.emptyFiltered`, 'No hay acciones que coincidan con este filtro.')}
                </p>
            )}

            {load.kind === 'ready' && load.items.length > 0 && (
                <ol className={styles.list}>
                    {load.items.map((item) => (
                        <AiActivityItem
                            key={item.id}
                            item={item}
                            locale={locale}
                            t={t}
                        />
                    ))}
                </ol>
            )}

            {load.kind === 'ready' && totalPages > 1 && (
                <nav
                    className={styles.pagination}
                    aria-label={t(`${KEY}.pagination.label`, 'Páginas del historial')}
                >
                    <button
                        type="button"
                        className={styles.pageBtn}
                        disabled={page <= 1}
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                        {t(`${KEY}.pagination.prev`, 'Anterior')}
                    </button>
                    <span className={styles.pageInfo}>
                        {page} / {totalPages}
                    </span>
                    <button
                        type="button"
                        className={styles.pageBtn}
                        disabled={page >= totalPages}
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    >
                        {t(`${KEY}.pagination.next`, 'Siguiente')}
                    </button>
                </nav>
            )}
        </div>
    );
}
