/**
 * MyContentList — the one list template for what the user authored: events,
 * posts and promotions (HOS-2505, spec HOS-2416 §6.1, G-3).
 *
 * Anatomy: a `PageHeader` (the page's only `h1`) with the «Crear» action and
 * the page «?», optional filters, then ONE `Section` whose body is decided by
 * `state`, like `AsyncRegion`:
 *
 * - `loading`: a Skeleton.
 * - `error`: an `ErrorState` wired to `retry` (or the caller's `errorRegion`,
 *   for a server-rendered page whose retry lives in a small island). A failed
 *   read is never shown as «empty».
 * - `empty`: the caller's `EmptyState`.
 * - `locked`: a `LockedState` (D9 «sin acceso único»: no redirect, no form).
 * - `ready`: the `ContentCard`s in a grid that adapts to its container, then
 *   `Pagination` whenever there is more than one page. There is no silent cap
 *   (HOS-2440): every page is reachable.
 *
 * @module components/account/ui/MyContentList
 */

import type { ReactNode } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { cx } from './cx';
import { ErrorState } from './ErrorState';
import type { HelpAnchor } from './help-anchor';
import { LockedState } from './LockedState';
import type { LockReason } from './lock-reason';
import styles from './MyContentList.module.css';
import { PageHeader } from './PageHeader';
import { Pagination } from './Pagination';
import { Section } from './Section';
import { Skeleton } from './Skeleton';

/** What the list body shows. */
export type MyContentListState =
    | { readonly status: 'loading' }
    | { readonly status: 'error'; readonly retry?: () => void | Promise<void> }
    | { readonly status: 'empty' }
    | { readonly status: 'locked'; readonly reason: LockReason }
    | { readonly status: 'ready' };

/** Page navigation of a {@link MyContentList}. */
export type MyContentListPagination = {
    /** Current page, 1-based. */
    readonly page: number;
    /** Total pages. Pagination renders only when it is above 1. */
    readonly pageCount: number;
} & (
    | { readonly hrefFor: (page: number) => string; readonly onPageChange?: undefined }
    | { readonly onPageChange: (page: number) => void; readonly hrefFor?: undefined }
);

/** Props of {@link MyContentList}. */
export interface MyContentListProps {
    /** Locale for the fixed copy. */
    readonly locale: SupportedLocale;
    /** Page title: the only `h1`. */
    readonly title: ReactNode;
    /** One supporting line under the title. */
    readonly description?: ReactNode;
    /** The page «?» (from Astro: `<PageHelpLink slot="help" />`). */
    readonly help?: ReactNode;
    /** The «Crear» action (a primary `LinkButton`). Omit it when the user cannot create. */
    readonly createAction?: ReactNode;
    /** Filters above the list (FilterChips, a Select). */
    readonly filters?: ReactNode;
    /** Something to say above the list (an Alert, a notice). */
    readonly notice?: ReactNode;
    /** Title of the list Section. */
    readonly sectionTitle: ReactNode;
    /** REQUIRED help anchor of the list Section. */
    readonly helpId: HelpAnchor;
    /** Translated accessible name of the card list. */
    readonly listLabel: string;
    /** What the body shows. */
    readonly state: MyContentListState;
    /** The EmptyState for `empty`. */
    readonly empty?: ReactNode;
    /**
     * Replaces the built-in ErrorState for `error`: a server-rendered page
     * passes its own small retry island here.
     */
    readonly errorRegion?: ReactNode;
    /** The `ContentCard`s for `ready`. */
    readonly children?: ReactNode;
    /** Page navigation for `ready`. */
    readonly pagination?: MyContentListPagination;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
}

/** The Section body for the current state. */
function ListBody({
    locale,
    state,
    empty,
    errorRegion,
    listLabel,
    children,
    pagination
}: Pick<
    MyContentListProps,
    'locale' | 'state' | 'empty' | 'errorRegion' | 'listLabel' | 'children' | 'pagination'
>) {
    switch (state.status) {
        case 'loading':
            return (
                <Skeleton
                    locale={locale}
                    shape="text"
                    lines={4}
                />
            );
        case 'error': {
            if (errorRegion !== undefined) return <>{errorRegion}</>;
            const retry = state.retry;
            return (
                <ErrorState
                    locale={locale}
                    onRetry={retry ?? (() => window.location.reload())}
                />
            );
        }
        case 'empty':
            return <>{empty}</>;
        case 'locked':
            return (
                <LockedState
                    locale={locale}
                    reason={state.reason}
                />
            );
        case 'ready':
            return (
                <>
                    <div className={styles.gridWrap}>
                        <ul
                            className={styles.grid}
                            aria-label={listLabel}
                        >
                            {children}
                        </ul>
                    </div>
                    {pagination && pagination.pageCount > 1 ? (
                        pagination.hrefFor ? (
                            <Pagination
                                locale={locale}
                                page={pagination.page}
                                pageCount={pagination.pageCount}
                                hrefFor={pagination.hrefFor}
                                className={styles.pagination}
                            />
                        ) : (
                            <Pagination
                                locale={locale}
                                page={pagination.page}
                                pageCount={pagination.pageCount}
                                onPageChange={pagination.onPageChange}
                                className={styles.pagination}
                            />
                        )
                    ) : null}
                </>
            );
    }
}

/**
 * The kit list template for authored content.
 *
 * @param props - See {@link MyContentListProps}.
 * @returns The page header, the filters and the list Section.
 */
export function MyContentList({
    locale,
    title,
    description,
    help,
    createAction,
    filters,
    notice,
    sectionTitle,
    helpId,
    listLabel,
    state,
    empty,
    errorRegion,
    children,
    pagination,
    className
}: MyContentListProps) {
    return (
        <div className={cx(styles.root, className)}>
            <PageHeader
                locale={locale}
                title={title}
                description={description}
                help={help}
                actions={createAction}
            />
            {notice}
            {filters ? <div className={styles.filters}>{filters}</div> : null}
            <Section
                title={sectionTitle}
                helpId={helpId}
            >
                <ListBody
                    locale={locale}
                    state={state}
                    empty={empty}
                    errorRegion={errorRegion}
                    listLabel={listLabel}
                    pagination={pagination}
                >
                    {children}
                </ListBody>
            </Section>
        </div>
    );
}
