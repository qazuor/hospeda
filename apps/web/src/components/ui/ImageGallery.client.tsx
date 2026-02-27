import { CloseIcon, NextIcon, PreviousIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';

/**
 * Represents a single image in the gallery
 */
export interface GalleryImage {
    readonly src: string;
    readonly alt: string;
}

/**
 * Props for the ImageGallery component
 */
export interface ImageGalleryProps {
    /**
     * Array of images to display in the gallery
     */
    readonly images: ReadonlyArray<GalleryImage>;

    /**
     * Locale for i18n translations
     * @default 'es'
     */
    readonly locale?: SupportedLocale;

    /**
     * Additional CSS classes to apply to the component
     */
    readonly className?: string;
}

/**
 * ImageGallery component
 *
 * A responsive image gallery with thumbnail navigation and lightbox functionality.
 * Features include:
 * - Main image display with thumbnail strip
 * - Click thumbnail to change main image
 * - Click main image to open fullscreen lightbox
 * - Lightbox navigation with keyboard support (arrows, escape)
 * - Image counter display in lightbox
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * const images = [
 *   { src: '/image1.jpg', alt: 'Image 1' },
 *   { src: '/image2.jpg', alt: 'Image 2' },
 * ];
 *
 * <ImageGallery
 *   images={images}
 *   className="my-custom-class"
 * />
 * ```
 */
export function ImageGallery({
    images,
    locale = 'es',
    className = ''
}: ImageGalleryProps): JSX.Element {
    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'ui' });
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    // Handle empty images array
    if (images.length === 0) {
        return (
            <div
                className={`flex min-h-[400px] items-center justify-center rounded-lg bg-gray-100 ${className}`.trim()}
            >
                <p className="text-gray-500">No images available</p>
            </div>
        );
    }

    const isSingleImage = images.length === 1;
    const currentImage = images[selectedIndex];

    // Safety check: ensure we have a valid current image
    if (!currentImage) {
        return (
            <div
                className={`flex min-h-[400px] items-center justify-center rounded-lg bg-gray-100 ${className}`.trim()}
            >
                <p className="text-gray-500">Invalid image index</p>
            </div>
        );
    }

    /**
     * Navigate to the previous image in the gallery
     */
    const handlePrevious = useCallback(() => {
        setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    }, [images.length]);

    /**
     * Navigate to the next image in the gallery
     */
    const handleNext = useCallback(() => {
        setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    }, [images.length]);

    /**
     * Close the lightbox
     */
    const handleCloseLightbox = useCallback(() => {
        setIsLightboxOpen(false);
    }, []);

    /**
     * Open the lightbox
     */
    const handleOpenLightbox = useCallback(() => {
        setIsLightboxOpen(true);
    }, []);

    /**
     * Handle keyboard navigation
     */
    useEffect(() => {
        if (!isLightboxOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleCloseLightbox();
            } else if (event.key === 'ArrowLeft') {
                handlePrevious();
            } else if (event.key === 'ArrowRight') {
                handleNext();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLightboxOpen, handleCloseLightbox, handlePrevious, handleNext]);

    return (
        <div
            className={`w-full ${className}`.trim()}
            data-testid="image-gallery"
        >
            {/* Main Image Display */}
            <div className="relative mb-4">
                <button
                    type="button"
                    onClick={handleOpenLightbox}
                    className="w-full overflow-hidden rounded-lg focus:outline focus:outline-2 focus:outline-primary focus:outline-offset-2"
                    aria-label={t('accessibility.openFullscreen')}
                >
                    <img
                        src={currentImage.src}
                        alt={currentImage.alt}
                        className="h-auto w-full rounded-lg object-cover"
                        data-testid="main-image"
                    />
                </button>
            </div>

            {/* Thumbnail Strip - Only show if more than one image */}
            {!isSingleImage && (
                <div
                    className="flex flex-wrap gap-2"
                    data-testid="thumbnail-strip"
                >
                    {images.map((image, index) => (
                        <button
                            key={`${image.src}-${index}`}
                            type="button"
                            onClick={() => setSelectedIndex(index)}
                            className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border-2 transition-all focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary${selectedIndex === index ? 'border-primary shadow-md' : 'border-gray-300 hover:border-gray-400'}
							`.trim()}
                            aria-label={`View ${image.alt}`}
                            aria-pressed={selectedIndex === index}
                            data-testid={`thumbnail-${index}`}
                        >
                            <img
                                src={image.src}
                                alt={image.alt}
                                className="h-full w-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}

            {/* Lightbox Overlay */}
            {isLightboxOpen && (
                // biome-ignore lint/a11y/useKeyWithClickEvents: Lightbox overlay click is optional convenience; keyboard users can close with Escape key or close button
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
                    data-testid="lightbox"
                    onClick={handleCloseLightbox}
                >
                    {/* Lightbox Content */}
                    {/* biome-ignore lint/a11y/useKeyWithClickEvents: Content container only prevents click propagation, not an interactive element */}
                    <div
                        className="relative flex h-full w-full items-center justify-center p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={handleCloseLightbox}
                            className="absolute top-4 right-4 z-10 rounded-md p-2 text-white transition-colors hover:text-gray-300 focus:outline focus:outline-2 focus:outline-white"
                            aria-label={t('accessibility.closeLightbox')}
                            data-testid="close-button"
                        >
                            <CloseIcon
                                size={32}
                                weight="bold"
                                className="text-white"
                                aria-hidden="true"
                            />
                        </button>

                        {/* Image Counter */}
                        <div
                            className="absolute top-4 left-4 rounded-md bg-black bg-opacity-50 px-3 py-1 font-medium text-sm text-white"
                            data-testid="image-counter"
                        >
                            {selectedIndex + 1} / {images.length}
                        </div>

                        {/* Main Lightbox Image */}
                        <img
                            src={currentImage.src}
                            alt={currentImage.alt}
                            className="max-h-full max-w-full object-contain"
                            data-testid="lightbox-image"
                        />

                        {/* Navigation Buttons - Only show if more than one image */}
                        {!isSingleImage && (
                            <>
                                {/* Previous Button */}
                                <button
                                    type="button"
                                    onClick={handlePrevious}
                                    className="-translate-y-1/2 absolute top-1/2 left-4 rounded-full bg-black bg-opacity-50 p-3 text-white transition-all hover:bg-opacity-70 hover:text-gray-300 focus:outline focus:outline-2 focus:outline-white"
                                    aria-label={t('accessibility.previousImage')}
                                    data-testid="prev-button"
                                >
                                    <PreviousIcon
                                        size={24}
                                        weight="bold"
                                        className="text-white"
                                        aria-hidden="true"
                                    />
                                </button>

                                {/* Next Button */}
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="-translate-y-1/2 absolute top-1/2 right-4 rounded-full bg-black bg-opacity-50 p-3 text-white transition-all hover:bg-opacity-70 hover:text-gray-300 focus:outline focus:outline-2 focus:outline-white"
                                    aria-label={t('accessibility.nextImage')}
                                    data-testid="next-button"
                                >
                                    <NextIcon
                                        size={24}
                                        weight="bold"
                                        className="text-white"
                                        aria-hidden="true"
                                    />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
