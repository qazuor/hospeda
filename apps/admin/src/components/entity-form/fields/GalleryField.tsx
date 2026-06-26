import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { ImageSearchModal } from '@/components/entity-form/fields';
import type {
    FieldConfig,
    GalleryFieldConfig
} from '@/components/entity-form/types/field-config.types';
import { Input, Label } from '@/components/ui-wrapped';
import { useTranslations } from '@/hooks/use-translations';
import { DEFAULT_GALLERY_FALLBACK_MAX_SIZE_BYTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    type UniqueIdentifier,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import type { Announcements, ScreenReaderInstructions } from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    rectSortingStrategy,
    sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { AddIcon, ImageIcon, UploadIcon } from '@repo/icons';
import { ModerationStatusEnum } from '@repo/schemas';
import * as React from 'react';
import { SortableGalleryItem } from './SortableGalleryItem';
import { UploadProgressIndicator } from './UploadProgressIndicator';
import type { GalleryImage } from './gallery-types';
import { useGalleryUploads } from './use-gallery-uploads';

export type { GalleryImage };

/**
 * Props for GalleryField component
 */
export interface GalleryFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: GalleryImage[];
    /** Change handler */
    onChange?: (value: GalleryImage[]) => void;
    /** Blur handler */
    onBlur?: () => void;
    /** Focus handler */
    onFocus?: () => void;
    /** Whether the field has an error */
    hasError?: boolean;
    /** Error message to display */
    errorMessage?: string;
    /** Whether the field is disabled */
    disabled?: boolean;
    /** Whether the field is required */
    required?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Upload handler - should return the uploaded image URL */
    onUpload?: (file: File) => Promise<string>;
    /**
     * Delete handler - called with the Cloudinary publicId before removing the image.
     * Only called for Cloudinary URLs; non-Cloudinary images are silently removed.
     * Upload errors are swallowed — the image is still removed from the UI.
     */
    onDelete?: (publicId: string) => Promise<void>;
    /**
     * Maximum file size in bytes. Defaults to 10 MB (10 * 1024 * 1024).
     * This value is only used when typeConfig does not specify maxSize.
     */
    defaultMaxSize?: number;
    /** Enable stock image search - requires entityType and entityId */
    enableStockSearch?: boolean;
    /** Entity type for stock image import */
    entityType?: 'accommodation' | 'destination' | 'event' | 'post';
    /** Entity UUID for stock image import */
    entityId?: string;
}

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
};

/**
 * GalleryField component for multiple image upload and management.
 * Handles GALLERY field type from FieldConfig.
 *
 * Accessibility:
 * - Drag-and-drop reorder uses @dnd-kit with pointer + keyboard sensors.
 * - Keyboard: Tab to drag handle, Space to pick up, Arrow keys to move,
 *   Space/Enter to drop, Escape to cancel.
 * - Announcements are emitted via dnd-kit for screen readers (localized).
 * - Respects prefers-reduced-motion by disabling drag transitions.
 *
 * - Supports HEIC, AVIF, JPEG, PNG, and WebP out of the box.
 * - Shows per-image upload progress via an overlay spinner.
 * - Displays upload/delete errors inline below the field.
 * - Calls onDelete with the Cloudinary publicId before removing an image.
 *   For non-Cloudinary URLs the image is removed without an API call.
 */
