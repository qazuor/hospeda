import type { ReactNode } from 'react';

type GalleryCellProps = {
    readonly value: unknown;
    readonly maxImages?: number;
    readonly size?: 'sm' | 'md' | 'lg';
};

/**
 * GalleryCell component for rendering image galleries in table cells.
 * Displays multiple images in a compact grid with overflow indicator.
 * Expects an array of image objects or URLs.
 */
export const GalleryCell = ({ value, maxImages = 3, size = 'sm' }: GalleryCellProps): ReactNode => {
    if (value === null || value === undefined) {
        return (
            <div className="flex items-center justify-center rounded-md bg-gray-100 text-gray-500 text-xs dark:bg-gray-800 dark:text-gray-400">
                <span>No gallery</span>
            </div>
        );
    }

    // Handle non-array values
    if (!Array.isArray(value)) {
        return (
            <div className="flex items-center justify-center rounded-md bg-gray-100 text-gray-500 text-xs dark:bg-gray-800 dark:text-gray-400">
                <span>Invalid gallery</span>
            </div>
        );
    }

    // Handle empty arrays
    if (value.length === 0) {
        return (
            <div className="flex items-center justify-center rounded-md bg-gray-100 text-gray-500 text-xs dark:bg-gray-800 dark:text-gray-400">
                <span>Empty gallery</span>
            </div>
        );
    }

    // Extract image URLs from the array
    const imageUrls = value
        .map((item) => {
            if (typeof item === 'string') {
                return item;
            }
            if (typeof item === 'object' && item !== null) {
                const imageObj = item as Record<string, unknown>;
                return imageObj.url as string;
            }
            return null;
        })
        .filter((url): url is string => Boolean(url));

    if (imageUrls.length === 0) {
        return (
            <div className="flex items-center justify-center rounded-md bg-gray-100 text-gray-500 text-xs dark:bg-gray-800 dark:text-gray-400">
                <span>No valid images</span>
            </div>
        );
    }

    const visibleImages = imageUrls.slice(0, maxImages);
    const remainingCount = imageUrls.length - maxImages;
    const hasOverflow = remainingCount > 0;

    return (
        <div className="flex items-center gap-1">
            <div className="flex gap-1">
                {visibleImages.map((url, index) => (
                    <div
                        key={url}
                        className="relative"
                    >
                        <img
                            src={url}
                            alt={`Gallery item ${index + 1}`}
                            className={getImageClasses(size)}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                            }}
                        />
                        {/* Overlay for the last image if there are more */}
                        {hasOverflow && index === visibleImages.length - 1 && (
                            <div className={getOverlayClasses(size)}>
                                <span className="font-medium text-white text-xs">
                                    +{remainingCount}
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * Gets CSS classes for individual images based on size.
 */
function getImageClasses(size: 'sm' | 'md' | 'lg'): string {
    const baseClasses = 'rounded object-cover';

    switch (size) {
        case 'sm':
            return `${baseClasses} h-8 w-8`;
        case 'md':
            return `${baseClasses} h-12 w-12`;
        case 'lg':
            return `${baseClasses} h-16 w-16`;
        default:
            return `${baseClasses} h-8 w-8`;
    }
}

/**
 * Gets CSS classes for the overlay showing remaining count.
 */
function getOverlayClasses(size: 'sm' | 'md' | 'lg'): string {
    const baseClasses =
        'absolute inset-0 flex items-center justify-center rounded bg-black bg-opacity-60';

    switch (size) {
        case 'sm':
            return `${baseClasses} h-8 w-8`;
        case 'md':
            return `${baseClasses} h-12 w-12`;
        case 'lg':
            return `${baseClasses} h-16 w-16`;
        default:
            return `${baseClasses} h-8 w-8`;
    }
}
