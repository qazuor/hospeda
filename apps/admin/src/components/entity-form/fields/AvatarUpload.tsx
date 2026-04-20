import { Button, Input, Label } from '@/components/ui-wrapped';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTranslations } from '@/hooks/use-translations';
import { getInitialsFromName } from '@/lib/avatar-utils';
import { DEFAULT_AVATAR_MAX_SIZE_MB } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { adminLogger } from '@/utils/logger';

import { CloseIcon, LoaderIcon, UploadIcon } from '@repo/icons';
import * as React from 'react';

/**
 * Default accepted MIME types for avatar uploads.
 */
const DEFAULT_AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Props for {@link AvatarUpload}.
 */
export interface AvatarUploadProps {
    /** Current avatar image URL. Falsy values render the initials fallback. */
    value?: string | null;
    /** Change handler — called with the new URL or null when removed. */
    onChange?: (value: string | null) => void;
    /**
     * Upload handler invoked after client-side validation passes. Must return
     * the final hosted URL to be stored on the entity.
     */
    onUpload?: (args: { file: File }) => Promise<string>;
    /** Full name used to derive the AvatarFallback initials. */
    name?: string | null;
    /** Optional email used as secondary source when name is empty. */
    email?: string | null;
    /**
     * Maximum accepted file size in megabytes. Defaults to
     * {@link DEFAULT_AVATAR_MAX_SIZE_MB} (5 MB) to match the `@repo/media`
     * avatar cap.
     */
    maxFileSizeMb?: number;
    /** Allowed MIME types for the picker. */
    allowedTypes?: ReadonlyArray<string>;
    /** Whether the control is disabled. */
    disabled?: boolean;
    /** Optional label rendered above the avatar. */
    label?: string;
    /** Additional CSS classes on the outer wrapper. */
    className?: string;
    /** Test id forwarded to the outer wrapper (useful in component tests). */
    'data-testid'?: string;
}

/**
 * AvatarUpload renders a shadcn Avatar preview (with initials fallback) plus
 * an upload / change / remove control. Enforces a client-side file-size cap
 * driven by the `maxFileSizeMb` prop.
 */
export const AvatarUpload: React.FC<AvatarUploadProps> = ({
    value,
    onChange,
    onUpload,
    name,
    email,
    maxFileSizeMb = DEFAULT_AVATAR_MAX_SIZE_MB,
    allowedTypes = DEFAULT_AVATAR_ALLOWED_TYPES,
    disabled = false,
    label,
    className,
    'data-testid': dataTestId
}) => {
    const { t } = useTranslations();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [sizeError, setSizeError] = React.useState<string | null>(null);

    const { initials } = getInitialsFromName({ name, email });

    const maxBytes = Math.max(1, Math.floor(maxFileSizeMb)) * 1024 * 1024;

    const resolvedLabel = label ?? t('admin-entities.fields.avatar.label');
    const errorId = sizeError ? 'avatar-upload-size-error' : undefined;

    const resetInput = () => {
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileSelect = async (file: File) => {
        setSizeError(null);

        if (!allowedTypes.includes(file.type)) {
            setSizeError(t('admin-entities.fields.avatar.invalidType'));
            adminLogger.error('AvatarUpload: invalid file type', { type: file.type });
            resetInput();
            return;
        }

        if (file.size > maxBytes) {
            setSizeError(
                t('admin-entities.fields.avatar.fileTooLarge', {
                    maxSize: String(maxFileSizeMb)
                })
            );
            resetInput();
            return;
        }

        setIsUploading(true);
        try {
            const url = onUpload ? await onUpload({ file }) : URL.createObjectURL(file);
            onChange?.(url);
        } catch (error) {
            adminLogger.error('AvatarUpload: upload failed', error);
            setSizeError(t('admin-entities.fields.avatar.invalidType'));
        } finally {
            setIsUploading(false);
            resetInput();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) void handleFileSelect(file);
    };

    const handleRemove = () => {
        onChange?.(null);
        setSizeError(null);
        resetInput();
    };

    const triggerPicker = () => {
        if (disabled || isUploading) return;
        fileInputRef.current?.click();
    };

    return (
        <div
            className={cn('flex flex-col gap-3', className)}
            data-testid={dataTestId ?? 'avatar-upload'}
        >
            {resolvedLabel && <Label>{resolvedLabel}</Label>}

            <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                    {value ? (
                        <AvatarImage
                            src={value}
                            alt={resolvedLabel}
                        />
                    ) : null}
                    <AvatarFallback
                        aria-label={t('admin-entities.fields.avatar.fallbackAriaLabel')}
                        data-testid="avatar-upload-fallback"
                    >
                        {initials}
                    </AvatarFallback>
                </Avatar>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={triggerPicker}
                        disabled={disabled || isUploading}
                        aria-describedby={errorId}
                        data-testid="avatar-upload-button"
                    >
                        {isUploading ? (
                            <>
                                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                                {t('admin-entities.fields.avatar.uploading')}
                            </>
                        ) : (
                            <>
                                <UploadIcon className="mr-2 h-4 w-4" />
                                {value
                                    ? t('admin-entities.fields.avatar.changeButton')
                                    : t('admin-entities.fields.avatar.uploadButton')}
                            </>
                        )}
                    </Button>

                    {value && !disabled && !isUploading ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemove}
                            data-testid="avatar-remove-button"
                        >
                            <CloseIcon className="mr-2 h-4 w-4" />
                            {t('admin-entities.fields.avatar.removeButton')}
                        </Button>
                    ) : null}
                </div>
            </div>

            <Input
                ref={fileInputRef}
                type="file"
                accept={allowedTypes.join(',')}
                className="hidden"
                onChange={handleInputChange}
                disabled={disabled}
                aria-label={t('admin-entities.fields.avatar.uploadAriaLabel')}
                data-testid="avatar-upload-input"
            />

            {sizeError ? (
                <p
                    id={errorId}
                    className="text-destructive text-sm"
                    role="alert"
                    data-testid="avatar-upload-error"
                >
                    {sizeError}
                </p>
            ) : null}
        </div>
    );
};

AvatarUpload.displayName = 'AvatarUpload';
