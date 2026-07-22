/**
 * @file ComparisonMatrix.client.tsx
 * @description Side-by-side accommodation comparison matrix island (SPEC-288
 * T-011). Reads the client-only comparison selection ({@link useCompareStore}),
 * hydrates the accommodations through the protected compare endpoint, and renders
 * an attribute matrix (one column per accommodation, one row per attribute).
 *
 * The same attribute matrix is shown to every plan (D-2); only the number of
 * selectable items differs per plan. The endpoint re-validates the per-plan cap,
 * so the island handles `ENTITLEMENT_REQUIRED` / `LIMIT_REACHED` / generic
 * failures alongside the empty and loading states.
 *
 * HOS-85 T-008 adds two independent desktop-matrix affordances on top of the
 * original attribute rows:
 * - A "highlight differences" toggle (default ON, see {@link rowValuesDiffer})
 *   that shades a row's cells when its underlying values are not all equal.
 * - Amber best-value markers (price = cheapest, rating = highest, computed by
 *   {@link computeBestValue}) that always render regardless of the toggle.
 *
 * HOS-85 T-009 makes the same matrix usable on mobile, purely via CSS media
 * queries scoped to `ComparisonMatrix.module.css` (no behavioral change,
 * desktop keeps T-008's exact output):
 * - The attribute column (`.stickyCol`) stays sticky-left with a solid
 *   background so accommodation columns scroll *under* it.
 * - The accommodation columns become a scroll-snap container
 *   (`.scrollSnapContainer`) so columns snap into view one at a time.
 * - The desktop best-value badge is swapped for a compact amber dot
 *   (`.bestValueDot`) that still reads at small sizes.
 * - A decorative scroll hint (`.scrollHint`) nudges users to swipe.
 *
 * Rendered with `client:only="react"` because it depends entirely on the
 * client-side store (no meaningful SSR output).
 *
 * @module components/shared/compare/ComparisonMatrix
 */

import { StarIcon } from '@repo/icons';
import { type FC, type ReactNode, useEffect, useState } from 'react';
import type { AccommodationCardData } from '@/data/types';
import { protectedAccommodationsApi } from '@/lib/api/endpoints-protected';
import { toAccommodationCardProps } from '@/lib/api/transforms';
import { cn } from '@/lib/cn';
import { getAccommodationTypeLabel } from '@/lib/colors';
import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { useCompareStore } from '@/store/compare-store';
import styles from './ComparisonMatrix.module.css';
import { computeBestValue } from './computeBestValue';

/** Minimum number of accommodations required to render a comparison. */
const MIN_TO_COMPARE = 2;

/** Why a comparison request failed, mapped to user-facing messaging. */
type CompareErrorReason = 'upsell' | 'limit' | 'generic';

/** Internal view state of the matrix island. */
type MatrixStatus =
    | { readonly kind: 'empty' }
    | { readonly kind: 'loading' }
    | { readonly kind: 'error'; readonly reason: CompareErrorReason }
    | { readonly kind: 'ready'; readonly items: readonly AccommodationCardData[] };

/** Props for the comparison matrix island. */
export interface ComparisonMatrixProps {
    /** Locale for labels, formatting and links. Defaults to `es`. */
    readonly locale?: SupportedLocale;
}

/** A single comparable attribute row rendered by the matrix. */
interface MatrixRow {
    /** Stable identity for the row, independent of the (localized) label. */
    readonly key: string;
    /** Localized row label shown in the sticky first column. */
    readonly label: string;
    /** Renders the display value for one accommodation. */
    readonly render: (a: AccommodationCardData) => ReactNode;
    /**
     * Extracts the underlying comparable value for one accommodation, used by
     * {@link rowValuesDiffer} to decide whether this row should be highlighted.
     * Must return a primitive so equality can be checked with `===`.
     */
    readonly getValue: (a: AccommodationCardData) => string | number | boolean | null;
    /**
     * `id`s of the accommodation(s) holding the "best value" for this row
     * (price = cheapest, rating = highest). Omitted for rows with no
     * best-value concept (type, location, reviews, featured, summary).
     */
    readonly bestValueIds?: ReadonlySet<string>;
}

