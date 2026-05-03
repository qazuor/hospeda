/**
 * @file BookmarkGrid.tsx
 * @description Co-located sub-components for UserFavoritesList.client.tsx.
 *
 * Contains the reusable bookmark card grid, pagination, and empty state
 * that are shared across all entity type tabs.
 *
 * T-049d: Each card now includes an inline note editor via `EditableNote`.
 */

import { EditableNote } from './EditableNote';
import styles from './UserFavoritesList.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal shape of a bookmark returned by the API */
export interface BookmarkItem {
    readonly id: string;
    readonly entityId: string;
    readonly entityType: string;
    /** Display name stored at bookmark-creation time */
    readonly name?: string | null;
    /** User's personal note for this bookmark (stored as `description` on the server) */
    readonly description?: string | null;
    /** Thumbnail image URL (may be absent) */
    readonly imageUrl?: string | null;
    /**
     * Entity URL provided directly by the API.
     * When absent, the URL is constructed from locale + pathSegment + slug/entityId.
     */
    readonly entityUrl?: string | null;
    /** Slug for URL construction (may be absent; entityId is used as fallback) */
    readonly slug?: string | null;
    /**
     * ID of the collection this bookmark belongs to.
     * `null` or `undefined` means the bookmark is uncollected.
     * Used by the parent to pre-select the matching radio option in the
     * MoveToCollectionModal.
     */
    readonly collectionId?: string | null;
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
 * Derive the canonical URL for a bookmarked entity.
 *
 * @param bookmark - Bookmark item with optional entityUrl/slug/entityId
 * @param locale - Active locale string for URL prefix
 * @param pathSegment - Entity type path segment (e.g. 'alojamientos')
 * @returns Resolved URL string
 */
export function resolveEntityUrl(
    bookmark: BookmarkItem,
    locale: string,
    pathSegment: string
): string {
    if (bookmark.entityUrl) return bookmark.entityUrl;
    const identifier = bookmark.slug ?? bookmark.entityId;
    return `/${locale}/${pathSegment}/${identifier}/`;
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
                color: 'var(--muted-foreground)',
                fontFamily: 'var(--font-sans)',
                background: 'var(--card)',
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
    readonly locale: string;
    readonly pathSegment: string;
    readonly cardTypeLabel: string;
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
                    return (
                        <li
                            key={bookmark.id}
                            className={styles.card}
                        >
                            {/* Image */}
                            <div className={styles.cardImage}>
                                {bookmark.imageUrl ? (
                                    <img
                                        src={bookmark.imageUrl}
                                        alt={bookmark.name ?? ''}
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
                                        {bookmark.name ?? untitledLabel}
                                    </a>
                                </h3>
                                <p className={styles.cardMeta}>{cardTypeLabel}</p>

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
                                    aria-label={moveBtnAriaLabel.replace(
                                        '{{name}}',
                                        bookmark.name ?? ''
                                    )}
                                >
                                    {moveBtnLabel}
                                </button>
                                <button
                                    type="button"
                                    className={styles.removeBtn}
                                    disabled={removingIds.has(bookmark.id)}
                                    onClick={() => onRemove(bookmark)}
                                    aria-label={`${removeLabel}: ${bookmark.name ?? ''}`}
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
