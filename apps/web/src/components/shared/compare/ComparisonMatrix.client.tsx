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
 * Rendered with `client:only="react"` because it depends entirely on the
 * client-side store (no meaningful SSR output).
 *
 * @module components/shared/compare/ComparisonMatrix
 */

import type { AccommodationCardData } from '@/data/types';
import { protectedAccommodationsApi } from '@/lib/api/endpoints-protected';
import { toAccommodationCardProps } from '@/lib/api/transforms';
import { getAccommodationTypeLabel } from '@/lib/colors';
import { formatPrice } from '@/lib/format-utils';
import { createT } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { useCompareStore } from '@/store/compare-store';
import { StarIcon } from '@repo/icons';
import { type FC, type ReactNode, useEffect, useState } from 'react';
import styles from './ComparisonMatrix.module.css';

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
    const pricingHref = `/${locale}/suscriptores/planes/`;

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

    const rows: ReadonlyArray<{
        readonly label: string;
        readonly render: (a: AccommodationCardData) => ReactNode;
    }> = [
        {
            label: t('accommodations.comparison.matrix.type', 'Tipo'),
            render: (a) => (a.type ? getAccommodationTypeLabel({ type: a.type, t }) : na)
        },
        {
            label: t('accommodations.comparison.matrix.price', 'Precio'),
            render: (a) =>
                a.price
                    ? formatPrice({ amount: a.price.amount, currency: a.price.currency, locale })
                    : na
        },
        {
            label: t('accommodations.comparison.matrix.location', 'Ubicación'),
            render: (a) => a.cityName ?? a.location.city ?? na
        },
        {
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
                )
        },
        {
            label: t('accommodations.comparison.matrix.reviews', 'Reseñas'),
            render: (a) => String(a.reviewsCount ?? 0)
        },
        {
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
                )
        },
        {
            label: t('accommodations.comparison.matrix.summary', 'Descripción'),
            render: (a) => a.summary || na
        }
    ];

    return (
        <div className={styles.tableWrap}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th
                            scope="col"
                            className={styles.cornerCell}
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
                    {rows.map((row) => (
                        <tr key={row.label}>
                            <th
                                scope="row"
                                className={styles.rowLabel}
                            >
                                {row.label}
                            </th>
                            {items.map((a) => (
                                <td
                                    key={a.id}
                                    className={styles.dataCell}
                                >
                                    {row.render(a)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