/**
 * Determines whether an attribute row's values differ across the compared
 * accommodations.
 *
 * Drives the "highlight differences" affordance only — a row where every
 * accommodation shares the same underlying value (per `getValue`) is never
 * highlighted, even when the toggle is on.
 *
 * @param items - Accommodations currently being compared.
 * @param getValue - Extracts the comparable value for one accommodation.
 * @returns `true` if at least one item's value differs from the first item's.
 */
function rowValuesDiffer(
    items: readonly AccommodationCardData[],
    getValue: (a: AccommodationCardData) => string | number | boolean | null
): boolean {
    if (items.length === 0) {
        return false;
    }
    const [first, ...rest] = items.map(getValue);
    return rest.some((value) => value !== first);
}

/**
 * Classify a failed compare response into a user-facing reason.
 *
 * @param error - The `ApiResult` error payload (`status` + `code`).
 * @returns The matching {@link CompareErrorReason}.
 */
function classifyError(error: {
    readonly status?: number;
    readonly code?: string;
}): CompareErrorReason {
    if (error.status === 401) {
        return 'upsell';
    }
    if (error.status === 403) {
        return error.code === 'LIMIT_REACHED' ? 'limit' : 'upsell';
    }
    return 'generic';
}

/**
 * Side-by-side accommodation comparison matrix.
 *
 * @param props - {@link ComparisonMatrixProps}
 * @returns The matrix, or an empty / loading / error panel.
 */
