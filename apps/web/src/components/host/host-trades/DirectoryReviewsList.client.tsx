/**
 * @file DirectoryReviewsList.client.tsx
 * @description A provider's reviews as the directory shows them
 * (HOS-376 T-053, §6.4).
 *
 * What a host reads before calling somebody: the approved reviews of a
 * provider, each with who wrote it, whether the benefit was honoured, the
 * optional detail, and the provider's answer when a moderator cleared it.
 *
 * The FIRST page arrives server-rendered. That is not an optimisation — the
 * reviews are the reason to open this page, and an island that fetched them
 * after hydration would show a host an empty panel for as long as the round
 * trip takes, on exactly the screen where "there are no reviews" and "they have
 * not loaded" mean opposite things. Hydration only adds paging.
 *
 * What is NOT expressible here, deliberately: whether an absent answer was
 * never written or was written and rejected. The endpoint omits both the same
 * way, so a reader cannot infer that a provider said something a moderator took
 * down. See {@link resolveDirectoryReviewView}.
 */

import { useState } from 'react';
import type { DirectoryReviewRow } from '@/lib/api/endpoints-protected';
import { hostTradesApi } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './DirectoryReviews.module.css';
import { resolveDirectoryReviewView } from './resolve-directory-review-view';

interface DirectoryReviewsListProps {
    readonly locale: SupportedLocale;
    /** The provider whose reviews these are. */
    readonly hostTradeId: string;
    /** The first page, as the server read it. */
    readonly initialRows: readonly DirectoryReviewRow[];
    readonly initialTotal: number;
    readonly initialTotalPages: number;
    /**
     * Whether the server's read of the reviews failed.
     *
     * Separate from an empty page on purpose: a failed read also arrives as
     * zero rows, and rendering "nobody has reviewed this provider" over it
     * states as fact something nobody measured — about a real person's trade,
     * on the screen a host uses to decide whether to call them.
     */
    readonly initialLoadFailed?: boolean;
}

/**
 * Renders a provider's approved reviews, one page at a time.
 *
 * @param props - Locale, the provider id, and the server-read first page.
 * @returns The review list element.
 */
