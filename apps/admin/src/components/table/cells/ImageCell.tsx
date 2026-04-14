import { useTranslations } from '@/hooks/use-translations';
import { getMediaUrl } from '@repo/media';
import type { ReactNode } from 'react';

type ImageCellProps = {
    readonly value: unknown;
    readonly size?: 'sm' | 'md' | 'lg';
    readonly fallbackText?: string;
};

/**
 * ImageCell component for rendering single images in table cells.
 * Expects either a string URL or an object with url property.
 * Provides fallback handling for missing or broken images.
 */
export const ImageCell = ({ value, size = 'md', fallbackText }: ImageCellProps): ReactNode => {
    const { t } = useTranslations();
    const resolvedFallbackText = fallbackText ?? t('admin-common.states.noImage');
    if (value === null || value === undefined) {
        return (
            <div className="flex items-center justify-center rounded-md bg-muted text-muted-foreground text-xs">
                <span>{resolvedFallbackText}</span>
            </div>
        );
    }

    // Extract URL from value
    let imageUrl: string | null = null;
    let altText: string | undefined;

    if (typeof value === 'string') {
        imageUrl = value;
    } else if (typeof value === 'object' && value !== null) {
        const imageObj = value as Record<string, unknown>;
        imageUrl = imageObj.url as string;
        altText = (imageObj.caption as string) || (imageObj.description as string);
    }

    if (!imageUrl) {
        return (
            <div className={getSizeClasses(size, true)}>
                <span className="text-muted-foreground text-xs">{resolvedFallbackText}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center">
            <img
                src={getMediaUrl(imageUrl, { preset: 'thumbnail' })}
                alt={altText || 'Image'}
                className={getSizeClasses(size, false)}
                onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) {
                        fallback.style.display = 'flex';
                    }
                }}
            />
            <div
                className={`${getSizeClasses(size, true)} hidden`}
                style={{ display: 'none' }}
            >
                <span className="text-muted-foreground text-xs">
                    {t('admin-common.states.failedToLoad')}
                </span>
            </div>
        </div>
    );
};

/**
 * Gets CSS classes based on the size prop.
 */
function getSizeClasses(size: 'sm' | 'md' | 'lg', isFallback: boolean): string {
    const baseClasses = isFallback
        ? 'flex items-center justify-center rounded-md bg-muted text-muted-foreground'
        : 'rounded-md object-cover';

    switch (size) {
        case 'sm':
            return `${baseClasses} ${isFallback ? 'h-8 w-12' : 'h-8 w-12'}`;
        case 'md':
            return `${baseClasses} ${isFallback ? 'h-12 w-16' : 'h-12 w-16'}`;
        case 'lg':
            return `${baseClasses} ${isFallback ? 'h-16 w-24' : 'h-16 w-24'}`;
        default:
            return `${baseClasses} ${isFallback ? 'h-12 w-16' : 'h-12 w-16'}`;
    }
}
