/**
 * GalleryManager
 *
 * Dedicated gallery management UI for accommodation photos.
 * Operates on the relational `accommodation_media` table via the SPEC-204
 * granular endpoints — each operation persists immediately (settle-and-refetch).
 * No accumulate-and-save, no drag-and-drop reorder.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────┐
 *   │  PORTADA (featured slot)                        │
 *   │  · Empty → upload button                        │
 *   │  · Set   → thumbnail + remove (✕) button        │
 *   ├─────────────────────────────────────────────────┤
 *   │  GALERÍA grid (non-featured visible rows)       │
 *   │  · Each item: thumbnail + remove button         │
 *   │  · Add button (disabled at gallery cap)         │
 *   └─────────────────────────────────────────────────┘
 *
 * Upload flow (portada):
 *   uploadEntityImage({ role:'gallery' }) → addMedia({ url, publicId }) → setFeatured({ mediaId })
 *
 * Upload flow (gallery item):
 *   uploadEntityImage({ role:'gallery' }) → addMedia({ url, publicId })
 *
 * Remove portada = removeMedia (the endpoint soft-deletes; no separate unfeature endpoint).
 *
 * SPEC-204 locked decisions honoured:
 * - role:'gallery' for ALL uploads (role:'featured' would collide publicId for multiple rows)
 * - No reorder / no dnd-kit
 * - Replacing portada is non-destructive (upload → add → setFeatured; backend clears old)
 */

import { Button } from '@/components/ui/button';
import {
    useAccommodationMediaAdd,
    useAccommodationMediaList,
    useAccommodationMediaRemove,
    useAccommodationMediaSetFeatured
} from '@/features/accommodations/hooks/useAccommodationMedia';
import { useMediaUpload } from '@/hooks/use-media-upload';
import { useTranslations } from '@/hooks/use-translations';
import { AddIcon, LoaderIcon, UploadIcon, XCircleIcon } from '@repo/icons';
import { ENTITY_GALLERY_CAPS, ModerationStatusEnum } from '@repo/schemas';
import type { AccommodationMedia } from '@repo/schemas';
import * as React from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for GalleryManager.
 */
export interface GalleryManagerProps {
    /** UUID of the accommodation whose gallery is being managed. */
    readonly accommodationId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GALLERY_CAP = ENTITY_GALLERY_CAPS.accommodation;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Hidden file-input trigger. Opens the OS file picker and calls `onFile` with
 * the selected File.
 */
function useFileInput(onFile: (file: File) => void) {
    const inputRef = React.useRef<HTMLInputElement>(null);

    const open = React.useCallback(() => {
        inputRef.current?.click();
    }, []);

    const handleChange = React.useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                onFile(file);
                // Reset so the same file can be re-selected after a failed upload
                e.target.value = '';
            }
        },
        [onFile]
    );

    return { inputRef, open, handleChange };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Full gallery management panel for a single accommodation.
 *
 * Splits the visible media list into:
 *   - One optional `featured` row (the "Portada" slot).
 *   - The remaining non-featured `visible` rows (the gallery grid).
 */
