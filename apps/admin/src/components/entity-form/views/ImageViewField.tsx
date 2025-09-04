import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ImageValue } from '@/components/entity-form/fields/ImageField';
import type {
    FieldConfig,
    ImageFieldConfig
} from '@/components/entity-form/types/field-config.types';
import { Badge, Label } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';

import { Download, ExternalLink, ImageIcon } from 'lucide-react';
import * as React from 'react';

/**
 * Props for ImageViewField component
 */
export interface ImageViewFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: ImageValue;
    /** Additional CSS classes */
    className?: string;
    /** Whether to show the label */
    showLabel?: boolean;
    /** Whether to show the description */
    showDescription?: boolean;
    /** Image display size */
    size?: 'sm' | 'md' | 'lg' | 'xl';
    /** Whether to show image metadata */
    showMetadata?: boolean;
    /** Whether to show download link */
    showDownload?: boolean;
    /** Whether to show external link */
    showExternalLink?: boolean;
    /** Whether image is clickable for preview */
    clickable?: boolean;
    /** Click handler for image preview */
    onImageClick?: (imageUrl: string) => void;
}

/**
 * ImageViewField component for displaying images
 * Handles IMAGE field type in view mode
 */
export const ImageViewField = React.forwardRef<HTMLDivElement, ImageViewFieldProps>(
    (
        {
            config,
            value,
            className,
            showLabel = true,
            showDescription = false,
            size = 'md',
            showMetadata = true,
            showDownload = false,
            showExternalLink = false,
            clickable = true,
            onImageClick,
            ...props
        },
        ref
    ) => {
        // Use direct translations from config
        const label = config.label;
        const description = config.description;

        // Get image specific config
        const imageConfig =
            config.type === FieldTypeEnum.IMAGE
                ? (config.typeConfig as ImageFieldConfig)
                : undefined;

        const fieldId = `view-field-${config.id}`;
        const descriptionId = description ? `${fieldId}-description` : undefined;

        const aspectRatio = imageConfig?.aspectRatio;

        // Size configurations
        const sizeConfig = {
            sm: { width: 'w-24', height: 'h-24', maxWidth: 'max-w-24' },
            md: { width: 'w-32', height: 'h-32', maxWidth: 'max-w-32' },
            lg: { width: 'w-48', height: 'h-48', maxWidth: 'max-w-48' },
            xl: { width: 'w-64', height: 'h-64', maxWidth: 'max-w-64' }
        };

        const currentSize = sizeConfig[size];

        const handleImageClick = () => {
            if (clickable && value?.url) {
                onImageClick?.(value.url);
            }
        };

        const handleDownload = async () => {
            if (!value?.url) return;

            try {
                const response = await fetch(value.url);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = url;
                link.download = value.alt || 'image';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Download failed:', error);
            }
        };

        const handleExternalLink = () => {
            if (value?.url) {
                window.open(value.url, '_blank', 'noopener,noreferrer');
            }
        };

        const renderImage = () => {
            if (!value?.url) {
                return (
                    <div
                        className={cn(
                            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/30',
                            currentSize.width,
                            currentSize.height
                        )}
                    >
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        <span className="mt-1 text-muted-foreground text-xs">No image</span>
                    </div>
                );
            }

            return (
                <div className="group relative">
                    <img
                        src={value.url}
                        alt={value.alt || 'Image'}
                        className={cn(
                            'rounded-lg border object-cover',
                            currentSize.width,
                            currentSize.height,
                            aspectRatio && `aspect-[${aspectRatio.replace(':', '/')}]`,
                            clickable && 'cursor-pointer transition-opacity hover:opacity-90'
                        )}
                        onClick={handleImageClick}
                        onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && clickable && value?.url) {
                                e.preventDefault();
                                handleImageClick();
                            }
                        }}
                        tabIndex={clickable && value?.url ? 0 : -1}
                        role={clickable && value?.url ? 'button' : undefined}
                        aria-label={clickable && value?.url ? 'Preview image' : undefined}
                        loading="lazy"
                    />

                    {/* Overlay Controls */}
                    {(showDownload || showExternalLink) && (
                        <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                            {showDownload && (
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    className="rounded-full bg-white/20 p-2 transition-colors hover:bg-white/30"
                                    title="Download image"
                                >
                                    <Download className="h-4 w-4 text-white" />
                                </button>
                            )}

                            {showExternalLink && (
                                <button
                                    type="button"
                                    onClick={handleExternalLink}
                                    className="rounded-full bg-white/20 p-2 transition-colors hover:bg-white/30"
                                    title="Open in new tab"
                                >
                                    <ExternalLink className="h-4 w-4 text-white" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            );
        };

        const renderMetadata = () => {
            if (!showMetadata || !value) return null;

            return (
                <div className="space-y-1 text-sm">
                    {value.caption && (
                        <div>
                            <span className="font-medium">Caption:</span>
                            <span className="ml-2">{value.caption}</span>
                        </div>
                    )}

                    {value.description && (
                        <div>
                            <span className="font-medium">Description:</span>
                            <span className="ml-2 text-muted-foreground">{value.description}</span>
                        </div>
                    )}

                    {value.alt && (
                        <div>
                            <span className="font-medium">Alt text:</span>
                            <span className="ml-2 text-muted-foreground text-xs">{value.alt}</span>
                        </div>
                    )}
                </div>
            );
        };

        return (
            <div
                ref={ref}
                className={cn('space-y-3', className)}
                {...props}
            >
                {/* Label */}
                {showLabel && label && (
                    <Label className="font-medium text-muted-foreground text-sm">{label}</Label>
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

                {/* Image */}
                <div className="flex flex-col gap-3">
                    {renderImage()}

                    {/* Image Info */}
                    {value?.url && (
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            <Badge
                                variant="outline"
                                className="text-xs"
                            >
                                Image
                            </Badge>
                            {clickable && <span>Click to preview</span>}
                        </div>
                    )}
                </div>

                {/* Metadata */}
                {renderMetadata()}
            </div>
        );
    }
);

ImageViewField.displayName = 'ImageViewField';
