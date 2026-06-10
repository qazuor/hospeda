/**
 * @file BookmarkGrid.tsx
 * @description Co-located sub-components for UserFavoritesList.client.tsx.
 *
 * Contains the reusable bookmark card grid, pagination, and empty state
 * that are shared across all entity type tabs.
 *
 * T-049d: Each card now includes an inline note editor via `EditableNote`.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { EditableNote } from './EditableNote';
import styles from './UserFavoritesList.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal shape of a bookmark returned by the API */
export interface BookmarkItem {
    readonly id: string;
    readonly entityId: string;
    readonly entityType: string;
    /** User-editable label (defaults to null when the bookmark is just a heart click). */
    readonly name?: string | null;
    /** User's personal note for this bookmark (stored as `description` on the server) */
    readonly description?: string | null;
    /**
     * ID of the collection this bookmark belongs to.
     * `null` or `undefined` means the bookmark is uncollected.
     * Used by the parent to pre-select the matching radio option in the
     * MoveToCollectionModal.
     */
    readonly collectionId?: string | null;
    /** Display name resolved from the referenced entity (server-enriched). */
    readonly entityName?: string | null;
    /** Slug resolved from the referenced entity (server-enriched). */
    readonly entitySlug?: string | null;
    /** Featured image URL resolved from the referenced entity (server-enriched). */
    readonly entityImage?: string | null;
}

/** API response shape for the bookmarks list */
export interface BookmarksApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly bookmarks: readonly BookmarkItem[];
        readonly total: number;
    };
    readonly error?: { readonly message: string };
}