export function GalleryManager({ accommodationId }: GalleryManagerProps) {
    const { t } = useTranslations();

    // ── Data ──────────────────────────────────────────────────────────────────
    const { data: allMedia = [], isLoading, isError } = useAccommodationMediaList(accommodationId);

    const addMutation = useAccommodationMediaAdd(accommodationId);
    const removeMutation = useAccommodationMediaRemove(accommodationId);
    const setFeaturedMutation = useAccommodationMediaSetFeatured(accommodationId);

    const { uploadEntityImage } = useMediaUpload();

    // ── Derived state ─────────────────────────────────────────────────────────
    const featuredRow: AccommodationMedia | undefined = allMedia.find((m) => m.isFeatured);
    const galleryRows: AccommodationMedia[] = allMedia.filter((m) => !m.isFeatured);

    const anyMutationPending =
        addMutation.isPending ||
        removeMutation.isPending ||
        setFeaturedMutation.isPending ||
        uploadEntityImage.isPending;

    const atCap = galleryRows.length >= GALLERY_CAP;

    // ── Error state (per-operation) ───────────────────────────────────────────
    const [addError, setAddError] = React.useState<string | null>(null);
    const [removeError, setRemoveError] = React.useState<string | null>(null);
    const [setFeaturedError, setSetFeaturedError] = React.useState<string | null>(null);
    const [uploadError, setUploadError] = React.useState<string | null>(null);

    const clearErrors = React.useCallback(() => {
        setAddError(null);
        setRemoveError(null);
        setSetFeaturedError(null);
        setUploadError(null);
    }, []);

    // ── Portada upload handler ────────────────────────────────────────────────

    const handlePortadaFile = React.useCallback(
        async (file: File) => {
            clearErrors();

            // 1. Upload to Cloudinary (role:'gallery' — NOT 'featured' to avoid publicId collision)
            let url: string;
            let publicId: string;
            try {
                const uploaded = await uploadEntityImage.mutateAsync({
                    file,
                    entityType: 'accommodation',
                    entityId: accommodationId,
                    role: 'gallery'
                });
                url = uploaded.url;
                publicId = uploaded.publicId;
            } catch {
                setUploadError(t('admin-pages.gallery.errors.uploadFailed'));
                return;
            }

            // 2. Register the URL in the relational table
            let newRow: AccommodationMedia;
            try {
                newRow = await addMutation.mutateAsync({
                    url,
                    publicId,
                    moderationState: ModerationStatusEnum.APPROVED
                });
            } catch {
                setAddError(t('admin-pages.gallery.errors.addFailed'));
                return;
            }

            // 3. Promote the new row to featured
            try {
                await setFeaturedMutation.mutateAsync({ mediaId: newRow.id });
            } catch {
                setSetFeaturedError(t('admin-pages.gallery.errors.setFeaturedFailed'));
            }
        },
        [accommodationId, uploadEntityImage, addMutation, setFeaturedMutation, t, clearErrors]
    );

    const portadaInput = useFileInput(handlePortadaFile);

    // ── Remove portada ────────────────────────────────────────────────────────

    const handleRemovePortada = React.useCallback(async () => {
        if (!featuredRow) return;
        clearErrors();
        try {
            await removeMutation.mutateAsync({ mediaId: featuredRow.id });
        } catch {
            setRemoveError(t('admin-pages.gallery.errors.removeFailed'));
        }
    }, [featuredRow, removeMutation, t, clearErrors]);

    // ── Gallery add handler ───────────────────────────────────────────────────

    const handleGalleryFile = React.useCallback(
        async (file: File) => {
            clearErrors();

            let url: string;
            let publicId: string;
            try {
                const uploaded = await uploadEntityImage.mutateAsync({
                    file,
                    entityType: 'accommodation',
                    entityId: accommodationId,
                    role: 'gallery'
                });
                url = uploaded.url;
                publicId = uploaded.publicId;
            } catch {
                setUploadError(t('admin-pages.gallery.errors.uploadFailed'));
                return;
            }

            try {
                await addMutation.mutateAsync({
                    url,
                    publicId,
                    moderationState: ModerationStatusEnum.APPROVED
                });
            } catch {
                setAddError(t('admin-pages.gallery.errors.addFailed'));
            }
        },
        [accommodationId, uploadEntityImage, addMutation, t, clearErrors]
    );

    const galleryInput = useFileInput(handleGalleryFile);

    // ── Remove gallery item ───────────────────────────────────────────────────

    const handleRemoveGalleryItem = React.useCallback(
        async (mediaId: string) => {
            clearErrors();
            try {
                await removeMutation.mutateAsync({ mediaId });
            } catch {
                setRemoveError(t('admin-pages.gallery.errors.removeFailed'));
            }
        },
        [removeMutation, t, clearErrors]
    );

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-8">
            {/* Loading skeleton */}
            {isLoading && (
                <div className="space-y-4">
                    <div className="h-48 animate-pulse rounded-lg border bg-muted" />
                    <div className="grid grid-cols-3 gap-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                                key={i}
                                className="aspect-square animate-pulse rounded-lg border bg-muted"
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Load error */}
            {isError && !isLoading && (
                <div
                    role="alert"
                    className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
                >
                    <p className="text-destructive text-sm">
                        {t('admin-pages.gallery.errors.loadFailed')}
                    </p>
                </div>
            )}

            {/* Global operation errors */}
            {(uploadError || addError || removeError || setFeaturedError) && (
                <div
                    role="alert"
                    className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
                >
                    <p className="text-destructive text-sm">
                        {uploadError ?? addError ?? removeError ?? setFeaturedError}
                    </p>
                </div>
            )}

            {!isLoading && !isError && (
                <>
                    {/* ── Portada slot ─────────────────────────────────────── */}
                    <section aria-label={t('admin-pages.gallery.portada.title')}>
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <h2 className="font-semibold text-base">
                                    {t('admin-pages.gallery.portada.title')}
                                </h2>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.gallery.portada.description')}
                                </p>
                            </div>

                            {featuredRow && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={portadaInput.open}
                                    disabled={anyMutationPending}
                                    className="gap-1.5"
                                >
                                    {anyMutationPending && uploadEntityImage.isPending ? (
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
                                    alt={featuredRow.alt ?? featuredRow.caption ?? 'Portada'}
                                    className="h-48 w-full max-w-sm rounded-lg border object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={handleRemovePortada}
                                    disabled={anyMutationPending}
                                    aria-label={t('admin-pages.gallery.portada.actions.remove')}
                                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow transition-opacity hover:opacity-90 disabled:opacity-50"
                                >
                                    {removeMutation.isPending &&
                                    removeMutation.variables?.mediaId === featuredRow.id ? (
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
                                        onClick={portadaInput.open}
                                        disabled={anyMutationPending}
                                        className="gap-1.5"
                                    >
                                        {anyMutationPending && uploadEntityImage.isPending ? (
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
                            ref={portadaInput.inputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={portadaInput.handleChange}
                            tabIndex={-1}
                        />
                    </section>

                    {/* ── Gallery grid ─────────────────────────────────────── */}
                    <section aria-label={t('admin-pages.gallery.grid.title')}>
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="font-semibold text-base">
                                {t('admin-pages.gallery.grid.title')}
                            </h2>

                            {!atCap && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={galleryInput.open}
                                    disabled={anyMutationPending}
                                    className="gap-1.5"
                                >
                                    {anyMutationPending && uploadEntityImage.isPending ? (
                                        <LoaderIcon className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <AddIcon className="h-4 w-4" />
                                    )}
                                    {t('admin-pages.gallery.grid.actions.add')}
                                </Button>
                            )}
                        </div>

                        {atCap && (
                            <p
                                role="alert"
                                className="mb-3 text-amber-700 text-sm"
                            >
                                {t('admin-pages.gallery.grid.cap').replace(
                                    '{{count}}',
                                    String(GALLERY_CAP)
                                )}
                            </p>
                        )}

                        {galleryRows.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-8 text-center">
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.gallery.grid.empty')}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                                {galleryRows.map((item) => (
                                    <div
                                        key={item.id}
                                        className="group relative aspect-square"
                                    >
                                        <img
                                            src={item.url}
                                            alt={item.alt ?? item.caption ?? ''}
                                            className="h-full w-full rounded-lg border object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveGalleryItem(item.id)}
                                            disabled={anyMutationPending}
                                            aria-label={t(
                                                'admin-pages.gallery.portada.actions.remove'
                                            )}
                                            className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow transition-opacity focus:opacity-100 disabled:opacity-50 group-hover:opacity-100"
                                        >
                                            {removeMutation.isPending &&
                                            removeMutation.variables?.mediaId === item.id ? (
                                                <LoaderIcon className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <XCircleIcon className="h-3 w-3" />
                                            )}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Hidden file input for gallery */}
                        <input
                            ref={galleryInput.inputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={galleryInput.handleChange}
                            tabIndex={-1}
                        />
                    </section>
                </>
            )}
        </div>
    );
}
