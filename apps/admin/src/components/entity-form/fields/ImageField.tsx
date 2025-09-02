import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { Button, Input, Label } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';

import { ImageIcon, Upload, X } from 'lucide-react';
import * as React from 'react';

/**
 * Image value type
 */
export interface ImageValue {
    url: string;
    caption?: string;
    description?: string;
    alt?: string;
}

/**
 * Props for ImageField component
 */
export interface ImageFieldProps {
    /** Field configuration */
    config: FieldConfig;
    /** Current field value */
    value?: ImageValue;
    /** Change handler */
    onChange?: (value: ImageValue | null) => void;
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
 * ImageField component for image upload and management
 * Handles IMAGE field type from FieldConfig
 */
export const ImageField = React.forwardRef<HTMLInputElement, ImageFieldProps>(
    (
        {
            config,
            value,
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

        // Get image specific config
        const imageConfig = config.typeConfig?.type === 'IMAGE' ? config.typeConfig : undefined;

        const fieldId = `field-${config.id}`;
        const errorId = hasError ? `${fieldId}-error` : undefined;
        const descriptionId = description ? `${fieldId}-description` : undefined;
        const helperId = helper ? `${fieldId}-helper` : undefined;

        const maxSize = imageConfig?.maxSize || 5 * 1024 * 1024; // 5MB default
        const allowedTypes = imageConfig?.allowedTypes || ['image/jpeg', 'image/png', 'image/webp'];
        const maxWidth = imageConfig?.maxWidth;
        const maxHeight = imageConfig?.maxHeight;
        const aspectRatio = imageConfig?.aspectRatio;
        // const quality = imageConfig?.quality || 0.9; // TODO: Use when implementing image compression

        // File input ref
        const fileInputRef = React.useRef<HTMLInputElement>(null);

        // State
        const [isUploading, setIsUploading] = React.useState(false);
        const [dragOver, setDragOver] = React.useState(false);

        const handleFileSelect = async (file: File) => {
            if (!file) return;

            // Validate file type
            if (!allowedTypes.includes(file.type)) {
                // TODO [ece923b1-e4c2-4ceb-993a-fab4c153a92d]: Show error toast
                console.error('Invalid file type');
                return;
            }

            // Validate file size
            if (file.size > maxSize) {
                // TODO [32432bbf-5185-46d3-a589-e6bc86c29086]: Show error toast
                console.error('File too large');
                return;
            }

            setIsUploading(true);

            try {
                let imageUrl: string;

                if (onUpload) {
                    // Use custom upload handler
                    imageUrl = await onUpload(file);
                } else {
                    // Create local URL (for preview/development)
                    imageUrl = URL.createObjectURL(file);
                }

                // Create image value
                const imageValue: ImageValue = {
                    url: imageUrl,
                    alt: file.name
                };

                onChange?.(imageValue);
            } catch (error) {
                console.error('Upload failed:', error);
                // TODO [e1671f66-f1ed-449f-8e07-60681b160628]: Show error toast
            } finally {
                setIsUploading(false);
            }
        };

        const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                handleFileSelect(file);
            }
        };

        const handleDrop = (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);

            const file = e.dataTransfer.files[0];
            if (file) {
                handleFileSelect(file);
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

        const handleRemove = () => {
            onChange?.(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        };

        const handleCaptionChange = (caption: string) => {
            if (value) {
                onChange?.({ ...value, caption });
            }
        };

        const handleDescriptionChange = (description: string) => {
            if (value) {
                onChange?.({ ...value, description });
            }
        };

        const handleAltChange = (alt: string) => {
            if (value) {
                onChange?.({ ...value, alt });
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

                {/* Image Preview or Upload Area */}
                {value?.url ? (
                    <div className="space-y-3">
                        {/* Image Preview */}
                        <div className="relative inline-block">
                            <img
                                src={value.url}
                                alt={value.alt || 'Uploaded image'}
                                className={cn(
                                    'h-auto max-w-full rounded-lg border',
                                    maxWidth && `max-w-[${maxWidth}px]`,
                                    maxHeight && `max-h-[${maxHeight}px]`,
                                    aspectRatio && `aspect-[${aspectRatio.replace(':', '/')}]`,
                                    'object-cover'
                                )}
                            />

                            {/* Remove button */}
                            {!disabled && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-2 right-2"
                                    onClick={handleRemove}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {/* Image Metadata Fields */}
                        <div className="space-y-2">
                            <div>
                                <Label
                                    htmlFor={`${fieldId}-alt`}
                                    className="text-xs"
                                >
                                    Alt Text
                                </Label>
                                <Input
                                    id={`${fieldId}-alt`}
                                    value={value.alt || ''}
                                    onChange={(e) => handleAltChange(e.target.value)}
                                    placeholder="Describe the image for accessibility"
                                    disabled={disabled}
                                    className="text-sm"
                                />
                            </div>

                            <div>
                                <Label
                                    htmlFor={`${fieldId}-caption`}
                                    className="text-xs"
                                >
                                    Caption
                                </Label>
                                <Input
                                    id={`${fieldId}-caption`}
                                    value={value.caption || ''}
                                    onChange={(e) => handleCaptionChange(e.target.value)}
                                    placeholder="Image caption"
                                    disabled={disabled}
                                    className="text-sm"
                                />
                            </div>

                            <div>
                                <Label
                                    htmlFor={`${fieldId}-description`}
                                    className="text-xs"
                                >
                                    Description
                                </Label>
                                <Input
                                    id={`${fieldId}-description`}
                                    value={value.description || ''}
                                    onChange={(e) => handleDescriptionChange(e.target.value)}
                                    placeholder="Detailed description"
                                    disabled={disabled}
                                    className="text-sm"
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Upload Area */
                    <button
                        type="button"
                        className={cn(
                            'rounded-lg border-2 border-dashed p-8 text-center transition-colors',
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
                        aria-label="Upload image"
                    >
                        {isUploading ? (
                            <div className="flex flex-col items-center gap-2">
                                <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
                                <p className="text-muted-foreground text-sm">Uploading...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <ImageIcon className="h-12 w-12 text-muted-foreground" />
                                <div className="space-y-1">
                                    <p className="font-medium text-sm">
                                        Drop an image here, or click to select
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        {allowedTypes.join(', ')} up to {formatFileSize(maxSize)}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={disabled}
                                >
                                    <Upload className="mr-2 h-4 w-4" />
                                    Select Image
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

ImageField.displayName = 'ImageField';
