/**
 * MediaManager — the visual layer of the owner photo editors (HOS-2489, spec
 * HOS-2415 §6.4).
 *
 * The accommodation `PhotoSection` and the listing `MediaSection` keep their
 * own logic hooks (endpoints, caps, upload pipeline) and share only this skin:
 *
 * - {@link MediaDropzone}: the dashed «drop or pick» target, as a wide slot
 *   (the cover) or as a grid tile (add to the gallery).
 * - {@link MediaUploadStatus}: compressing / uploading / «photo n of N», with a
 *   native `<progress>` (no inline width style).
 * - {@link PhotoGrid}: the thumbnail grid, sized by container query.
 * - {@link PhotoTile}: one photo with an action slot over the image, a badge
 *   slot (e.g. missing alt text), a toolbar and a body (the metadata editor).
 *
 * The pieces carry no copy of their own: every label comes from the caller,
 * already translated.
 *
 * @module components/account/ui/MediaManager
 */

import { AddIcon, UploadIcon } from '@repo/icons';
import type { CSSProperties, DragEvent, ReactNode, Ref } from 'react';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './MediaManager.module.css';

/** Props of {@link MediaDropzone}. */
export interface MediaDropzoneProps {
    /** Main line («Arrastrá una imagen o hacé clic»). For a tile, the accessible name. */
    readonly title: string;
    /** Secondary line (formats and size). Not shown on a tile. */
    readonly hint?: string;
    /** `slot` is the wide cover target; `tile` sits in a {@link PhotoGrid}. @default 'slot' */
    readonly variant?: 'slot' | 'tile';
    /** A file is being dragged over the target. */
    readonly isDragOver?: boolean;
    /** Blocks the target (an upload is running or the cap is unknown). */
    readonly disabled?: boolean;
    /** Opens the file picker. */
    readonly onPick: () => void;
    /** Receives dropped files. */
    readonly onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
    /** Marks the drag-over state. */
    readonly onDragOver?: (event: DragEvent<HTMLButtonElement>) => void;
    /** Clears the drag-over state. */
    readonly onDragLeave?: () => void;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The «drop or pick a photo» target.
 *
 * @param props - See {@link MediaDropzoneProps}.
 * @returns A `<button>` that opens the picker and accepts dropped files.
 */
export function MediaDropzone({
    title,
    hint,
    variant = 'slot',
    isDragOver = false,
    disabled = false,
    onPick,
    onDrop,
    onDragOver,
    onDragLeave,
    className,
    helpId
}: MediaDropzoneProps) {
    const isTile = variant === 'tile';
    return (
        <button
            {...helpAttr({ helpId })}
            type="button"
            className={cx(
                styles.dropzone,
                isTile ? styles.dropzoneTile : styles.dropzoneSlot,
                isDragOver && styles.dropzoneOver,
                className
            )}
            data-drag-over={isDragOver ? 'true' : undefined}
            disabled={disabled}
            aria-label={isTile ? title : undefined}
            onClick={() => {
                if (!disabled) onPick();
            }}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
        >
            <span
                className={styles.dropzoneIcon}
                aria-hidden="true"
            >
                {isTile ? (
                    <AddIcon
                        size="md"
                        aria-hidden="true"
                    />
                ) : (
                    <UploadIcon
                        size="lg"
                        aria-hidden="true"
                    />
                )}
            </span>
            {isTile ? null : (
                <>
                    <span className={styles.dropzoneTitle}>{title}</span>
                    {hint ? <span className={styles.dropzoneHint}>{hint}</span> : null}
                </>
            )}
        </button>
    );
}

/** Props of {@link MediaUploadStatus}. */
export interface MediaUploadStatusProps {
    /** What is happening («Optimizando imagen…», «Subiendo foto 2 de 5…»). */
    readonly label: string;
    /** Upload percentage 0-100; absent for an indeterminate step. */
    readonly progress?: number | null;
    /** Accessible name of the progress bar. */
    readonly progressLabel?: string;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
}

/**
 * The live line under the dropzone while a photo is processed or sent.
 *
 * @param props - See {@link MediaUploadStatusProps}.
 * @returns A `role="status"` block with the label and an optional `<progress>`.
 */
export function MediaUploadStatus({
    label,
    progress,
    progressLabel,
    className
}: MediaUploadStatusProps) {
    const hasProgress = typeof progress === 'number';
    return (
        <div
            role="status"
            className={cx(styles.status, className)}
        >
            <span className={styles.statusLabel}>{label}</span>
            {hasProgress ? (
                <progress
                    className={styles.progress}
                    max={100}
                    value={Math.min(Math.max(progress, 0), 100)}
                    aria-label={progressLabel ?? label}
                />
            ) : null}
        </div>
    );
}

/** Props of {@link PhotoGrid}. */
export interface PhotoGridProps {
    /** The tiles (and the add tile). */
    readonly children: ReactNode;
    /** Accessible name of the group, when the grid needs one. */
    readonly ariaLabel?: string;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The thumbnail grid: two columns on a narrow container, up to four on a wide
 * one (container query, no viewport breakpoint).
 *
 * @param props - See {@link PhotoGridProps}.
 * @returns A `<div>` grid.
 */
export function PhotoGrid({ children, ariaLabel, className, helpId }: PhotoGridProps) {
    return (
        <div className={styles.gridHost}>
            <div
                {...helpAttr({ helpId })}
                {...(ariaLabel ? { role: 'group', 'aria-label': ariaLabel } : {})}
                className={cx(styles.grid, className)}
            >
                {children}
            </div>
        </div>
    );
}

/** Props of {@link PhotoTile}. */
export interface PhotoTileProps {
    /** Thumbnail URL (already transformed by the caller). */
    readonly src: string;
    /** Alt text of the thumbnail. */
    readonly alt: string;
    /** The cover: a wider frame with no fixed column. */
    readonly featured?: boolean;
    /** Controls laid over the image corner (e.g. remove). */
    readonly actions?: ReactNode;
    /** Small overlay at the image foot (e.g. a missing-alt StatusPill). */
    readonly badge?: ReactNode;
    /** Buttons under the image (move, promote, drag handle). */
    readonly toolbar?: ReactNode;
    /** Content under the toolbar (the metadata editor). */
    readonly children?: ReactNode;
    /** The tile is being dragged. */
    readonly isDragging?: boolean;
    /** Node ref (drag-and-drop binding). */
    readonly ref?: Ref<HTMLDivElement>;
    /** Transform from the drag-and-drop library; nothing else belongs here. */
    readonly dragStyle?: CSSProperties;
    /** Sortable id exposed as `data-sortable-id`. */
    readonly sortableId?: string;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * One photo of the editor.
 *
 * @param props - See {@link PhotoTileProps}.
 * @returns A `<div>` with the framed image, its overlays, toolbar and body.
 */
export function PhotoTile({
    src,
    alt,
    featured = false,
    actions,
    badge,
    toolbar,
    children,
    isDragging = false,
    ref,
    dragStyle,
    sortableId,
    className,
    helpId
}: PhotoTileProps) {
    return (
        <div
            {...helpAttr({ helpId })}
            ref={ref}
            data-sortable-id={sortableId}
            style={dragStyle}
            className={cx(
                styles.tile,
                featured && styles.tileFeatured,
                isDragging && styles.tileDragging,
                className
            )}
        >
            <div className={styles.frame}>
                <img
                    src={src}
                    alt={alt}
                    className={styles.image}
                    loading="lazy"
                />
                {actions ? <div className={styles.actions}>{actions}</div> : null}
                {badge ? <div className={styles.badge}>{badge}</div> : null}
            </div>
            {toolbar ? <div className={styles.toolbar}>{toolbar}</div> : null}
            {children}
        </div>
    );
}
