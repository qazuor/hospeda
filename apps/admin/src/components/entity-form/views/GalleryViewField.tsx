import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { GalleryImage } from '@/components/entity-form/fields/GalleryField';
import type {
    FieldConfig,
    GalleryFieldConfig
} from '@/components/entity-form/types/field-config.types';
import { Badge, Label } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';

import { Download, ExternalLink, ImageIcon, ZoomIn } from 'lucide-react';
import * as React from 'react';

/**
 * Props for GalleryViewField component
 */
export interface GalleryViewFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: GalleryImage[];
    /** Additional CSS classes */
    className?: string;
    /** Whether to show the label */
    showLabel?: boolean;
    /** Whether to show the description */
    showDescription?: boolean;
    /** Gallery layout */
    layout?: 'grid' | 'masonry' | 'carousel';
    /** Number of columns in grid */
    columns?: 2 | 3 | 4 | 5 | 6;
    /** Image size in grid */
    imageSize?: 'sm' | 'md' | 'lg';
    /** Whether to show image metadata */
    showMetadata?: boolean;
    /** Whether to show download links */
    showDownload?: boolean;
    /** Whether to show external links */
    showExternalLink?: boolean;
    /** Whether images are clickable for preview */
    clickable?: boolean;
    /** Click handler for image preview */
    onImageClick?: (imageUrl: string, images: GalleryImage[]) => void;
    /** Maximum number of images to show initially */
    maxVisible?: number;
}

/**
 * GalleryViewField component for displaying image galleries
 * Handles GALLERY field type in view mode
 */