export function DirectoryReviewsList({
    locale,
    hostTradeId,
    initialRows,
    initialTotal,
    initialTotalPages,
    initialLoadFailed = false
}: DirectoryReviewsListProps) {
    const { t, tPlural } = createTranslations(locale);

    const [rows, setRows] = useState<readonly DirectoryReviewRow[]>(initialRows);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(initialTotalPages);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    async function goToPage(next: number) {
        setLoading(true);
        setErrorMessage(null);

        const result = await hostTradesApi.listDirectoryReviews({ hostTradeId, page: next });

        setLoading(false);

        if (!result.ok) {
            // The page already on screen stays: replacing read reviews with an
            // error message would cost the host what he came to read over a
            // failure that only affects the page he asked for next.
            setErrorMessage(
                translateApiError({
                    error: result.error,
                    t,
                    fallback: t(
                        'host-trades.directory.reviews.errors.page',
                        'No pudimos cargar esta página de valoraciones. Probá de nuevo.'
                    )
                })
            );
            return;
        }

        setRows(result.data.items);
        setTotalPages(result.data.pagination.totalPages);
        setPage(result.data.pagination.page);
    }

    if (initialLoadFailed) {
        return (
            <p
                className={styles.error}
                role="alert"
            >
                {t(
                    'host-trades.directory.reviews.errors.initial',
                    'No pudimos cargar las valoraciones de este proveedor. Probá recargar la página.'
                )}
            </p>
        );
    }

    if (initialTotal === 0) {
        return (
            <p className={styles.empty}>
                {t(
                    'host-trades.directory.reviews.empty',
                    'Todavía nadie valoró a este proveedor. Las valoraciones aparecen cuando un anfitrión con un uso confirmado lo valora.'
                )}
            </p>
        );
    }

    return (
        <section className={styles.panel}>
            <h2 className={styles.sectionTitle}>
                {tPlural('host-trades.directory.reviews.title', initialTotal, {
                    count: String(initialTotal)
                })}
            </h2>

            {errorMessage ? (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {errorMessage}
                </p>
            ) : null}

            <ul
                aria-busy={loading}
                className={cn(styles.list, loading && styles.listLoading)}
            >
                {rows.map((row) => {
                    const view = resolveDirectoryReviewView({ row });

                    return (
                        <li
                            className={styles.reviewCard}
                            key={row.review.id}
                        >
                            <div className={styles.rowHeader}>
                                <p className={styles.rowTitle}>
                                    {row.author?.displayName ??
                                        t(
                                            'host-trades.directory.reviews.anonymous',
                                            'Un anfitrión'
                                        )}
                                </p>
                                <span
                                    aria-hidden="true"
                                    className={styles.stars}
                                >
                                    {'★'.repeat(row.review.overallRating)}
                                    {'☆'.repeat(5 - row.review.overallRating)}
                                </span>
                                <span className={styles.srOnly}>
                                    {t(
                                        'host-trades.directory.reviews.rating',
                                        '{{count}} de 5 estrellas',
                                        { count: String(row.review.overallRating) }
                                    )}
                                </span>
                            </div>

                            <p className={styles.rowMeta}>
                                {formatDate({ date: row.review.createdAt, locale })}
                                {' · '}
                                {row.review.respectedBenefit
                                    ? t(
                                          'host-trades.directory.reviews.benefitYes',
                                          'Respetó el beneficio'
                                      )
                                    : t(
                                          'host-trades.directory.reviews.benefitNo',
                                          'NO respetó el beneficio'
                                      )}
                            </p>

                            {view.content ? <p className={styles.rowBody}>{view.content}</p> : null}

                            {view.breakdown ? (
                                <dl className={styles.breakdown}>
                                    {view.breakdown.map((entry) => (
                                        <div
                                            className={styles.breakdownItem}
                                            key={entry.key}
                                        >
                                            {/* The labels the review FORM uses,
                                                not a directory-local copy: the
                                                host who scored "Puntualidad"
                                                has to read the same word back
                                                where it is published. */}
                                            <dt className={styles.breakdownLabel}>
                                                {t(
                                                    `host-trades.review.breakdown.${entry.key}`,
                                                    entry.key
                                                )}
                                            </dt>
                                            <dd className={styles.breakdownValue}>
                                                {entry.value}
                                                <span className={styles.srOnly}>
                                                    {t(
                                                        'host-trades.directory.reviews.rating',
                                                        '{{count}} de 5 estrellas',
                                                        { count: String(entry.value) }
                                                    )}
                                                </span>
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            ) : null}

                            {view.reply ? (
                                <div className={styles.replyBlock}>
                                    <p className={styles.replyLabel}>
                                        {t(
                                            'host-trades.directory.reviews.replyLabel',
                                            'Respuesta del proveedor'
                                        )}
                                    </p>
                                    <p className={styles.rowBody}>{view.reply.content}</p>

                                    {view.showEditedAfterReplyNotice ? (
                                        <p className={styles.rowMeta}>
                                            {t(
                                                'host-trades.directory.reviews.editedAfterReply',
                                                'La valoración fue editada después de esta respuesta.'
                                            )}
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}
                        </li>
                    );
                })}
            </ul>

            {totalPages > 1 ? (
                <nav
                    aria-label={t(
                        'host-trades.directory.reviews.paginationLabel',
                        'Paginación de valoraciones'
                    )}
                    className={styles.pagination}
                >
                    <button
                        className={styles.pageButton}
                        disabled={loading || page <= 1}
                        onClick={() => void goToPage(page - 1)}
                        type="button"
                    >
                        {t('host-trades.directory.reviews.previous', 'Anteriores')}
                    </button>
                    <span
                        aria-live="polite"
                        className={styles.pageStatus}
                    >
                        {t(
                            'host-trades.directory.reviews.pageStatus',
                            'Página {{page}} de {{total}}',
                            { page: String(page), total: String(totalPages) }
                        )}
                    </span>
                    <button
                        className={styles.pageButton}
                        disabled={loading || page >= totalPages}
                        onClick={() => void goToPage(page + 1)}
                        type="button"
                    >
                        {t('host-trades.directory.reviews.next', 'Siguientes')}
                    </button>
                </nav>
            ) : null}
        </section>
    );
}
