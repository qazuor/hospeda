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
export const ImageCell = ({
    value,
    size = 'md',
    fallbackText = 'No image'
}: ImageCellProps): ReactNode => {
    if (value === null || value === undefined) {
        return (
            <div className="flex items-center justify-center rounded-md bg-gray-100 text-gray-500 text-xs dark:bg-gray-800 dark:text-gray-400">
                <span>{fallbackText}</span>
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
                <span className="text-gray-500 text-xs dark:text-gray-400">{fallbackText}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center">
            <img
                src={imageUrl}
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
                <span className="text-gray-500 text-xs dark:text-gray-400">Failed to load</span>
            </div>
        </div>
    );
};

/**
 * Gets CSS classes based on the size prop.
 */
function getSizeClasses(size: 'sm' | 'md' | 'lg', isFallback: boolean): string {
    const baseClasses = isFallback
        ? 'flex items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
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
