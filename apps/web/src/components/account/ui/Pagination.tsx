/**
 * Pagination — the one paginator of the Mi Cuenta kit (HOS-2413 T-014).
 *
 * Replaces the seven paginators the account pages grew. Three variants:
 *
 * - `numbered`: pages with an ellipsis range.
 * - `prevNext`: just the two arrows.
 * - `loadMore`: a button that appends items, announces how many through a
 *   polite live region and moves focus to the first new item.
 *
 * Navigation is EITHER `hrefFor(page)` (real links, work without JS) OR
 * `onPageChange(page)` (client). `<nav aria-label>` is translated, the current
 * page has `aria-current="page"`, and the first and last pages disable the
 * matching arrow at the bounds.
 *
 * @module components/account/ui/Pagination
 */

import { type ReactNode, useState } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { Button } from './Button';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './Pagination.module.css';
import { buildPageRange } from './pagination-range';

/** What a `loadMore` handler reports back once the new items are in the DOM. */
export interface LoadMoreResult {
    /** How many items were appended. Announced politely. */
    readonly addedCount: number;
    /** Moves focus to the first new item. Called after the announcement. */
    readonly focusFirstNew?: () => void;
}

type NavigationProps =
    | {
          /** Builds the URL of a page: renders real links. */
          readonly hrefFor: (page: number) => string;
          readonly onPageChange?: undefined;
      }
    | {
          /** Called with the requested page: renders buttons. */
          readonly onPageChange: (page: number) => void;
          readonly hrefFor?: undefined;
      };

type PagedProps = NavigationProps & {
    readonly variant?: 'numbered' | 'prevNext';
    /** Current page, 1-based. */
    readonly page: number;
    /** Total pages. */
    readonly pageCount: number;
    readonly onLoadMore?: undefined;
};

type LoadMoreProps = {
    readonly variant: 'loadMore';
    /** Appends the next items; resolves once they are rendered. */
    readonly onLoadMore: () => Promise<LoadMoreResult | undefined>;
    /** False hides the button (nothing left to load). @default true */
    readonly hasMore?: boolean;
    readonly page?: undefined;
    readonly pageCount?: undefined;
    readonly hrefFor?: undefined;
    readonly onPageChange?: undefined;
};

/** Props of {@link Pagination}. */
export type PaginationProps = (PagedProps | LoadMoreProps) & {
    /** Locale for the labels. */
    readonly locale: SupportedLocale;
    /** Translated nav label override. Defaults to «Paginación». */
    readonly ariaLabel?: string;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
};

/** One page item or arrow: a link when `href` is given, a button otherwise. */
function PageControl({
    href,
    disabled,
    current,
    label,
    onSelect,
    children
}: {
    readonly href?: string;
    readonly disabled?: boolean;
    readonly current?: boolean;
    readonly label: string;
    readonly onSelect?: () => void;
    readonly children: ReactNode;
}) {
    if (href !== undefined) {
        if (disabled) {
            // At a bound there is nothing to link to: a disabled button is the
            // honest control (a href-less anchor is not focusable or a link).
            return (
                <button
                    type="button"
                    className={styles.item}
                    aria-label={label}
                    disabled
                >
                    {children}
                </button>
            );
        }
        return (
            <a
                href={href}
                className={styles.item}
                aria-label={label}
                aria-current={current ? 'page' : undefined}
            >
                {children}
            </a>
        );
    }
    return (
        <button
            type="button"
            className={styles.item}
            aria-label={label}
            aria-current={current ? 'page' : undefined}
            disabled={disabled}
            onClick={onSelect}
        >
            {children}
        </button>
    );
}

/**
 * The kit paginator.
 *
 * @param props - See {@link PaginationProps}.
 * @returns A `<nav>` with the pagination controls.
 */
export function Pagination(props: PaginationProps) {
    const { locale, className, helpId } = props;
    const t = createT(locale);
    const [announcement, setAnnouncement] = useState('');
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const navLabel = props.ariaLabel ?? t('account.ui.pagination.label');

    if (props.variant === 'loadMore') {
        const { onLoadMore, hasMore = true } = props;
        const handleLoadMore = async () => {
            setLoading(true);
            setFailed(false);
            setAnnouncement('');
            try {
                const result = await onLoadMore();
                if (result) {
                    setAnnouncement(
                        t('account.ui.pagination.loadedMore', undefined, {
                            count: result.addedCount
                        })
                    );
                    result.focusFirstNew?.();
                }
            } catch {
                // A failed load must be said, never swallowed: the button stays
                // so the user can retry, and the live region announces it.
                setAnnouncement(t('account.ui.pagination.loadError'));
                setFailed(true);
            } finally {
                setLoading(false);
            }
        };
        return (
            <nav
                aria-label={navLabel}
                {...helpAttr({ helpId })}
                className={cx(styles.nav, className)}
            >
                {hasMore ? (
                    <Button
                        variant="secondary"
                        loading={loading}
                        onClick={handleLoadMore}
                    >
                        {t('account.ui.pagination.loadMore')}
                    </Button>
                ) : null}
                {failed ? (
                    <p
                        role="alert"
                        className={styles.error}
                    >
                        {announcement}
                    </p>
                ) : null}
                <p
                    aria-live="polite"
                    className={styles.visuallyHidden}
                >
                    {failed ? '' : announcement}
                </p>
            </nav>
        );
    }

    const { page, pageCount, hrefFor, onPageChange, variant = 'numbered' } = props;
    const current = Math.min(Math.max(page, 1), Math.max(pageCount, 1));
    const target = (p: number) => ({
        href: hrefFor?.(p),
        onSelect: onPageChange ? () => onPageChange(p) : undefined
    });
    const previous = (
        <PageControl
            {...target(current - 1)}
            disabled={current <= 1}
            label={t('account.ui.pagination.previous')}
        >
            <span aria-hidden="true">‹</span>
        </PageControl>
    );
    const next = (
        <PageControl
            {...target(current + 1)}
            disabled={current >= pageCount}
            label={t('account.ui.pagination.next')}
        >
            <span aria-hidden="true">›</span>
        </PageControl>
    );

    if (variant === 'prevNext') {
        return (
            <nav
                aria-label={navLabel}
                {...helpAttr({ helpId })}
                className={cx(styles.nav, className)}
            >
                {previous}
                {next}
            </nav>
        );
    }

    return (
        <nav
            aria-label={navLabel}
            {...helpAttr({ helpId })}
            className={cx(styles.nav, className)}
        >
            <ul className={styles.list}>
                <li>{previous}</li>
                {buildPageRange({ page: current, pageCount }).map((slot, index) =>
                    slot === 'ellipsis' ? (
                        <li
                            // biome-ignore lint/suspicious/noArrayIndexKey: ellipsis slots have no identity; the list is rebuilt per render
                            key={`e${index}`}
                            className={styles.ellipsis}
                            aria-hidden="true"
                        >
                            …
                        </li>
                    ) : (
                        <li key={slot}>
                            <PageControl
                                {...target(slot)}
                                current={slot === current}
                                label={t('account.ui.pagination.page', undefined, { page: slot })}
                            >
                                {slot}
                            </PageControl>
                        </li>
                    )
                )}
                <li>{next}</li>
            </ul>
        </nav>
    );
}
