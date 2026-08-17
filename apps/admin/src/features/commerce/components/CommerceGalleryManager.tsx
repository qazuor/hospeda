/**
 * CommerceGalleryManager
 *
 * Dedicated gallery management UI for gastronomy/experience listing photos
 * (HOS-382). Vertical-agnostic mirror of accommodations' `GalleryManager` —
 * operates on the relational `gastronomy_media` / `experience_media` tables
 * via the HOS-372 granular admin endpoints — each operation persists
 * immediately (settle-and-refetch). No accumulate-and-save, no drag-and-drop
 * reorder.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────┐
 *   │  PORTADA (featured slot)                        │
 *   │  · Empty → upload button                        │
 *   │  · Set   → thumbnail + remove (✕) button        │
 *   ├─────────────────────────────────────────────────┤
 *   │  GALERÍA grid (non-featured visible rows)       │
 *   │  · Each item: thumbnail + remove button          │
 *   │  · Add button (disabled at gallery cap)          │
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
 * Decisions carried over from the accommodation gallery precedent (SPEC-204):
 * - role:'gallery' for ALL uploads (role:'featured' would collide publicId for multiple rows)
 * - No reorder / no dnd-kit
 * - No archive/restore (the admin API exposes no such routes for either
 *   commerce vertical — see `useCommerceMedia` module docs)
 * - Replacing portada is non-destructive (upload → add → setFeatured; backend clears old)
 */

import { AddIcon, LoaderIcon, XCircleIcon } from '@repo/icons';
import { ENTITY_GALLERY_CAPS, ModerationStatusEnum } from '@repo/schemas';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { CommerceGalleryPortadaSection } from '@/features/commerce/components/CommerceGalleryPortadaSection';
import {
    type CommerceMedia,
    type CommerceMediaVertical,
    useCommerceMediaAdd,
    useCommerceMediaList,
    useCommerceMediaRemove,
    useCommerceMediaSetFeatured
} from '@/features/commerce/hooks/useCommerceMedia';
import { useMediaUpload } from '@/hooks/use-media-upload';
import { useTranslations } from '@/hooks/use-translations';
import { deriveAltFromEntityName } from '@/lib/utils/media-alt.utils';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for CommerceGalleryManager.
 */
export interface CommerceGalleryManagerProps {
    /** Which commerce vertical this gallery belongs to. */
    readonly vertical: CommerceMediaVertical;
    /** UUID of the gastronomy/experience listing whose gallery is being managed. */
    readonly entityId: string;
    /**
     * Display name of the listing, if already available to the caller (e.g.
     * from the page's own entity query). Used to derive a non-empty `alt`
     * fallback for newly-uploaded photos — see `deriveAltFromEntityName`.
     * Optional; when absent, uploads are added without `alt` (current
     * behaviour), never with an invalid one.
     */
    readonly entityName?: string;
    /**
     * Whether the entity-detail query that provides `entityName` is still
     * loading. The media list query and the entity-detail query run in
     * parallel and settle independently — a fast media response can render
     * the upload controls while `entityName` is still `undefined`, so an
     * upload started in that window is added with NO `alt` at all. Since
     * there is no update-media endpoint, that gap is permanent for the
     * photo. Passing this keeps the existing loading skeleton up until BOTH
     * queries have settled, closing the race at its source. Optional;
     * defaults to `false` so callers that don't fetch the entity separately
     * are unaffected.
     */
    readonly isEntityLoading?: boolean;
}

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
 * Full gallery management panel for a single gastronomy/experience listing.
 *
 * Splits the visible media list into:
 *   - One optional `featured` row (the "Portada" slot).
 *   - The remaining non-featured `visible` rows (the gallery grid).
 */
export function CommerceGalleryManager({
    vertical,
    entityId,
    entityName,
    isEntityLoading = false
}: CommerceGalleryManagerProps) {
    const { t, tPlural } = useTranslations();

    // ── Data ──────────────────────────────────────────────────────────────────
    const {
        data: allMedia = [],
        isLoading: isMediaLoading,
        isError
    } = useCommerceMediaList(vertical, entityId);
    // Gate on BOTH queries — see `isEntityLoading` JSDoc above for why.
    const isLoading = isMediaLoading || isEntityLoading;

    const addMutation = useCommerceMediaAdd(vertical, entityId);
    const removeMutation = useCommerceMediaRemove(vertical, entityId);
    const setFeaturedMutation = useCommerceMediaSetFeatured(vertical, entityId);

    const { uploadEntityImage } = useMediaUpload();

    // Derived once per render — undefined when no valid alt can be built
    // (missing name, or a name that can't satisfy the schema's bounds).
    const derivedAlt = deriveAltFromEntityName(entityName);

    // ── Derived state ─────────────────────────────────────────────────────────
    const featuredRow: CommerceMedia | undefined = allMedia.find((m) => m.isFeatured);
    const galleryRows: CommerceMedia[] = allMedia.filter((m) => !m.isFeatured);

    const galleryCap = ENTITY_GALLERY_CAPS[vertical];

    const anyMutationPending =
        addMutation.isPending ||
        removeMutation.isPending ||
        setFeaturedMutation.isPending ||
        uploadEntityImage.isPending;

    const atCap = galleryRows.length >= galleryCap;

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
                    entityType: vertical,
                    entityId,
                    role: 'gallery'
                });
                url = uploaded.url;
                publicId = uploaded.publicId;
            } catch {
                setUploadError(t('admin-pages.gallery.errors.uploadFailed'));
                return;
            }

            // 2. Register the URL in the relational table
            let newRow: CommerceMedia;
            try {
                newRow = await addMutation.mutateAsync({
                    url,
                    publicId,
                    moderationState: ModerationStatusEnum.APPROVED,
                    ...(derivedAlt ? { alt: derivedAlt } : {})
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
        [
            vertical,
            entityId,
            uploadEntityImage,
            addMutation,
            setFeaturedMutation,
            derivedAlt,
            t,
            clearErrors
        ]
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
                    entityType: vertical,
                    entityId,
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
                    moderationState: ModerationStatusEnum.APPROVED,
                    ...(derivedAlt ? { alt: derivedAlt } : {})
                });
            } catch {
                setAddError(t('admin-pages.gallery.errors.addFailed'));
            }
        },
        [vertical, entityId, uploadEntityImage, addMutation, derivedAlt, t, clearErrors]
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
                    <CommerceGalleryPortadaSection
                        t={t}
                        featuredRow={featuredRow}
                        anyMutationPending={anyMutationPending}
                        isUploadPending={uploadEntityImage.isPending}
                        isRemovingPortada={
                            removeMutation.isPending &&
                            removeMutation.variables?.mediaId === featuredRow?.id
                        }
                        onOpenFilePicker={portadaInput.open}
                        onFileInputChange={portadaInput.handleChange}
                        fileInputRef={portadaInput.inputRef}
                        onRemovePortada={handleRemovePortada}
                    />

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
                                {tPlural('admin-pages.gallery.grid.cap', galleryCap)}
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
                                                'admin-pages.gallery.grid.actions.remove'
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
