import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImageGallery } from '../../../src/components/ui/ImageGallery.client';
import type { GalleryImage } from '../../../src/components/ui/ImageGallery.client';

const mockImages: ReadonlyArray<GalleryImage> = [
    { src: '/image1.jpg', alt: 'Image 1' },
    { src: '/image2.jpg', alt: 'Image 2' },
    { src: '/image3.jpg', alt: 'Image 3' }
];

const singleImage: ReadonlyArray<GalleryImage> = [{ src: '/single.jpg', alt: 'Single Image' }];

describe('ImageGallery.client.tsx', () => {
    describe('Props', () => {
        it('should accept images prop', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            expect(screen.getByTestId('image-gallery')).toBeInTheDocument();
        });

        it('should accept className prop', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    className="custom-class"
                    locale="en"
                />
            );
            const gallery = screen.getByTestId('image-gallery');
            expect(gallery).toHaveClass('custom-class');
        });

        it('should handle empty images array gracefully', () => {
            render(
                <ImageGallery
                    images={[]}
                    locale="en"
                />
            );
            expect(screen.getByText('No images available')).toBeInTheDocument();
        });
    });

    describe('Rendering', () => {
        it('should render main image', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            const mainImage = screen.getByTestId('main-image');
            expect(mainImage).toBeInTheDocument();
            expect(mainImage).toHaveAttribute('src', mockImages[0]!.src);
            expect(mainImage).toHaveAttribute('alt', mockImages[0]!.alt);
        });

        it('should render thumbnail strip for multiple images', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            expect(screen.getByTestId('thumbnail-strip')).toBeInTheDocument();
        });

        it('should not render thumbnail strip for single image', () => {
            render(
                <ImageGallery
                    images={singleImage}
                    locale="en"
                />
            );
            expect(screen.queryByTestId('thumbnail-strip')).not.toBeInTheDocument();
        });

        it('should render correct number of thumbnails', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            const thumbnails = screen.getAllByTestId(/^thumbnail-\d+$/);
            expect(thumbnails).toHaveLength(mockImages.length);
        });

        it('should render all thumbnails with correct src and alt', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            for (const [index, image] of mockImages.entries()) {
                const thumbnail = screen.getByTestId(`thumbnail-${index}`);
                const img = thumbnail.querySelector('img');
                expect(img).toHaveAttribute('src', image.src);
                expect(img).toHaveAttribute('alt', image.alt);
            }
        });

        it('should not render lightbox by default', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );
            expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument();
        });
    });

    describe('Thumbnail Navigation', () => {
        it('should change main image when thumbnail is clicked', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const thumbnail = screen.getByTestId('thumbnail-1');
            fireEvent.click(thumbnail);

            const mainImage = screen.getByTestId('main-image');
            expect(mainImage).toHaveAttribute('src', mockImages[1]!.src);
            expect(mainImage).toHaveAttribute('alt', mockImages[1]!.alt);
        });

        it('should apply active styles to selected thumbnail', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const firstThumbnail = screen.getByTestId('thumbnail-0');
            expect(firstThumbnail.className).toContain('border-primary');
        });

        it('should update active thumbnail when clicked', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const secondThumbnail = screen.getByTestId('thumbnail-1');
            fireEvent.click(secondThumbnail);

            expect(secondThumbnail.className).toContain('border-primary');
            expect(secondThumbnail).toHaveAttribute('aria-pressed', 'true');
        });

        it('should have aria-pressed="true" on selected thumbnail', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const firstThumbnail = screen.getByTestId('thumbnail-0');
            expect(firstThumbnail).toHaveAttribute('aria-pressed', 'true');
        });

        it('should have aria-pressed="false" on non-selected thumbnails', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const secondThumbnail = screen.getByTestId('thumbnail-1');
            expect(secondThumbnail).toHaveAttribute('aria-pressed', 'false');
        });
    });

    describe('Lightbox', () => {
        it('should open lightbox when main image is clicked', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            expect(screen.getByTestId('lightbox')).toBeInTheDocument();
        });

        it('should display lightbox image with correct src and alt', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const lightboxImage = screen.getByTestId('lightbox-image');
            expect(lightboxImage).toHaveAttribute('src', mockImages[0]!.src);
            expect(lightboxImage).toHaveAttribute('alt', mockImages[0]!.alt);
        });

        it('should display close button in lightbox', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            expect(screen.getByTestId('close-button')).toBeInTheDocument();
            expect(screen.getByLabelText('Close lightbox')).toBeInTheDocument();
        });

        it('should display image counter in lightbox', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const counter = screen.getByTestId('image-counter');
            expect(counter).toBeInTheDocument();
            expect(counter).toHaveTextContent('1 / 3');
        });

        it('should close lightbox when close button is clicked', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const closeButton = screen.getByTestId('close-button');
            fireEvent.click(closeButton);

            expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument();
        });

        it('should close lightbox when overlay is clicked', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const lightbox = screen.getByTestId('lightbox');
            fireEvent.click(lightbox);

            expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument();
        });

        it('should not close lightbox when image is clicked', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const lightboxImage = screen.getByTestId('lightbox-image');
            fireEvent.click(lightboxImage);

            expect(screen.getByTestId('lightbox')).toBeInTheDocument();
        });
    });

    describe('Lightbox Navigation', () => {
        it('should display previous and next buttons for multiple images', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            expect(screen.getByTestId('prev-button')).toBeInTheDocument();
            expect(screen.getByTestId('next-button')).toBeInTheDocument();
        });

        it('should not display navigation buttons for single image', () => {
            render(
                <ImageGallery
                    images={singleImage}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            expect(screen.queryByTestId('prev-button')).not.toBeInTheDocument();
            expect(screen.queryByTestId('next-button')).not.toBeInTheDocument();
        });

        it('should navigate to next image when next button is clicked', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const nextButton = screen.getByTestId('next-button');
            fireEvent.click(nextButton);

            const lightboxImage = screen.getByTestId('lightbox-image');
            expect(lightboxImage).toHaveAttribute('src', mockImages[1]!.src);

            const counter = screen.getByTestId('image-counter');
            expect(counter).toHaveTextContent('2 / 3');
        });

        it('should navigate to previous image when previous button is clicked', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const nextButton = screen.getByTestId('next-button');
            fireEvent.click(nextButton);

            const prevButton = screen.getByTestId('prev-button');
            fireEvent.click(prevButton);

            const lightboxImage = screen.getByTestId('lightbox-image');
            expect(lightboxImage).toHaveAttribute('src', mockImages[0]!.src);

            const counter = screen.getByTestId('image-counter');
            expect(counter).toHaveTextContent('1 / 3');
        });

        it('should wrap to last image when clicking previous on first image', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const prevButton = screen.getByTestId('prev-button');
            fireEvent.click(prevButton);

            const lightboxImage = screen.getByTestId('lightbox-image');
            expect(lightboxImage).toHaveAttribute('src', mockImages[2]!.src);

            const counter = screen.getByTestId('image-counter');
            expect(counter).toHaveTextContent('3 / 3');
        });

        it('should wrap to first image when clicking next on last image', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const nextButton = screen.getByTestId('next-button');
            fireEvent.click(nextButton);
            fireEvent.click(nextButton);
            fireEvent.click(nextButton);

            const lightboxImage = screen.getByTestId('lightbox-image');
            expect(lightboxImage).toHaveAttribute('src', mockImages[0]!.src);

            const counter = screen.getByTestId('image-counter');
            expect(counter).toHaveTextContent('1 / 3');
        });
    });

    describe('Keyboard Navigation', () => {
        it('should close lightbox when Escape key is pressed', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            fireEvent.keyDown(window, { key: 'Escape' });

            expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument();
        });

        it('should navigate to next image when ArrowRight is pressed', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            fireEvent.keyDown(window, { key: 'ArrowRight' });

            const lightboxImage = screen.getByTestId('lightbox-image');
            expect(lightboxImage).toHaveAttribute('src', mockImages[1]!.src);
        });

        it('should navigate to previous image when ArrowLeft is pressed', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            fireEvent.keyDown(window, { key: 'ArrowRight' });
            fireEvent.keyDown(window, { key: 'ArrowLeft' });

            const lightboxImage = screen.getByTestId('lightbox-image');
            expect(lightboxImage).toHaveAttribute('src', mockImages[0]!.src);
        });

        it('should not respond to keyboard when lightbox is closed', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            fireEvent.keyDown(window, { key: 'ArrowRight' });

            const mainImage = screen.getByTestId('main-image');
            expect(mainImage).toHaveAttribute('src', mockImages[0]!.src);
        });

        it('should wrap navigation with keyboard arrows', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            fireEvent.keyDown(window, { key: 'ArrowLeft' });

            const lightboxImage = screen.getByTestId('lightbox-image');
            expect(lightboxImage).toHaveAttribute('src', mockImages[2]!.src);
        });
    });

    describe('Accessibility', () => {
        it('should have aria-label on main image button', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            const button = mainImage.parentElement;
            expect(button).toHaveAttribute('aria-label', 'Open image in fullscreen');
        });

        it('should have aria-label on thumbnails', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const thumbnail = screen.getByTestId('thumbnail-0');
            expect(thumbnail).toHaveAttribute('aria-label', 'View Image 1');
        });

        it('should have aria-label on close button', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            expect(screen.getByLabelText('Close lightbox')).toBeInTheDocument();
        });

        it('should have aria-label on navigation buttons', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            expect(screen.getByLabelText('Previous image')).toBeInTheDocument();
            expect(screen.getByLabelText('Next image')).toBeInTheDocument();
        });

        it('should have aria-hidden on SVG icons', () => {
            const { container } = render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const svgElements = Array.from(container.querySelectorAll('svg'));
            for (const svg of svgElements) {
                expect(svg).toHaveAttribute('aria-hidden', 'true');
            }
        });

        it('should have focus-visible styles on main image button', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            const button = mainImage.parentElement;
            expect(button?.className).toContain('focus:outline');
        });

        it('should have focus-visible styles on thumbnails', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const thumbnail = screen.getByTestId('thumbnail-0');
            expect(thumbnail.className).toContain('focus:outline');
        });

        it('should have focus-visible styles on lightbox buttons', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const closeButton = screen.getByTestId('close-button');
            expect(closeButton.className).toContain('focus:outline');

            const prevButton = screen.getByTestId('prev-button');
            expect(prevButton.className).toContain('focus:outline');

            const nextButton = screen.getByTestId('next-button');
            expect(nextButton.className).toContain('focus:outline');
        });
    });

    describe('Button Attributes', () => {
        it('should have type="button" on all buttons', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            const mainButton = mainImage.parentElement as HTMLButtonElement;
            expect(mainButton).toHaveAttribute('type', 'button');

            const thumbnail = screen.getByTestId('thumbnail-0');
            expect(thumbnail).toHaveAttribute('type', 'button');

            fireEvent.click(mainImage);

            const closeButton = screen.getByTestId('close-button');
            expect(closeButton).toHaveAttribute('type', 'button');

            const prevButton = screen.getByTestId('prev-button');
            expect(prevButton).toHaveAttribute('type', 'button');

            const nextButton = screen.getByTestId('next-button');
            expect(nextButton).toHaveAttribute('type', 'button');
        });

        it('should not be disabled by default', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            const mainButton = mainImage.parentElement as HTMLButtonElement;
            expect(mainButton).not.toBeDisabled();

            const thumbnail = screen.getByTestId('thumbnail-0');
            expect(thumbnail).not.toBeDisabled();
        });
    });

    describe('Image Counter', () => {
        it('should display correct counter format', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const counter = screen.getByTestId('image-counter');
            expect(counter.textContent).toMatch(/^\d+ \/ \d+$/);
        });

        it('should update counter when navigating', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const nextButton = screen.getByTestId('next-button');
            fireEvent.click(nextButton);

            const counter = screen.getByTestId('image-counter');
            expect(counter).toHaveTextContent('2 / 3');
        });

        it('should show counter for single image', () => {
            render(
                <ImageGallery
                    images={singleImage}
                    locale="en"
                />
            );

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const counter = screen.getByTestId('image-counter');
            expect(counter).toHaveTextContent('1 / 1');
        });
    });

    describe('Edge Cases', () => {
        it('should handle rapid thumbnail clicks', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const thumbnail0 = screen.getByTestId('thumbnail-0');
            const thumbnail1 = screen.getByTestId('thumbnail-1');
            const thumbnail2 = screen.getByTestId('thumbnail-2');

            fireEvent.click(thumbnail1);
            fireEvent.click(thumbnail2);
            fireEvent.click(thumbnail0);

            const mainImage = screen.getByTestId('main-image');
            expect(mainImage).toHaveAttribute('src', mockImages[0]!.src);
        });

        it('should maintain selected image when opening lightbox', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const thumbnail1 = screen.getByTestId('thumbnail-1');
            fireEvent.click(thumbnail1);

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const lightboxImage = screen.getByTestId('lightbox-image');
            expect(lightboxImage).toHaveAttribute('src', mockImages[1]!.src);
        });

        it('should maintain selected image after closing and reopening lightbox', () => {
            render(
                <ImageGallery
                    images={mockImages}
                    locale="en"
                />
            );

            const thumbnail2 = screen.getByTestId('thumbnail-2');
            fireEvent.click(thumbnail2);

            const mainImage = screen.getByTestId('main-image');
            fireEvent.click(mainImage);

            const closeButton = screen.getByTestId('close-button');
            fireEvent.click(closeButton);

            fireEvent.click(mainImage);

            const lightboxImage = screen.getByTestId('lightbox-image');
            expect(lightboxImage).toHaveAttribute('src', mockImages[2]!.src);
        });
    });
});
