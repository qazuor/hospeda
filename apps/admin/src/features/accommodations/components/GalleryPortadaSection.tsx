/**
 * GalleryPortadaSection
 *
 * Portada (featured slot) block extracted from `GalleryManager` (HOS-382) to
 * keep both files under the project's 500-line-per-file limit. Purely
 * presentational: all data, mutation state, and handlers are owned by the
 * parent and forwarded as props — this component holds no state of its own
 * and duplicates no mutation logic.
 *
 * Renders either:
 *   - The empty state (upload button), when no featured row exists.
 *   - The thumbnail + replace/remove controls, when one does.
 */

import { EditIcon, LoaderIcon, UploadIcon, XCircleIcon } from '@repo/icons';
import type { AccommodationMedia } from '@repo/schemas';
import type * as React from 'react';
import { Button } from '@/components/ui/button';
import type { useTranslations } from '@/hooks/use-translations';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for GalleryPortadaSection.
 */
export interface GalleryPortadaSectionProps {
    /** Translation function from `useTranslations()`, forwarded by the parent so every i18n key stays identical. */
    readonly t: ReturnType<typeof useTranslations>['t'];
    /** The current featured media row, or `undefined` when no portada is set. */
    readonly featuredRow: AccommodationMedia | undefined;
    /** True while any gallery mutation (add/remove/setFeatured) or the upload itself is in flight — disables the portada controls. */
    readonly anyMutationPending: boolean;
    /** True while the underlying upload request is in flight — swaps the trigger icon for a spinner. */
    readonly isUploadPending: boolean;
    /** True while the active remove mutation targets THIS portada's id — swaps the remove icon for a spinner. */
    readonly isRemovingPortada: boolean;
    /** Opens the hidden file picker used to upload/replace the portada. */
    readonly onOpenFilePicker: () => void;
    /** Handles the hidden file input's change event (fires the upload flow). */
    readonly onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    /** Ref attached to the hidden file input element. */
    readonly fileInputRef: React.RefObject<HTMLInputElement | null>;
    /** Removes the current portada (soft-delete via removeMedia; no separate unfeature endpoint). */
    readonly onRemovePortada: () => void;
    /**
     * Opens the text editor for the current portada (HOS-388). Optional and
     * `undefined` when there is no portada to edit, which is also what keeps
     * the button from rendering over the empty state.
     */
    readonly onEditText?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders the "Portada" (featured slot) section of the accommodation
 * gallery manager. See module docs for the empty-state vs. populated-state
 * split.
 */
export function GalleryPortadaSection({
    t,
    featuredRow,
    anyMutationPending,
    isUploadPending,
    isRemovingPortada,
    onOpenFilePicker,
    onFileInputChange,
    fileInputRef,
    onRemovePortada,
    onEditText
}: GalleryPortadaSectionProps) {
    return (
        <section aria-label={t('admin-pages.gallery.portada.title')}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="font-semibold text-base">
                        {t('admin-pages.gallery.portada.title')}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {t('admin-pages.gallery.portada.description')}
                    </p>
                </div>

                {featuredRow && onEditText && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onEditText}
                        disabled={anyMutationPending}
                        className="gap-1.5"
                    >
                        <EditIcon className="h-4 w-4" />
                        {t('admin-pages.gallery.photoText.actions.edit')}
                    </Button>
                )}

                {featuredRow && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onOpenFilePicker}
                        disabled={anyMutationPending}
                        className="gap-1.5"
                    >
                        {anyMutationPending && isUploadPending ? (
                            <LoaderIcon className="h-4 w-4 animate-spin" />
                        ) : (
                            <UploadIcon className="h-4 w-4" />
                        )}
                        {t('admin-pages.gallery.portada.actions.replace')}
                    </Button>
                )}
            </div>

            {featuredRow ? (
                <div className="relative inline-block">
                    <img
                        src={featuredRow.url}
                        // HOS-389 §5: the last resort used to be a hardcoded
                        // Spanish word — a screen-reader-visible string that
                        // bypassed @repo/i18n entirely, so an operator running the
                        // admin in English heard Spanish. It is only ever reached
                        // when the row carries neither `alt` nor `caption`, which
                        // is exactly the case nobody clicks through while testing.
                        alt={
                            featuredRow.alt ??
                            featuredRow.caption ??
                            t('admin-pages.gallery.portada.altFallback')
                        }
                        className="h-48 w-full max-w-sm rounded-lg border object-cover"
                    />
                    <button
                        type="button"
                        onClick={onRemovePortada}
                        disabled={anyMutationPending}
                        aria-label={t('admin-pages.gallery.portada.actions.remove')}
                        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                        {isRemovingPortada ? (
                            <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <XCircleIcon className="h-3.5 w-3.5" />
                        )}
                    </button>
                </div>
            ) : (
                <div className="flex h-48 max-w-sm items-center justify-center rounded-lg border border-dashed">
                    <div className="text-center">
                        <p className="mb-3 text-muted-foreground text-sm">
                            {t('admin-pages.gallery.portada.empty')}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onOpenFilePicker}
                            disabled={anyMutationPending}
                            className="gap-1.5"
                        >
                            {anyMutationPending && isUploadPending ? (
                                <LoaderIcon className="h-4 w-4 animate-spin" />
                            ) : (
                                <UploadIcon className="h-4 w-4" />
                            )}
                            {t('admin-pages.gallery.portada.actions.upload')}
                        </Button>
                    </div>
                </div>
            )}

            {/* Hidden file input for portada */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onFileInputChange}
                tabIndex={-1}
            />
        </section>
    );
}