export const GalleryViewField = React.forwardRef<HTMLDivElement, GalleryViewFieldProps>(
    (
        {
            config,
            value = [],
            className,
            showLabel = true,
            showDescription = false,
            layout = 'grid',
            columns = 3,
            imageSize = 'md',
            showMetadata = true,
            showDownload = false,
            showExternalLink = false,
            clickable = true,
            onImageClick,
            maxVisible,
            ...props
        },
        ref
    ) => {
        // Use direct translations from config
        const label = config.label;
        const description = config.description;

        // Get gallery specific config
        const galleryConfig =
            config.type === FieldTypeEnum.GALLERY
                ? (config.typeConfig as GalleryFieldConfig)
                : undefined;

        const fieldId = `view-field-${config.id}`;
        const descriptionId = description ? `${fieldId}-description` : undefined;

        // State for show more/less
        const [showAll, setShowAll] = React.useState(false);

        // Sort images by order
        const sortedImages = [...value].sort((a, b) => a.order - b.order);
        const displayImages =
            maxVisible && !showAll ? sortedImages.slice(0, maxVisible) : sortedImages;
        const hasMore = maxVisible && sortedImages.length > maxVisible;

        // Grid configurations
        const gridConfig = {
            2: 'grid-cols-2',
            3: 'grid-cols-2 md:grid-cols-3',
            4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
            5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
            6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
        };

        // Image size configurations
        const sizeConfig = {
            sm: 'h-24',
            md: 'h-32',
            lg: 'h-48'
        };

        const handleImageClick = (image: GalleryImage) => {
            if (clickable) {
                onImageClick?.(image.url, sortedImages);
            }
        };

        const handleDownload = async (image: GalleryImage) => {
            try {
                const response = await fetch(image.url);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = url;
                link.download = image.alt || `gallery-image-${image.order + 1}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Download failed:', error);
            }
        };

        const handleExternalLink = (image: GalleryImage) => {
            window.open(image.url, '_blank', 'noopener,noreferrer');
        };

        const renderEmptyState = () => (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 py-12">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
                <span className="mt-2 text-muted-foreground text-sm">No images in gallery</span>
            </div>
        );

        const renderImage = (image: GalleryImage, index: number) => (
            <div
                key={image.id}
                className="group relative"
            >
                <img
                    src={image.url}
                    alt={image.alt || `Gallery image ${index + 1}`}
                    className={cn(
                        'w-full rounded-lg border object-cover',
                        sizeConfig[imageSize],
                        clickable && 'cursor-pointer transition-opacity hover:opacity-90'
                    )}
                    onClick={() => handleImageClick(image)}
                    onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && clickable) {
                            e.preventDefault();
                            handleImageClick(image);
                        }
                    }}
                    tabIndex={clickable ? 0 : -1}
                    role={clickable ? 'button' : undefined}
                    aria-label={
                        clickable ? `Preview ${image.alt || `image ${index + 1}`}` : undefined
                    }
                    loading="lazy"
                />

                {/* Overlay Controls */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    {clickable && (
                        <button
                            type="button"
                            onClick={() => handleImageClick(image)}
                            className="rounded-full bg-white/20 p-2 transition-colors hover:bg-white/30"
                            title="Preview image"
                        >
                            <ZoomIn className="h-4 w-4 text-white" />
                        </button>
                    )}

                    {showDownload && (
                        <button
                            type="button"
                            onClick={() => handleDownload(image)}
                            className="rounded-full bg-white/20 p-2 transition-colors hover:bg-white/30"
                            title="Download image"
                        >
                            <Download className="h-4 w-4 text-white" />
                        </button>
                    )}

                    {showExternalLink && (
                        <button
                            type="button"
                            onClick={() => handleExternalLink(image)}
                            className="rounded-full bg-white/20 p-2 transition-colors hover:bg-white/30"
                            title="Open in new tab"
                        >
                            <ExternalLink className="h-4 w-4 text-white" />
                        </button>
                    )}
                </div>

                {/* Image Caption Overlay */}
                {showMetadata && image.caption && (
                    <div className="absolute right-0 bottom-0 left-0 rounded-b-lg bg-black/70 p-2 text-white">
                        <p className="truncate text-xs">{image.caption}</p>
                    </div>
                )}
            </div>
        );

        const renderGrid = () => (
            <div className={cn('grid gap-4', gridConfig[columns])}>
                {displayImages.map((image, index) => renderImage(image, index))}
            </div>
        );

        const renderMasonry = () => (
            <div className="columns-2 gap-4 space-y-4 md:columns-3 lg:columns-4">
                {displayImages.map((image, index) => (
                    <div
                        key={image.id}
                        className="break-inside-avoid"
                    >
                        {renderImage(image, index)}
                    </div>
                ))}
            </div>
        );

        const renderCarousel = () => (
            <div className="flex gap-4 overflow-x-auto pb-4">
                {displayImages.map((image, index) => (
                    <div
                        key={image.id}
                        className="flex-shrink-0"
                    >
                        {renderImage(image, index)}
                    </div>
                ))}
            </div>
        );

        const renderGallery = () => {
            if (value.length === 0) {
                return renderEmptyState();
            }

            switch (layout) {
                case 'masonry':
                    return renderMasonry();
                case 'carousel':
                    return renderCarousel();
                default:
                    return renderGrid();
            }
        };

        return (
            <div
                ref={ref}
                className={cn('space-y-4', className)}
                {...props}
            >
                {/* Label */}
                {showLabel && label && (
                    <div className="flex items-center justify-between">
                        <Label className="font-medium text-muted-foreground text-sm">{label}</Label>
                        {value.length > 0 && (
                            <Badge
                                variant="outline"
                                className="text-xs"
                            >
                                {value.length} image{value.length !== 1 ? 's' : ''}
                            </Badge>
                        )}
                    </div>
                )}

                {/* Description */}
                {showDescription && description && (
                    <p
                        id={descriptionId}
                        className="text-muted-foreground text-xs"
                    >
                        {description}
                    </p>
                )}

                {/* Gallery */}
                <div
                    className={cn(config.className)}
                    aria-describedby={descriptionId}
                >
                    {renderGallery()}
                </div>

                {/* Show More/Less Button */}
                {hasMore && (
                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => setShowAll(!showAll)}
                            className="text-primary text-sm hover:underline"
                        >
                            {showAll
                                ? `Show less (${maxVisible} of ${sortedImages.length})`
                                : `Show all ${sortedImages.length} images`}
                        </button>
                    </div>
                )}

                {/* Gallery Info */}
                {value.length > 0 && (
                    <div className="flex items-center gap-4 text-muted-foreground text-xs">
                        <span>Layout: {layout}</span>
                        {clickable && <span>Click images to preview</span>}
                        {galleryConfig?.sortable && <span>Sortable gallery</span>}
                    </div>
                )}
            </div>
        );
    }
);

GalleryViewField.displayName = 'GalleryViewField';
