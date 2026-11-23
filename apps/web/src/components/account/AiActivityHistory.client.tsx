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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Checkbox,
    DataList,
    EmptyState,
    ErrorState,
    Field,
    LinkButton,
    Pagination,
    Section,
    Select,
    Skeleton
} from '@/components/account/ui';
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
            <Section
                title={t(`${KEY}.sectionTitle`, 'Acciones registradas')}
                helpId="section:aiassistants.activity"
            >
                <fieldset
                    className={styles.filters}
                    aria-label={t(`${KEY}.filters.title`, 'Filtrar el historial')}
                >
                    <Checkbox
                        label={t(`${KEY}.filters.includeReads`, 'Mostrar también lo que solo miró')}
                        description={t(
                            `${KEY}.filters.includeReadsHint`,
                            'Acciones en las que el asistente solo vio datos, sin cambiar nada.'
                        )}
                        checked={includeReads}
                        onChange={(event) => {
                            setIncludeReads(event.target.checked);
                            setPage(1);
                        }}
                    />
                    <Field
                        label={t(`${KEY}.filters.outcome`, 'Resultado')}
                        locale={locale}
                        className={styles.outcome}
                    >
                        <Select
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
                        </Select>
                    </Field>
                </fieldset>

                {load.kind === 'loading' && (
                    <Skeleton
                        locale={locale}
                        lines={4}
                    />
                )}

                {load.kind === 'error' && (
                    <ErrorState
                        locale={locale}
                        onRetry={() => loadPage()}
                        description={t(
                            `${KEY}.errors.loadFailed`,
                            'No pudimos cargar el historial. Probá de nuevo.'
                        )}
                    />
                )}

                {load.kind === 'signedOut' && (
                    <Alert
                        tone="danger"
                        locale={locale}
                        action={
                            <LinkButton
                                href={signinUrl}
                                variant="secondary"
                                size="sm"
                            >
                                {t(`${KEY}.errors.signIn`, 'Ingresar')}
                            </LinkButton>
                        }
                    >
                        {t(
                            `${KEY}.errors.signedOut`,
                            'Tu sesión terminó. Volvé a ingresar para ver el historial.'
                        )}
                    </Alert>
                )}

                {emptyOnFirstPage && !filtered && (
                    <EmptyState
                        title={t(`${KEY}.empty.title`, 'Todavía no hay acciones de tus asistentes')}
                        description={t(
                            `${KEY}.empty.description`,
                            'Cuando conectes un asistente de IA y le pidas algo, acá vas a ver lo que hizo con tu cuenta.'
                        )}
                        icon={
                            <AskToAiIcon
                                size={28}
                                aria-hidden={true}
                            />
                        }
                        action={
                            <LinkButton
                                href={connectUrl}
                                variant="secondary"
                            >
                                {t(`${KEY}.empty.cta`, 'Cómo conectar un asistente')}
                            </LinkButton>
                        }
                    />
                )}

                {emptyOnFirstPage && filtered && (
                    <EmptyState
                        variant="compact"
                        title={t(
                            `${KEY}.emptyFiltered`,
                            'No hay acciones que coincidan con este filtro.'
                        )}
                    />
                )}

                {load.kind === 'ready' && load.items.length > 0 && (
                    <DataList label={t(`${KEY}.sectionTitle`, 'Acciones registradas')}>
                        {load.items.map((item) => (
                            <AiActivityItem
                                key={item.id}
                                item={item}
                                locale={locale}
                                t={t}
                            />
                        ))}
                    </DataList>
                )}

                {load.kind === 'ready' && totalPages > 1 && (
                    <Pagination
                        locale={locale}
                        page={page}
                        pageCount={totalPages}
                        onPageChange={setPage}
                        ariaLabel={t(`${KEY}.pagination.label`, 'Páginas del historial')}
                    />
                )}
            </Section>
        </div>
    );
}
