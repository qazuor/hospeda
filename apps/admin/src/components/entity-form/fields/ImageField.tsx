import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { DeleteConfirmDialog } from '@/components/entity-form/fields/DeleteConfirmDialog';
import { ImageFieldErrorBanner } from '@/components/entity-form/fields/ImageFieldErrorBanner';
import type {
    FieldConfig,
    ImageFieldConfig
} from '@/components/entity-form/types/field-config.types';
import { Input, Label } from '@/components/ui-wrapped';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTranslations } from '@/hooks/use-translations';
import { DEFAULT_MEDIA_MAX_SIZE_BYTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { adminLogger } from '@/utils/logger';

import { CloseIcon, ImageIcon, LoaderIcon, UploadIcon } from '@repo/icons';
import { ModerationStatusEnum } from '@repo/schemas';
import * as React from 'react';

/**
 * Image value type — mirrors `ImageSchema` from `@repo/schemas` so the
 * PATCH body parses cleanly. `moderationState` is required by ImageSchema
 * and must always be present (new uploads default to PENDING; items loaded
 * from the API preserve whatever the server sent).
 */
export interface ImageValue {
    url: string;
    caption?: string;
    description?: string;
    alt?: string;
    moderationState: ModerationStatusEnum;
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
    /** External upload error (e.g. from useMediaUpload). Surfaced in the error banner. */
    uploadError?: Error | null;
}

/**
 * ImageField component for image upload and management.
 *
 * T-045 additions (SPEC-078-GAPS):
 * - Inline dismissible error banner with role="alert" + aria-live="assertive"
 *   (no longer silent / toast-only on upload failure).
 * - Delete confirmation via `AlertDialog` before `onChange(null)` fires. Per
 *   D3-C, the confirmation lives in the field component, not in accommodation
 *   edit pages.
 * - All transient UI animations (spinner, dialog fade, banner) respect
 *   `prefers-reduced-motion: reduce` via Tailwind's `motion-reduce:` utilities.
 *
 * Handles IMAGE field type from FieldConfig.
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
            onUpload,
            uploadError = null
        },
        _ref
    ) => {
        const { t } = useTranslations();

        // Use direct translations from config
        const label = config.label;
        const description = config.description;
        const helper = config.help;

        // Get image specific config
        const imageConfig =
            config.type === FieldTypeEnum.IMAGE
                ? (config.typeConfig as ImageFieldConfig)
                : undefined;

        const fieldId = `field-${config.id}`;
        const errorId = hasError ? `${fieldId}-error` : undefined;
        const descriptionId = description ? `${fieldId}-description` : undefined;
        const helperId = helper ? `${fieldId}-helper` : undefined;

        const maxSize = imageConfig?.maxSize || DEFAULT_MEDIA_MAX_SIZE_BYTES;
        const allowedTypes = imageConfig?.allowedTypes || [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/heic',
            'image/heif',
            'image/avif'
        ];
        // Note: imageConfig.maxWidth / maxHeight are upload constraints
        // enforced server-side (and via the file picker accept attribute);
        // the preview size is capped to a fixed thumbnail width instead.
        const aspectRatio = imageConfig?.aspectRatio;

        // File input ref
        const fileInputRef = React.useRef<HTMLInputElement>(null);

        // State
        const [isUploading, setIsUploading] = React.useState(false);
        const [dragOver, setDragOver] = React.useState(false);
        // Internal upload error (set on validation/upload failure). Separate
        // from `uploadError` prop so caller-driven errors and local validation
        // can coexist; caller's wins when both are present.
        const [internalError, setInternalError] = React.useState<string | null>(null);
        // When user dismisses the banner, remember which error was dismissed so
        // we don't re-show the same message until a new upload attempt.
        const [dismissedErrorKey, setDismissedErrorKey] = React.useState<string | null>(null);
        // Delete confirmation dialog state.
        const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

        // Effective error message: caller-provided error takes precedence over internal.
        const effectiveError = uploadError?.message ?? internalError ?? null;
        const bannerVisible = effectiveError !== null && effectiveError !== dismissedErrorKey;

        const handleFileSelect = async (file: File) => {
            if (!file) return;

            // Reset dismissed banner so a new error shows up.
            setDismissedErrorKey(null);

            // Validate file type
            if (!allowedTypes.includes(file.type)) {
                const msg = t('admin-entities.fields.image.errorInvalidType', {
                    types: allowedTypes.join(', ')
                });
                adminLogger.error('Invalid file type');
                setInternalError(msg);
                return;
            }

            // Validate file size
            if (file.size > maxSize) {
                const msg = t('admin-entities.fields.image.errorTooLarge', {
                    maxSize: formatFileSize(maxSize)
                });
                adminLogger.error('File too large');
                setInternalError(msg);
                return;
            }

            setIsUploading(true);
            setInternalError(null);

            try {
                let imageUrl: string;

                if (onUpload) {
                    // Use custom upload handler
                    imageUrl = await onUpload(file);
                } else {
                    // Create local URL (for preview/development)
                    imageUrl = URL.createObjectURL(file);
                }

                // Create image value. moderationState defaults to PENDING so
                // the moderation pipeline can review new uploads (admin can
                // promote to APPROVED via the moderation UI).
                const imageValue: ImageValue = {
                    url: imageUrl,
                    alt: file.name,
                    moderationState: ModerationStatusEnum.PENDING
                };

                onChange?.(imageValue);
            } catch (error) {
                adminLogger.error('Upload failed', error);
                const msg =
                    error instanceof Error
                        ? error.message
                        : t('admin-entities.fields.image.errorBannerFallback');
                setInternalError(msg);
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

        // Opens the confirmation dialog; actual removal happens on confirm.
        const handleRemoveClick = () => {
            setConfirmDeleteOpen(true);
        };

        const handleConfirmDelete = () => {
            setConfirmDeleteOpen(false);
            onChange?.(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        };

        const handleDismissError = () => {
            if (effectiveError) {
                setDismissedErrorKey(effectiveError);
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

        // Browsers can't natively render HEIC/HEIF/AVIF in most desktop
        // setups. Detect via the URL or filename (alt) so we can swap the
        // broken <img> for a descriptive placeholder. We check both the URL
        // path (Cloudinary-hosted files keep the extension) and `alt` (which
        // is populated with `file.name` on local `URL.createObjectURL`).
        const hasUnpreviewableFormat = (imageValue: ImageValue | undefined): boolean => {
            if (!imageValue) return false;
            const candidate = `${imageValue.url} ${imageValue.alt ?? ''}`.toLowerCase();
            return /\.(heic|heif|avif)(\?|#|$)/.test(candidate);
        };

        const previewUnavailable = hasUnpreviewableFormat(value);

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

                {/* Error banner — screen-reader-announced, dismissible. */}
                {bannerVisible && effectiveError && (
                    <ImageFieldErrorBanner
                        title={t('admin-entities.fields.image.errorBannerTitle')}
                        message={effectiveError}
                        dismissLabel={t('admin-entities.fields.image.errorBannerDismiss')}
                        onDismiss={handleDismissError}
                    />
                )}

                {/* Image Preview or Upload Area */}
                {value?.url ? (
                    /* Two-column layout: preview on the left, metadata on the right.
                       Mobile collapses to stacked. Action buttons live as an overlay
                       on the image (replace + delete) so the layout stays tight. */
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        {/* Preview + action overlay */}
                        <div
                            className={cn(
                                'group relative w-full overflow-hidden rounded-lg border bg-muted',
                                'sm:w-96 sm:flex-none'
                            )}
                        >
                            {previewUnavailable ? (
                                <div
                                    data-testid="image-field-preview-unavailable"
                                    className={cn(
                                        'flex aspect-[16/9] flex-col items-center justify-center p-4 text-center'
                                    )}
                                >
                                    <ImageIcon className="h-10 w-10 text-muted-foreground" />
                                    <p className="mt-2 text-muted-foreground text-sm">
                                        {t('admin-entities.fields.image.previewUnavailable')}
                                    </p>
                                    {value.alt ? (
                                        <p className="mt-1 truncate text-muted-foreground text-xs">
                                            {value.alt}
                                        </p>
                                    ) : null}
                                </div>
                            ) : (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <button
                                            type="button"
                                            aria-label={t(
                                                'admin-entities.fields.image.lightboxOpenLabel'
                                            )}
                                            className="block w-full cursor-zoom-in"
                                        >
                                            <img
                                                src={value.url}
                                                alt={
                                                    value.alt ||
                                                    t('admin-entities.fields.image.uploadedAlt')
                                                }
                                                data-testid="image-field-preview"
                                                className={cn(
                                                    'block h-auto w-full object-cover',
                                                    'motion-reduce:animate-none motion-reduce:transition-none',
                                                    aspectRatio
                                                        ? `aspect-[${aspectRatio.replace(':', '/')}]`
                                                        : 'aspect-[16/9]'
                                                )}
                                            />
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent
                                        className="max-w-[min(96vw,1400px)] border-0 bg-transparent p-0 shadow-none"
                                        showCloseButton={false}
                                    >
                                        <DialogTitle className="sr-only">
                                            {value.alt ||
                                                t('admin-entities.fields.image.uploadedAlt')}
                                        </DialogTitle>
                                        <img
                                            src={value.url}
                                            alt={
                                                value.alt ||
                                                t('admin-entities.fields.image.uploadedAlt')
                                            }
                                            className="block max-h-[90vh] w-full rounded-md object-contain"
                                        />
                                    </DialogContent>
                                </Dialog>
                            )}

                            {/* Action toolbar overlay — visible on hover/focus.
                                "Replace" opens the file picker so the user can swap
                                the image without first deleting it; "Delete" still
                                routes through the confirm dialog (destructive). */}
                            {!disabled && (
                                <div
                                    className={cn(
                                        'absolute top-2 right-2 flex items-center gap-1',
                                        'opacity-0 transition-opacity duration-150',
                                        'group-focus-within:opacity-100 group-hover:opacity-100',
                                        'motion-reduce:transition-none'
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        data-testid="image-field-replace"
                                        aria-label={t('admin-entities.fields.image.replaceLabel')}
                                        title={t('admin-entities.fields.image.replaceLabel')}
                                        className={cn(
                                            'inline-flex h-8 w-8 items-center justify-center rounded-md',
                                            'bg-card/90 text-foreground shadow-sm backdrop-blur',
                                            'hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                                        )}
                                    >
                                        <UploadIcon className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRemoveClick}
                                        data-testid="image-field-remove"
                                        aria-label={t(
                                            'admin-entities.fields.image.deleteDialogConfirm'
                                        )}
                                        title={t('admin-entities.fields.image.deleteDialogConfirm')}
                                        className={cn(
                                            'inline-flex h-8 w-8 items-center justify-center rounded-md',
                                            'bg-card/90 text-destructive shadow-sm backdrop-blur',
                                            'hover:bg-destructive hover:text-destructive-foreground',
                                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive'
                                        )}
                                    >
                                        <CloseIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Metadata fields — fill the remaining space on desktop */}
                        <div className="min-w-0 flex-1 space-y-2">
                            <div>
                                <Label
                                    htmlFor={`${fieldId}-alt`}
                                    className="text-xs"
                                >
                                    {t('admin-entities.fields.image.altTextLabel')}{' '}
                                    <span
                                        aria-hidden="true"
                                        className="text-destructive"
                                    >
                                        *
                                    </span>
                                </Label>
                                <Input
                                    id={`${fieldId}-alt`}
                                    value={value.alt || ''}
                                    onChange={(e) => handleAltChange(e.target.value)}
                                    placeholder={t(
                                        'admin-entities.fields.image.altTextPlaceholder'
                                    )}
                                    aria-required="true"
                                    aria-invalid={!value.alt || value.alt.trim() === ''}
                                    disabled={disabled}
                                    className={cn(
                                        'text-sm',
                                        (!value.alt || value.alt.trim() === '') &&
                                            'border-warning focus-visible:ring-warning'
                                    )}
                                />
                                {(!value.alt || value.alt.trim() === '') && !disabled && (
                                    <p className="mt-1 text-warning text-xs">
                                        {t('admin-entities.fields.image.altTextRequiredHint')}
                                    </p>
                                )}
                            </div>

                            <div>
                                <Label
                                    htmlFor={`${fieldId}-caption`}
                                    className="text-xs"
                                >
                                    {t('admin-entities.fields.image.captionLabel')}
                                </Label>
                                <Input
                                    id={`${fieldId}-caption`}
                                    value={value.caption || ''}
                                    onChange={(e) => handleCaptionChange(e.target.value)}
                                    placeholder={t(
                                        'admin-entities.fields.image.captionPlaceholder'
                                    )}
                                    disabled={disabled}
                                    className="text-sm"
                                />
                            </div>

                            <div>
                                <Label
                                    htmlFor={`${fieldId}-description`}
                                    className="text-xs"
                                >
                                    {t('admin-entities.fields.image.descriptionLabel')}
                                </Label>
                                <Input
                                    id={`${fieldId}-description`}
                                    value={value.description || ''}
                                    onChange={(e) => handleDescriptionChange(e.target.value)}
                                    placeholder={t(
                                        'admin-entities.fields.image.descriptionPlaceholder'
                                    )}
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
                            // Disable the hover/drop-over transition when user opts out.
                            'motion-reduce:transition-none',
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
                        aria-label={t('admin-entities.fields.image.uploadAriaLabel')}
                    >
                        {isUploading ? (
                            <div className="flex flex-col items-center gap-2">
                                <LoaderIcon
                                    // Reduced-motion: cancel the spinner animation.
                                    className="h-8 w-8 animate-spin text-primary motion-reduce:animate-none"
                                />
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-entities.fields.image.uploading')}
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <ImageIcon className="h-12 w-12 text-muted-foreground" />
                                <div className="space-y-1">
                                    <p className="font-medium text-sm">
                                        {t('admin-entities.fields.image.dropText')}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        {t('admin-entities.fields.image.fileConstraints', {
                                            types: allowedTypes.join(', '),
                                            maxSize: formatFileSize(maxSize)
                                        })}
                                    </p>
                                </div>
                                {/* biome-ignore lint/nursery/useSortedClasses: Button-like styling */}
                                <span className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">
                                    <UploadIcon className="mr-2 h-4 w-4" />
                                    {t('admin-entities.fields.image.selectButton')}
                                </span>
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

                {/* Error Message (validation layer — separate from upload error banner) */}
                {hasError && errorMessage && (
                    <p
                        id={errorId}
                        className="text-destructive text-sm"
                    >
                        {errorMessage}
                    </p>
                )}

                {/* Delete confirmation dialog */}
                <DeleteConfirmDialog
                    open={confirmDeleteOpen}
                    onOpenChange={setConfirmDeleteOpen}
                    title={t('admin-entities.fields.image.deleteDialogTitle')}
                    description={t('admin-entities.fields.image.deleteDialogDescription')}
                    cancelLabel={t('admin-entities.fields.image.deleteDialogCancel')}
                    confirmLabel={t('admin-entities.fields.image.deleteDialogConfirm')}
                    onConfirm={handleConfirmDelete}
                />
            </div>
        );
    }
);

ImageField.displayName = 'ImageField';