export const ComparisonMatrix: FC<ComparisonMatrixProps> = ({ locale = 'es' }) => {
    const t = createT(locale);
    const { ids } = useCompareStore();

    const [status, setStatus] = useState<MatrixStatus>(
        ids.length >= MIN_TO_COMPARE ? { kind: 'loading' } : { kind: 'empty' }
    );
    const [retry, setRetry] = useState(0);
    /** Whether differing rows are shaded. Defaults to ON (HOS-85 T-008). */
    const [highlightDiffs, setHighlightDiffs] = useState(true);

    // `retry` is an intentional re-fetch trigger (bumped by the error-state
    // retry button); it is not read inside the effect body.
    // biome-ignore lint/correctness/useExhaustiveDependencies: retry is a deliberate re-run trigger
    useEffect(() => {
        if (ids.length < MIN_TO_COMPARE) {
            setStatus({ kind: 'empty' });
            return;
        }

        let cancelled = false;
        setStatus({ kind: 'loading' });

        void (async () => {
            try {
                const result = await protectedAccommodationsApi.compare({ ids: [...ids] });
                if (cancelled) {
                    return;
                }
                if (!result.ok) {
                    setStatus({ kind: 'error', reason: classifyError(result.error) });
                    return;
                }
                const items = result.data.items.map((item) =>
                    toAccommodationCardProps({
                        // TYPE-WORKAROUND: compare-response items are typed by the
                        // schema; toAccommodationCardProps takes the structurally
                        // compatible Record<string, unknown> the transform expects.
                        item: item as unknown as Record<string, unknown>,
                        locale
                    })
                );
                setStatus({ kind: 'ready', items });
            } catch {
                if (!cancelled) {
                    setStatus({ kind: 'error', reason: 'generic' });
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [ids, locale, retry]);

    const listingHref = `/${locale}/alojamientos/`;
    // Compare is a tourist feature → tourist plans page, not owner plans (BETA-200).
    const pricingHref = `/${locale}/suscriptores/turistas/`;

    if (status.kind === 'empty') {
        return (
            <div className={styles.panel}>
                <h2 className={styles.panelTitle}>
                    {t(
                        'accommodations.comparison.empty.title',
                        'No hay alojamientos para comparar'
                    )}
                </h2>
                <p className={styles.panelMessage}>
                    {t(
                        'accommodations.comparison.empty.message',
                        'Agregá alojamientos desde el listado para verlos lado a lado.'
                    )}
                </p>
                <a
                    href={listingHref}
                    className={styles.panelCta}
                >
                    {t('accommodations.comparison.empty.cta', 'Explorar alojamientos')}
                </a>
            </div>
        );
    }

    if (status.kind === 'loading') {
        return (
            <div
                className={styles.panel}
                aria-busy="true"
            >
                <p className={styles.panelMessage}>{t('common.loading', 'Cargando...')}</p>
            </div>
        );
    }

    if (status.kind === 'error') {
        const isUpsell = status.reason === 'upsell';
        const isLimit = status.reason === 'limit';
        const title = isUpsell
            ? t('accommodations.comparison.upsell.title', 'Comparación de alojamientos')
            : isLimit
              ? t('accommodations.comparison.limit.title', 'Llegaste al máximo')
              : t('accommodations.comparison.error.title', 'No pudimos cargar la comparación');
        const message = isUpsell
            ? t(
                  'accommodations.comparison.upsell.message',
                  'Comparar alojamientos está disponible en los planes Plus y VIP.'
              )
            : isLimit
              ? t(
                    'accommodations.comparison.limit.message',
                    'Tu plan permite comparar hasta {{max}} alojamientos a la vez.'
                )
              : t(
                    'accommodations.comparison.error.message',
                    'Ocurrió un error al cargar los alojamientos. Intentá de nuevo.'
                );

        return (
            <div
                className={styles.panel}
                role="alert"
            >
                <h2 className={styles.panelTitle}>{title}</h2>
                <p className={styles.panelMessage}>{message}</p>
                {isUpsell ? (
                    <a
                        href={pricingHref}
                        className={styles.panelCta}
                    >
                        {t('accommodations.comparison.upsell.cta', 'Ver planes')}
                    </a>
                ) : (
                    <button
                        type="button"
                        className={styles.panelCta}
                        onClick={() => setRetry((n) => n + 1)}
                    >
                        {t('accommodations.comparison.error.retry', 'Reintentar')}
                    </button>
                )}
            </div>
        );
    }

    // status.kind === 'ready'
    const { items } = status;
    const na = t('accommodations.comparison.matrix.notAvailable', 'N/D');
    const { bestPriceIds, bestRatingIds } = computeBestValue({ items });
    const bestPriceIdSet = new Set(bestPriceIds);
    const bestRatingIdSet = new Set(bestRatingIds);

    const rows: readonly MatrixRow[] = [
        {
            key: 'type',
            label: t('accommodations.comparison.matrix.type', 'Tipo'),
            render: (a) => (a.type ? getAccommodationTypeLabel({ type: a.type, t }) : na),
            getValue: (a) => a.type
        },
        {
            key: 'price',
            label: t('accommodations.comparison.matrix.price', 'Precio'),
            render: (a) =>
                a.price
                    ? formatPrice({ amount: a.price.amount, currency: a.price.currency, locale })
                    : na,
            getValue: (a) => a.price?.amount ?? null,
            bestValueIds: bestPriceIdSet
        },
        {
            key: 'location',
            label: t('accommodations.comparison.matrix.location', 'Ubicación'),
            render: (a) => a.cityName ?? a.location.city ?? na,
            getValue: (a) => a.cityName ?? a.location.city ?? null
        },
        {
            key: 'rating',
            label: t('accommodations.comparison.matrix.rating', 'Calificación'),
            render: (a) =>
                a.averageRating > 0 ? (
                    <span className={styles.rating}>
                        <StarIcon
                            size={14}
                            weight="fill"
                            aria-hidden="true"
                        />
                        {a.averageRating.toFixed(1)}
                    </span>
                ) : (
                    na
                ),
            getValue: (a) => a.averageRating,
            bestValueIds: bestRatingIdSet
        },
        {
            key: 'reviews',
            label: t('accommodations.comparison.matrix.reviews', 'Reseñas'),
            render: (a) => String(a.reviewsCount ?? 0),
            getValue: (a) => a.reviewsCount ?? 0
        },
        {
            key: 'featured',
            label: t('accommodations.comparison.matrix.featured', 'Destacado'),
            render: (a) =>
                a.isFeatured ? (
                    <StarIcon
                        size={16}
                        weight="fill"
                        aria-hidden="true"
                    />
                ) : (
                    na
                ),
            getValue: (a) => a.isFeatured
        },
        {
            key: 'summary',
            label: t('accommodations.comparison.matrix.summary', 'Descripción'),
            render: (a) => a.summary || na,
            getValue: (a) => a.summary || null
        }
    ];

    return (
        <>
            <div className={styles.toolbar}>
                <button
                    type="button"
                    className={styles.highlightToggle}
                    aria-pressed={highlightDiffs}
                    onClick={() => setHighlightDiffs((prev) => !prev)}
                >
                    <span
                        className={cn(styles.toggleSwitch, highlightDiffs && styles.toggleSwitchOn)}
                        aria-hidden="true"
                    >
                        <span className={styles.toggleThumb} />
                    </span>
                    {t(
                        'accommodations.comparison.matrix.highlightDifferences',
                        'Resaltar diferencias'
                    )}
                </button>
            </div>
            <p
                className={styles.scrollHint}
                data-testid="comparison-scroll-hint"
                aria-hidden="true"
            >
                {t('accommodations.comparison.matrix.scrollHint', 'Deslizá para ver más →')}
            </p>
            <div
                className={cn(styles.tableWrap, styles.scrollSnapContainer)}
                data-testid="comparison-scroll-container"
            >
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th
                                scope="col"
                                className={cn(styles.cornerCell, styles.stickyCol)}
                                data-testid="comparison-corner-cell"
                            >
                                {t('accommodations.comparison.matrix.attribute', 'Atributo')}
                            </th>
                            {items.map((a) => (
                                <th
                                    key={a.id}
                                    scope="col"
                                    className={styles.headCell}
                                >
                                    {a.featuredImage?.url ? (
                                        <img
                                            src={a.featuredImage.url}
                                            alt={a.name}
                                            className={styles.headImg}
                                            loading="lazy"
                                        />
                                    ) : (
                                        <span
                                            className={styles.headImgPlaceholder}
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span className={styles.headName}>{a.name}</span>
                                    <a
                                        href={`/${locale}/alojamientos/${a.slug}/`}
                                        className={styles.headLink}
                                    >
                                        {t(
                                            'accommodations.comparison.matrix.viewDetails',
                                            'Ver detalle'
                                        )}
                                    </a>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const differs = highlightDiffs && rowValuesDiffer(items, row.getValue);
                            return (
                                <tr
                                    key={row.key}
                                    className={cn(differs && styles.rowDiffers)}
                                    data-testid={`comparison-row-${row.key}`}
                                >
                                    <th
                                        scope="row"
                                        className={cn(styles.rowLabel, styles.stickyCol)}
                                        data-testid={`comparison-row-label-${row.key}`}
                                    >
                                        {row.label}
                                    </th>
                                    {items.map((a) => {
                                        const isBestValue = row.bestValueIds?.has(a.id) ?? false;
                                        return (
                                            <td
                                                key={a.id}
                                                className={styles.dataCell}
                                            >
                                                <span className={styles.cellValue}>
                                                    {row.render(a)}
                                                </span>
                                                {isBestValue ? (
                                                    <>
                                                        <span
                                                            className={styles.bestValueBadge}
                                                            data-testid={`best-value-${row.key}-${a.id}`}
                                                            role="img"
                                                            aria-label={t(
                                                                'accommodations.comparison.matrix.bestValueAriaLabel',
                                                                'Mejor valor en {{attribute}}',
                                                                { attribute: row.label }
                                                            )}
                                                        >
                                                            {t(
                                                                'accommodations.comparison.matrix.bestValue',
                                                                'Mejor valor'
                                                            )}
                                                        </span>
                                                        {/* Mobile-only adaptation (HOS-85 T-009): the badge above is
                                                         * hidden at narrow widths via CSS, this dot takes its place.
                                                         * Never both visible at once, so no duplicate a11y announcement. */}
                                                        <span
                                                            className={styles.bestValueDot}
                                                            data-testid={`best-value-dot-${row.key}-${a.id}`}
                                                            role="img"
                                                            aria-label={t(
                                                                'accommodations.comparison.matrix.bestValueAriaLabel',
                                                                'Mejor valor en {{attribute}}',
                                                                { attribute: row.label }
                                                            )}
                                                        />
                                                    </>
                                                ) : null}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );
};
