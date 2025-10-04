import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    FieldConfig,
    GalleryFieldConfig
} from '@/components/entity-form/types/field-config.types';
import { Button, Input, Label } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';

import { GripVertical, ImageIcon, Plus, Trash2, Upload } from 'lucide-react';
import * as React from 'react';

/**
 * Gallery image type
 */
export interface GalleryImage {
    id: string;
    url: string;
    caption?: string;
    description?: string;
    alt?: string;
    order: number;
}

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
}

/**
 * GalleryField component for multiple image upload and management
 * Handles GALLERY field type from FieldConfig
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
            onUpload
        },
        _ref
    ) => {
        // Use direct translations from config
        const label = config.label;
        const description = config.description;
        const helper = config.help;

        // Get gallery specific config
        const galleryConfig =
            config.type === FieldTypeEnum.GALLERY
                ? (config.typeConfig as GalleryFieldConfig)
                : undefined;

        const fieldId = `field-${config.id}`;
        const errorId = hasError ? `${fieldId}-error` : undefined;
        const descriptionId = description ? `${fieldId}-description` : undefined;
        const helperId = helper ? `${fieldId}-helper` : undefined;

        const maxImages = galleryConfig?.maxImages || 10;
        const maxSize = galleryConfig?.maxSize || 5 * 1024 * 1024; // 5MB default
        const allowedTypes = galleryConfig?.allowedTypes || [
            'image/jpeg',
            'image/png',
            'image/webp'
        ];
        const maxWidth = galleryConfig?.maxWidth;
        const maxHeight = galleryConfig?.maxHeight;
        const sortable = galleryConfig?.sortable !== false;

        // File input ref
        const fileInputRef = React.useRef<HTMLInputElement>(null);

        // State
        const [isUploading, setIsUploading] = React.useState(false);
        const [dragOver, setDragOver] = React.useState(false);
        const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

        const canAddMore = value.length < maxImages;

        const generateId = () => `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const handleFilesSelect = async (files: FileList) => {
            if (!files.length) return;

            const filesToProcess = Array.from(files).slice(0, maxImages - value.length);

            setIsUploading(true);

            try {
                const newImages: GalleryImage[] = [];

                for (const file of filesToProcess) {
                    // Validate file type
                    if (!allowedTypes.includes(file.type)) {
                        console.error('Invalid file type:', file.name);
                        continue;
                    }

                    // Validate file size
                    if (file.size > maxSize) {
                        console.error('File too large:', file.name);
                        continue;
                    }

                    let imageUrl: string;

                    if (onUpload) {
                        // Use custom upload handler
                        imageUrl = await onUpload(file);
                    } else {
                        // Create local URL (for preview/development)
                        imageUrl = URL.createObjectURL(file);
                    }

                    // Create gallery image
                    const galleryImage: GalleryImage = {
                        id: generateId(),
                        url: imageUrl,
                        alt: file.name,
                        order: value.length + newImages.length
                    };

                    newImages.push(galleryImage);
                }

                onChange?.([...value, ...newImages]);
            } catch (error) {
                console.error('Upload failed:', error);
                // TODO [fb28368b-af46-45ee-924f-19bef2a7506a]: Show error toast
            } finally {
                setIsUploading(false);
            }
        };

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

        const handleRemoveImage = (imageId: string) => {
            const updatedImages = value.filter((img) => img.id !== imageId);
            // Reorder remaining images
            const reorderedImages = updatedImages.map((img, index) => ({
                ...img,
                order: index
            }));
            onChange?.(reorderedImages);
        };

        const handleUpdateImage = (imageId: string, updates: Partial<GalleryImage>) => {
            const updatedImages = value.map((img) =>
                img.id === imageId ? { ...img, ...updates } : img
            );
            onChange?.(updatedImages);
        };

        // Drag and drop for reordering
        const handleDragStart = (e: React.DragEvent, index: number) => {
            if (!sortable) return;
            setDraggedIndex(index);
            e.dataTransfer.effectAllowed = 'move';
        };

        const handleDragEnd = () => {
            setDraggedIndex(null);
        };

        const handleDragOverItem = (e: React.DragEvent, index: number) => {
            if (!sortable || draggedIndex === null) return;
            e.preventDefault();

            if (draggedIndex !== index) {
                const newImages = [...value];
                const draggedItem = newImages[draggedIndex];
                newImages.splice(draggedIndex, 1);
                newImages.splice(index, 0, draggedItem);

                // Update order
                const reorderedImages = newImages.map((img, idx) => ({
                    ...img,
                    order: idx
                }));

                onChange?.(reorderedImages);
                setDraggedIndex(index);
            }
        };

        const formatFileSize = (bytes: number): string => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
        };

        return (
            <div className={cn('space-y-4', className)}>
                {/* Label */}
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

                {/* Description */}
                {description && (
                    <p
                        id={descriptionId}
                        className="text-muted-foreground text-sm"
                    >
                        {description}
                    </p>
                )}

                {/* Gallery Grid */}
                {value.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                        {value
                            .sort((a, b) => a.order - b.order)
                            .map((image, index) => (
                                <div
                                    key={image.id}
                                    className={cn(
                                        'group relative overflow-hidden rounded-lg border',
                                        sortable && 'cursor-move'
                                    )}
                                    draggable={sortable && !disabled}
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOverItem(e, index)}
                                >
                                    {/* Image */}
                                    <img
                                        src={image.url}
                                        alt={image.alt || `Gallery image ${index + 1}`}
                                        className={cn(
                                            'h-32 w-full object-cover',
                                            maxWidth && `max-w-[${maxWidth}px]`,
                                            maxHeight && `max-h-[${maxHeight}px]`
                                        )}
                                    />

                                    {/* Overlay Controls */}
                                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                                        {sortable && (
                                            <div className="absolute top-2 left-2">
                                                <GripVertical className="h-4 w-4 text-white" />
                                            </div>
                                        )}

                                        {!disabled && (
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleRemoveImage(image.id)}
                                                className="absolute top-2 right-2"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>

                                    {/* Image Metadata */}
                                    <div className="space-y-1 p-2">
                                        <Input
                                            value={image.caption || ''}
                                            onChange={(e) =>
                                                handleUpdateImage(image.id, {
                                                    caption: e.target.value
                                                })
                                            }
                                            placeholder="Caption"
                                            disabled={disabled}
                                            className="h-7 text-xs"
                                        />
                                        <Input
                                            value={image.alt || ''}
                                            onChange={(e) =>
                                                handleUpdateImage(image.id, { alt: e.target.value })
                                            }
                                            placeholder="Alt text"
                                            disabled={disabled}
                                            className="h-7 text-xs"
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                )}

                {/* Upload Area */}
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
                        disabled={disabled}
                        aria-label="Upload images"
                    >
                        {isUploading ? (
                            <div className="flex flex-col items-center gap-2">
                                <div className="h-6 w-6 animate-spin rounded-full border-primary border-b-2" />
                                <p className="text-muted-foreground text-sm">Uploading...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                <div className="space-y-1">
                                    <p className="font-medium text-sm">
                                        <Plus className="mr-1 inline h-4 w-4" />
                                        Add images ({value.length}/{maxImages})
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        {allowedTypes.join(', ')} up to {formatFileSize(maxSize)}{' '}
                                        each
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={disabled}
                                >
                                    <Upload className="mr-2 h-4 w-4" />
                                    Select Images
                                </Button>
                            </div>
                        )}
                    </button>
                )}

                {/* Hidden File Input */}
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

                {/* Helper Text */}
                {helper && !hasError && (
                    <p
                        id={helperId}
                        className="text-muted-foreground text-sm"
                    >
                        {helper}
                    </p>
                )}

                {/* Error Message */}
                {hasError && errorMessage && (
                    <p
                        id={errorId}
                        className="text-destructive text-sm"
                    >
                        {errorMessage}
                    </p>
                )}
            </div>
        );
    }
);

GalleryField.displayName = 'GalleryField';