export const GalleryField = React.forwardRef<HTMLInputElement, GalleryFieldProps>(
    (
        {
            config,
            value = [],
            onChange,
            hasError = false,
            errorMessage,
            disabled = false,
            required = false,
            className,
            onUpload,
            onDelete,
            defaultMaxSize = DEFAULT_GALLERY_FALLBACK_MAX_SIZE_BYTES,
            enableStockSearch = false,
            entityType,
            entityId
        },
        _ref
    ) => {
        const { t } = useTranslations();
        const [isStockModalOpen, setIsStockModalOpen] = React.useState(false);

        const label = config.label;
        const description = config.description;
        const helper = config.help;

        const galleryConfig =
            config.type === FieldTypeEnum.GALLERY
                ? (config.typeConfig as GalleryFieldConfig)
                : undefined;

        const fieldId = `field-${config.id}`;
        const errorId = hasError ? `${fieldId}-error` : undefined;
        const descriptionId = description ? `${fieldId}-description` : undefined;
        const helperId = helper ? `${fieldId}-helper` : undefined;

        const maxImages = galleryConfig?.maxImages || 10;
        const maxSize = galleryConfig?.maxSize || defaultMaxSize;
        const allowedTypes = galleryConfig?.allowedTypes || [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/heic',
            'image/heif',
            'image/avif'
        ];
        const maxWidth = galleryConfig?.maxWidth;
        const maxHeight = galleryConfig?.maxHeight;
        const sortable = galleryConfig?.sortable !== false;

        const fileInputRef = React.useRef<HTMLInputElement>(null);
        const [dragOver, setDragOver] = React.useState(false);

        // Detect prefers-reduced-motion (SSR-safe).
        const [reducedMotion, setReducedMotion] = React.useState(false);
        React.useEffect(() => {
            if (typeof window === 'undefined' || !window.matchMedia) return;
            const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
            const apply = () => setReducedMotion(mq.matches);
            apply();
            mq.addEventListener('change', apply);
            return () => mq.removeEventListener('change', apply);
        }, []);

        // Backfill the frontend-only `id`/`order` fields for items loaded from
        // the API. Stored gallery items (media.gallery) only carry
        // url/caption/description/moderationState; `id` (React key + dnd-kit
        // identifier + the key remove/update look up) and `order` (sort key) are
        // frontend-only. Without this, API-loaded items have `id === undefined`,
        // which breaks reorder/remove/update and triggers duplicate React keys.
        // The url is a stable natural identifier, so derive the id from it when
        // absent; new uploads already carry their own id.
        const normalizedValue = React.useMemo<GalleryImage[]>(
            () =>
                value.map((img, index) => ({
                    ...img,
                    id: img.id || img.url,
                    order: img.order ?? index
                })),
            [value]
        );

        const canAddMore = normalizedValue.length < maxImages;

        const {
            isUploading,
            uploadingIds,
            deletingIds,
            uploadError,
            progress,
            handleFilesSelect,
            handleRemoveImage,
            handleUpdateImage
        } = useGalleryUploads({
            value: normalizedValue,
            onChange,
            maxImages,
            maxSize,
            allowedTypes,
            onUpload,
            onDelete,
            formatFileSize
        });

        const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files;
            if (files) {
                handleFilesSelect(files);
            }
        };

        const handleDrop = (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            const files = e.dataTransfer.files;
            if (files) {
                handleFilesSelect(files);
            }
        };

        const handleDragOver = (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(true);
        };

        const handleDragLeave = (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
        };

        // Sorted view used both for rendering and SortableContext items.
        const sortedImages = React.useMemo(
            () => [...normalizedValue].sort((a, b) => a.order - b.order),
            [normalizedValue]
        );
        const itemIds = React.useMemo<UniqueIdentifier[]>(
            () => sortedImages.map((img) => img.id),
            [sortedImages]
        );

        // dnd-kit sensors: pointer + keyboard (with sortable coordinates getter).
        const sensors = useSensors(
            useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
            useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
        );

        const handleDragEnd = (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;

            const oldIndex = sortedImages.findIndex((img) => img.id === active.id);
            const newIndex = sortedImages.findIndex((img) => img.id === over.id);
            if (oldIndex === -1 || newIndex === -1) return;

            const reordered = arrayMove(sortedImages, oldIndex, newIndex).map((img, idx) => ({
                ...img,
                order: idx
            }));
            onChange?.(reordered);
        };

        const handleStockImageImported = (result: {
            url: string;
            publicId: string;
            width: number;
            height: number;
            attribution: {
                photographer: string;
                sourceUrl: string;
                license: string;
                provider: 'unsplash' | 'pexels';
            };
            moderationState: 'APPROVED';
        }) => {
            const newImage: GalleryImage = {
                id: result.publicId,
                url: result.url,
                caption: '',
                description: '',
                alt: result.attribution.photographer,
                moderationState: ModerationStatusEnum.APPROVED,
                order: value.length,
                attribution: result.attribution
            };
            onChange?.([...value, newImage]);
        };

        // Localized announcements for screen readers (dnd-kit Announcements API).
        const announcements: Announcements = React.useMemo(
            () => ({
                onDragStart({ active }) {
                    const pos = sortedImages.findIndex((img) => img.id === active.id) + 1;
                    return t('admin-entities.fields.gallery.dnd.onDragStart', {
                        position: String(pos)
                    });
                },
                onDragOver({ active, over }) {
                    if (!over) return undefined;
                    const activePos = sortedImages.findIndex((img) => img.id === active.id) + 1;
                    const overPos = sortedImages.findIndex((img) => img.id === over.id) + 1;
                    return t('admin-entities.fields.gallery.dnd.onDragOver', {
                        from: String(activePos),
                        to: String(overPos)
                    });
                },
                onDragEnd({ active, over }) {
                    if (!over) {
                        return t('admin-entities.fields.gallery.dnd.onDragCancel', {
                            position: String(
                                sortedImages.findIndex((img) => img.id === active.id) + 1
                            )
                        });
                    }
                    const newPos = sortedImages.findIndex((img) => img.id === over.id) + 1;
                    return t('admin-entities.fields.gallery.dnd.onDragEnd', {
                        position: String(newPos)
                    });
                },
                onDragCancel({ active }) {
                    const pos = sortedImages.findIndex((img) => img.id === active.id) + 1;
                    return t('admin-entities.fields.gallery.dnd.onDragCancel', {
                        position: String(pos)
                    });
                }
            }),
            [sortedImages, t]
        );

        const screenReaderInstructions: ScreenReaderInstructions = React.useMemo(
            () => ({
                draggable: t('admin-entities.fields.gallery.dnd.instructions')
            }),
            [t]
        );

        return (
            <div className={cn('space-y-4', className)}>
                {label && (
                    <Label
                        htmlFor={fieldId}
                        className={cn(
                            required && 'after:ml-0.5 after:text-destructive after:content-["*"]'
                        )}
                    >
                        {label}
                    </Label>
                )}

                {description && (
                    <p
                        id={descriptionId}
                        className="text-muted-foreground text-sm"
                    >
                        {description}
                    </p>
                )}

                {normalizedValue.length > 0 && (
                    <DndContext
                        sensors={sensors}
                        onDragEnd={handleDragEnd}
                        accessibility={{ announcements, screenReaderInstructions }}
                    >
                        <SortableContext
                            items={itemIds}
                            strategy={rectSortingStrategy}
                        >
                            <ul
                                data-testid="gallery-list"
                                className="grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-3 lg:grid-cols-4"
                            >
                                {sortedImages.map((image, index) => {
                                    const isBusy =
                                        uploadingIds.has(image.id) || deletingIds.has(image.id);
                                    return (
                                        <li
                                            key={image.id}
                                            data-testid={`gallery-item-${index}`}
                                        >
                                            <SortableGalleryItem
                                                image={image}
                                                index={index}
                                                sortable={sortable}
                                                disabled={disabled}
                                                isBusy={isBusy}
                                                reducedMotion={reducedMotion}
                                                maxWidth={maxWidth}
                                                maxHeight={maxHeight}
                                                imageAltFallback={t(
                                                    'admin-entities.fields.gallery.imageAlt',
                                                    { index: String(index + 1) }
                                                )}
                                                captionLabel={t(
                                                    'admin-entities.fields.image.captionLabel'
                                                )}
                                                captionPlaceholder={t(
                                                    'admin-entities.fields.gallery.captionPlaceholder'
                                                )}
                                                altLabel={t(
                                                    'admin-entities.fields.image.altTextLabel'
                                                )}
                                                altPlaceholder={t(
                                                    'admin-entities.fields.gallery.altTextPlaceholder'
                                                )}
                                                descriptionLabel={t(
                                                    'admin-entities.fields.image.descriptionLabel'
                                                )}
                                                descriptionPlaceholder={t(
                                                    'admin-entities.fields.gallery.descriptionPlaceholder'
                                                )}
                                                altRequiredHint={t(
                                                    'admin-entities.fields.gallery.altTextRequiredHint'
                                                )}
                                                dragHandleLabel={t(
                                                    'admin-entities.fields.gallery.dnd.dragHandleLabel'
                                                )}
                                                deleteLabel={t(
                                                    'admin-entities.fields.gallery.deleteLabel'
                                                )}
                                                lightboxLabel={t(
                                                    'admin-entities.fields.image.lightboxOpenLabel'
                                                )}
                                                onRemove={handleRemoveImage}
                                                onUpdate={handleUpdateImage}
                                            />
                                        </li>
                                    );
                                })}
                            </ul>
                        </SortableContext>
                    </DndContext>
                )}

                {isUploading && progress && (
                    <UploadProgressIndicator
                        label={t('admin-entities.fields.gallery.uploadingProgress', {
                            size: formatFileSize(progress.totalBytes)
                        })}
                        detail={t('admin-entities.fields.gallery.uploadingProgressCount', {
                            current: String(progress.completed),
                            total: String(progress.total),
                            size: formatFileSize(progress.totalBytes)
                        })}
                        data-testid="gallery-upload-progress"
                    />
                )}

                {canAddMore && (
                    <button
                        type="button"
                        className={cn(
                            'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                            dragOver && 'border-primary bg-primary/5',
                            hasError && 'border-destructive',
                            disabled && 'cursor-not-allowed opacity-50',
                            !disabled && 'cursor-pointer hover:border-primary/50'
                        )}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => !disabled && fileInputRef.current?.click()}
                        disabled={disabled || isUploading}
                        aria-label={t('admin-entities.fields.gallery.uploadAriaLabel')}
                    >
                        {isUploading ? (
                            <p className="text-muted-foreground text-sm">
                                {t('admin-entities.fields.gallery.uploading')}
                            </p>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                <div className="space-y-1">
                                    <p className="font-medium text-sm">
                                        <AddIcon className="mr-1 inline h-4 w-4" />
                                        {t('admin-entities.fields.gallery.addImages', {
                                            current: String(normalizedValue.length),
                                            max: String(maxImages)
                                        })}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        {t('admin-entities.fields.gallery.fileConstraints', {
                                            types: allowedTypes.join(', '),
                                            maxSize: formatFileSize(maxSize)
                                        })}
                                    </p>
                                </div>
                                <span className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 font-medium text-xs ring-offset-background hover:bg-accent hover:text-accent-foreground">
                                    <UploadIcon className="h-4 w-4" />
                                    {t('admin-entities.fields.gallery.selectButton')}
                                </span>
                                {enableStockSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setIsStockModalOpen(true)}
                                        className="mt-2 inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 font-medium text-xs ring-offset-background hover:bg-accent hover:text-accent-foreground"
                                    >
                                        <ImageIcon className="h-4 w-4" />
                                        {t('admin-entities.fields.image.stock.importButton')}
                                    </button>
                                )}
                            </div>
                        )}
                    </button>
                )}

                <Input
                    ref={fileInputRef}
                    type="file"
                    accept={allowedTypes.join(',')}
                    multiple
                    onChange={handleFileInputChange}
                    className="hidden"
                    disabled={disabled}
                    aria-describedby={cn(errorId, descriptionId, helperId).trim() || undefined}
                />

                {uploadError && (
                    <p
                        role="alert"
                        className="text-destructive text-sm"
                    >
                        {uploadError}
                    </p>
                )}

                {helper && !hasError && (
                    <p
                        id={helperId}
                        className="text-muted-foreground text-sm"
                    >
                        {helper}
                    </p>
                )}

                {hasError && errorMessage && (
                    <p
                        id={errorId}
                        className="text-destructive text-sm"
                    >
                        {errorMessage}
                    </p>
                )}

                {/* Stock image search modal */}
                {enableStockSearch && entityType && entityId && (
                    <ImageSearchModal
                        open={isStockModalOpen}
                        onOpenChange={setIsStockModalOpen}
                        onImageImported={handleStockImageImported}
                        entityType={entityType}
                        entityId={entityId}
                        targetRole="gallery"
                    />
                )}
            </div>
        );
    }
);

GalleryField.displayName = 'GalleryField';