/** API response shape for bookmark delete */
export interface DeleteApiResponse {
    readonly success: boolean;
    readonly error?: { readonly message: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive the canonical URL for a bookmarked entity. Prefers the server-resolved
 * slug; falls back to the raw entityId when the entity was not enriched.
 *
 * `pathSegment` may be a literal string (e.g. when the caller knows the active
 * tab's entity type) or a resolver function (used by the "Todos" tab where each
 * bookmark may belong to a different entity type).
 */
export function resolveEntityUrl(
    bookmark: BookmarkItem,
    locale: string,
    pathSegment: string | ((entityType: string) => string)
): string {
    const identifier = bookmark.entitySlug ?? bookmark.entityId;
    const segment =
        typeof pathSegment === 'function' ? pathSegment(bookmark.entityType) : pathSegment;
    return `/${locale}/${segment}/${identifier}/`;
}

// ─── EmptyFavorites ───────────────────────────────────────────────────────────

/**
 * Minimal inline empty state component.
 * EmptyState.astro cannot be used in React islands, so this is a plain-React
 * equivalent that uses the same CSS custom properties.
 */
export function EmptyFavorites({ label }: { readonly label: string }) {
    return (
        <div
            style={{
                textAlign: 'center',
                padding: 'var(--space-10, 40px) var(--space-6, 24px)',
                color: 'var(--core-muted-foreground)',
                fontFamily: 'var(--font-sans)',
                background: 'var(--core-card)',
                borderRadius: 'var(--radius-card)',
                border: '1px dashed var(--border)'
            }}
        >
            <p style={{ margin: 0 }}>{label}</p>
        </div>
    );
}

// ─── BookmarkGrid ─────────────────────────────────────────────────────────────

export interface BookmarkGridProps {
    readonly bookmarks: readonly BookmarkItem[];
    readonly total: number;
    readonly page: number;
    readonly totalPages: number;
    readonly removingIds: ReadonlySet<string>;
    readonly locale: SupportedLocale;
    /**
     * Path segment for the bookmark's detail URL. Can be a literal (single
     * entity type tab) or a function that resolves per-bookmark (the "Todos"
     * tab where each card may be of a different type).
     */
    readonly pathSegment: string | ((entityType: string) => string);
    /**
     * Card meta label shown under the title. Same string/function pattern as
     * `pathSegment` for cross-entity rendering.
     */
    readonly cardTypeLabel: string | ((entityType: string) => string);
    readonly removeLabel: string;
    readonly removingLabel: string;
    readonly removeBtnLabel: string;
    readonly noImageLabel: string;
    readonly untitledLabel: string;
    readonly listAriaLabel: string;
    readonly paginationAriaLabel: string;
    readonly prevLabel: string;
    readonly nextLabel: string;
    readonly prevPageLabel: string;
    readonly nextPageLabel: string;
    /** Full API base URL (e.g. `http://localhost:3001`) for PATCH note requests */
    readonly apiBase: string;
    /** Placeholder text shown when a bookmark has no note */
    readonly notePlaceholder: string;
    /** Label for the Save button in the note editor */
    readonly noteSaveLabel: string;
    /** Label for the Cancel button in the note editor */
    readonly noteCancelLabel: string;
    /** Accessible label for the note textarea */
    readonly noteTextareaLabel: string;
    /** Accessible label for the edit-note trigger button */
    readonly noteEditButtonLabel: string;
    /** Error message shown via toast when saving a note fails */
    readonly noteSaveErrorMessage: string;
    /** Visible label for the "Move to collection" action button */
    readonly moveBtnLabel: string;
    /** Accessible label template for the move button (must contain {{name}}) */
    readonly moveBtnAriaLabel: string;
    readonly onRemove: (bookmark: BookmarkItem) => void;
    readonly onPageChange: (page: number) => void;
    /**
     * Called when the user clicks the "Mover" button on a card.
     * The parent opens the MoveToCollectionModal pre-filled for this bookmark.
     */
    readonly onMove: (bookmark: BookmarkItem) => void;
    /**
     * Called when a note is successfully saved for a specific bookmark.
     * The parent should update the bookmark's `description` in its local state.
     */
    readonly onNoteUpdated: (bookmarkId: string, newDescription: string) => void;
}

/**
 * Reusable grid of bookmark cards with pagination and inline note editing.
 *
 * Renders a uniform thumbnail + title + link + note editor + remove-button
 * pattern for any entity type tab. The link URL is resolved from `entityUrl`
 * or constructed from `locale/pathSegment/slug`. The inline note editor calls
 * `onNoteUpdated` on success so the parent can update local state.
 */
export function BookmarkGrid({
    bookmarks,
    page,
    totalPages,
    removingIds,
    locale,
    pathSegment,
    cardTypeLabel,
    removeLabel,
    removingLabel,
    removeBtnLabel,
    noImageLabel,
    untitledLabel,
    listAriaLabel,
    paginationAriaLabel,
    prevLabel,
    nextLabel,
    prevPageLabel,
    nextPageLabel,
    apiBase,
    notePlaceholder,
    noteSaveLabel,
    noteCancelLabel,
    noteTextareaLabel,
    noteEditButtonLabel,
    noteSaveErrorMessage,
    moveBtnLabel,
    moveBtnAriaLabel,
    onRemove,
    onMove,
    onPageChange,
    onNoteUpdated
}: BookmarkGridProps) {
    return (
        <>
            <ul
                className={styles.grid}
                aria-label={listAriaLabel}
            >
                {bookmarks.map((bookmark) => {
                    const href = resolveEntityUrl(bookmark, locale, pathSegment);
                    // Prefer the user's custom label; fall back to the
                    // server-resolved entity name; last resort is the i18n placeholder.
                    const displayTitle = bookmark.name ?? bookmark.entityName ?? untitledLabel;
                    const resolvedTypeLabel =
                        typeof cardTypeLabel === 'function'
                            ? cardTypeLabel(bookmark.entityType)
                            : cardTypeLabel;
                    return (
                        <li
                            key={bookmark.id}
                            className={styles.card}
                        >
                            {/* Image */}
                            <div className={styles.cardImage}>
                                {bookmark.entityImage ? (
                                    <img
                                        src={bookmark.entityImage}
                                        alt={displayTitle}
                                        className={styles.cardImg}
                                        loading="lazy"
                                    />
                                ) : (
                                    <div
                                        className={styles.cardImagePlaceholder}
                                        aria-hidden="true"
                                    >
                                        {noImageLabel}
                                    </div>
                                )}
                            </div>

                            {/* Body */}
                            <div className={styles.cardBody}>
                                <h3 className={styles.cardTitle}>
                                    <a
                                        href={href}
                                        className={styles.cardTitleLink}
                                    >
                                        {displayTitle}
                                    </a>
                                </h3>
                                <p className={styles.cardMeta}>{resolvedTypeLabel}</p>

                                {/* Inline note editor */}
                                <EditableNote
                                    bookmarkId={bookmark.id}
                                    initialValue={bookmark.description}
                                    onSaved={(newDescription) => {
                                        onNoteUpdated(bookmark.id, newDescription);
                                    }}
                                    apiBase={apiBase}
                                    placeholder={notePlaceholder}
                                    saveLabel={noteSaveLabel}
                                    cancelLabel={noteCancelLabel}
                                    textareaLabel={noteTextareaLabel}
                                    editButtonLabel={noteEditButtonLabel}
                                    saveErrorMessage={noteSaveErrorMessage}
                                    locale={locale}
                                />
                            </div>

                            {/* Footer with move + remove buttons */}
                            <div className={styles.cardFooter}>
                                <button
                                    type="button"
                                    className={styles.moveBtn}
                                    data-testid={`move-bookmark-button-${bookmark.id}`}
                                    disabled={removingIds.has(bookmark.id)}
                                    onClick={() => onMove(bookmark)}
                                    aria-label={moveBtnAriaLabel.replace('{{name}}', displayTitle)}
                                >
                                    {moveBtnLabel}
                                </button>
                                <button
                                    type="button"
                                    className={styles.removeBtn}
                                    disabled={removingIds.has(bookmark.id)}
                                    onClick={() => onRemove(bookmark)}
                                    aria-label={`${removeLabel}: ${displayTitle}`}
                                >
                                    {removingIds.has(bookmark.id) ? removingLabel : removeBtnLabel}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {/* Pagination */}
            {totalPages > 1 && (
                <nav
                    className={styles.pagination}
                    aria-label={paginationAriaLabel}
                >
                    <button
                        type="button"
                        className={styles.pageBtn}
                        disabled={page === 1}
                        onClick={() => onPageChange(Math.max(1, page - 1))}
                        aria-label={prevPageLabel}
                    >
                        {prevLabel}
                    </button>
                    <span className={styles.pageInfo}>
                        {page} / {totalPages}
                    </span>
                    <button
                        type="button"
                        className={styles.pageBtn}
                        disabled={page === totalPages}
                        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                        aria-label={nextPageLabel}
                    >
                        {nextLabel}
                    </button>
                </nav>
            )}
        </>
    );
}
