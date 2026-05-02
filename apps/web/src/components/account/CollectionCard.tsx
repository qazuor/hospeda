/**
 * @file CollectionCard.tsx
 * @description Co-located sub-component for UserFavoritesList.client.tsx.
 *
 * Renders a single bookmark collection as a clickable card with:
 * - A color-tinted mosaic background (collection color or neutral fallback)
 * - Collection name
 * - Bookmark count badge
 * - Optional icon (falls back to a default star/heart shape)
 *
 * Click navigates to `/favoritos/colecciones/[id]`.
 */

import type { BookmarkCollectionItem } from '@/lib/api/endpoints-protected';
import styles from './UserFavoritesList.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CollectionCardProps {
    /** Collection data from the API */
    readonly collection: BookmarkCollectionItem;
    /** Accessible locale prefix for building the collection URL */
    readonly locale: string;
    /** i18n label for the bookmark count badge (e.g. "favoritos") */
    readonly bookmarksLabel: string;
    /** Base URL for collection detail pages */
    readonly collectionsBasePath: string;
}

// ─── Default color ─────────────────────────────────────────────────────────

const DEFAULT_COLOR = 'var(--primary)';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders a collection card with color mosaic, name and bookmark count.
 * Click navigates to the collection detail page.
 */
export function CollectionCard({
    collection,
    locale,
    bookmarksLabel,
    collectionsBasePath
}: CollectionCardProps) {
    const color = collection.color ?? DEFAULT_COLOR;
    const href = `/${locale}/${collectionsBasePath}/${collection.id}/`;

    return (
        <li className={styles.collectionCard}>
            <a
                href={href}
                className={styles.collectionCardLink}
                aria-label={`${collection.name} (${collection.bookmarkCount} ${bookmarksLabel})`}
            >
                {/* Color mosaic block */}
                <div
                    className={styles.collectionCardMosaic}
                    style={{
                        backgroundColor: `oklch(from ${color} l c h / 0.15)`,
                        borderColor: `oklch(from ${color} l c h / 0.30)`
                    }}
                    aria-hidden="true"
                >
                    {collection.icon ? (
                        <span
                            className={styles.collectionCardIcon}
                            style={{ color }}
                        >
                            {collection.icon}
                        </span>
                    ) : (
                        /* Default neutral star icon via CSS pseudo-element */
                        <span
                            className={styles.collectionCardIconDefault}
                            style={{ color }}
                            aria-hidden="true"
                        />
                    )}
                </div>

                {/* Card body */}
                <div className={styles.collectionCardBody}>
                    <h4 className={styles.collectionCardName}>{collection.name}</h4>
                    <span
                        className={styles.collectionCardCount}
                        style={{
                            backgroundColor: `oklch(from ${color} l c h / 0.12)`,
                            color
                        }}
                    >
                        {collection.bookmarkCount}
                    </span>
                </div>
            </a>
        </li>
    );
}
