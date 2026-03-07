/**
 * @file image-carousel.test.tsx
 * @description Tests for ImageCarousel.client.tsx component.
 *
 * Covers rendering with zero, one, and multiple images; maxImages cap;
 * navigation arrows (prev/next); dot indicators; active index state;
 * view transition name on first image; and accessibility attributes.
 *
 * Note: CSS scroll behavior cannot be simulated in jsdom, so navigation
 * via arrow buttons is tested through state-driven rendering (goTo is
 * called directly by button onClick handlers).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageCarousel } from '../../../src/components/shared/ImageCarousel.client';

vi.mock('../../../src/hooks/useTranslation', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string, _params?: Record<string, unknown>) => fallback ?? key,
        tPlural: (key: string, _n: number, fallback?: string) => fallback ?? key
    })
}));

vi.mock('@repo/icons', () => ({
    ChevronLeftIcon: () => (
        <svg
            aria-hidden="true"
            data-icon="chevron-left"
        />
    ),
    ChevronRightIcon: () => (
        <svg
            aria-hidden="true"
            data-icon="chevron-right"
        />
    )
}));

// jsdom does not implement Element.prototype.scrollTo; provide a no-op.
beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
});

const threeImages = ['/img1.jpg', '/img2.jpg', '/img3.jpg'] as const;
const fiveImages = ['/a.jpg', '/b.jpg', '/c.jpg', '/d.jpg', '/e.jpg'] as const;
const sevenImages = ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg', '/6.jpg', '/7.jpg'] as const;

describe('ImageCarousel.client.tsx', () => {
    describe('Empty images fallback', () => {
        it('should render a placeholder image when images array is empty', () => {
            render(
                <ImageCarousel
                    images={[]}
                    alt="Test"
                    slug="test-slug"
                />
            );
            const img = screen.getByRole('img');
            expect(img).toHaveAttribute('src', '/images/placeholder-accommodation.svg');
            expect(img).toHaveAttribute('alt', 'Test');
        });

        it('should apply view transition name on the placeholder image', () => {
            render(
                <ImageCarousel
                    images={[]}
                    alt="Test"
                    slug="my-slug"
                />
            );
            const img = screen.getByRole('img');
            expect(img).toHaveStyle({ viewTransitionName: 'entity-my-slug' });
        });
    });

    describe('Single image', () => {
        it('should render the single image directly (no carousel wrapper)', () => {
            render(
                <ImageCarousel
                    images={['/solo.jpg']}
                    alt="Solo"
                    slug="solo"
                />
            );
            const img = screen.getByRole('img');
            expect(img).toHaveAttribute('src', '/solo.jpg');
            expect(img).toHaveAttribute('alt', 'Solo');
        });

        it('should not render any dot indicators for a single image', () => {
            render(
                <ImageCarousel
                    images={['/solo.jpg']}
                    alt="Solo"
                    slug="solo"
                />
            );
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        it('should apply view transition name on the single image', () => {
            render(
                <ImageCarousel
                    images={['/solo.jpg']}
                    alt="Solo"
                    slug="solo-slug"
                />
            );
            expect(screen.getByRole('img')).toHaveStyle({ viewTransitionName: 'entity-solo-slug' });
        });
    });

    describe('Multiple images - rendering', () => {
        it('should render all images as slides when within maxImages', () => {
            render(
                <ImageCarousel
                    images={threeImages}
                    alt="Room"
                    slug="room"
                />
            );
            const imgs = screen.getAllByRole('img');
            expect(imgs).toHaveLength(threeImages.length);
        });

        it('should render alt text as "{alt} {index+1}" for each slide', () => {
            render(
                <ImageCarousel
                    images={threeImages}
                    alt="Room"
                    slug="room"
                />
            );
            expect(screen.getByAltText('Room 1')).toBeInTheDocument();
            expect(screen.getByAltText('Room 2')).toBeInTheDocument();
            expect(screen.getByAltText('Room 3')).toBeInTheDocument();
        });

        it('should apply eager loading on the first image only', () => {
            render(
                <ImageCarousel
                    images={threeImages}
                    alt="Room"
                    slug="room"
                />
            );
            const imgs = screen.getAllByRole('img');
            expect(imgs[0]).toHaveAttribute('loading', 'eager');
            expect(imgs[1]).toHaveAttribute('loading', 'lazy');
        });

        it('should apply view transition name only to the first slide', () => {
            render(
                <ImageCarousel
                    images={threeImages}
                    alt="Room"
                    slug="room-slug"
                />
            );
            const imgs = screen.getAllByRole('img');
            expect(imgs[0]).toHaveStyle({ viewTransitionName: 'entity-room-slug' });
            expect(imgs[1]).not.toHaveStyle({ viewTransitionName: 'entity-room-slug' });
        });
    });

    describe('maxImages cap', () => {
        it('should render at most maxImages slides', () => {
            render(
                <ImageCarousel
                    images={sevenImages}
                    alt="Cap"
                    slug="cap"
                    maxImages={3}
                />
            );
            const imgs = screen.getAllByRole('img');
            expect(imgs).toHaveLength(3);
        });

        it('should default maxImages to 5', () => {
            render(
                <ImageCarousel
                    images={sevenImages}
                    alt="Max"
                    slug="max"
                />
            );
            const imgs = screen.getAllByRole('img');
            expect(imgs).toHaveLength(5);
        });
    });

    describe('Dot indicators', () => {
        it('should render one dot button per visible image', () => {
            render(
                <ImageCarousel
                    images={threeImages}
                    alt="Room"
                    slug="room"
                />
            );
            // 3 dots + at most 1 next arrow (since first image is active)
            const dotButtons = screen
                .getAllByRole('button')
                .filter((btn) =>
                    btn.getAttribute('aria-label')?.startsWith('accessibility.goToImage')
                );
            expect(dotButtons).toHaveLength(threeImages.length);
        });

        it('should have aria-label on each dot button', () => {
            render(
                <ImageCarousel
                    images={threeImages}
                    alt="Room"
                    slug="room"
                />
            );
            const dotButtons = screen
                .getAllByRole('button')
                .filter((btn) => btn.getAttribute('aria-label')?.includes('goToImage'));
            for (const dot of dotButtons) {
                expect(dot).toHaveAttribute('aria-label');
            }
        });

        it('should apply active (wider) class to the first dot by default', () => {
            render(
                <ImageCarousel
                    images={threeImages}
                    alt="Room"
                    slug="room"
                />
            );
            const allButtons = screen.getAllByRole('button');
            const firstDot = allButtons.find((btn) =>
                btn.getAttribute('aria-label')?.includes('goToImage')
            );
            expect(firstDot?.className).toContain('w-4');
        });

        it('should have type="button" on dot buttons', () => {
            render(
                <ImageCarousel
                    images={threeImages}
                    alt="Room"
                    slug="room"
                />
            );
            const dotButtons = screen
                .getAllByRole('button')
                .filter((btn) => btn.getAttribute('aria-label')?.includes('goToImage'));
            for (const dot of dotButtons) {
                expect(dot).toHaveAttribute('type', 'button');
            }
        });
    });

    describe('Navigation arrows', () => {
        it('should not show the prev arrow when on the first slide', () => {
            render(
                <ImageCarousel
                    images={threeImages}
                    alt="Room"
                    slug="room"
                />
            );
            expect(screen.queryByLabelText('accessibility.previousImage')).not.toBeInTheDocument();
        });

        it('should show the next arrow when on the first slide', () => {
            render(
                <ImageCarousel
                    images={threeImages}
                    alt="Room"
                    slug="room"
                />
            );
            expect(screen.getByLabelText('accessibility.nextImage')).toBeInTheDocument();
        });

        it('should have type="button" on the next arrow', () => {
            render(
                <ImageCarousel
                    images={threeImages}
                    alt="Room"
                    slug="room"
                />
            );
            expect(screen.getByLabelText('accessibility.nextImage')).toHaveAttribute(
                'type',
                'button'
            );
        });

        it('should navigate to second slide when a dot button is clicked', () => {
            render(
                <ImageCarousel
                    images={threeImages}
                    alt="Room"
                    slug="room"
                />
            );
            const allButtons = screen.getAllByRole('button');
            const secondDot = allButtons.filter((btn) =>
                btn.getAttribute('aria-label')?.includes('goToImage')
            )[1];

            if (!secondDot) throw new Error('Second dot not found');

            // jsdom does not support scrollTo, but clicking the dot calls goTo(1)
            // which sets activeIndex = 1, revealing the prev arrow
            fireEvent.click(secondDot);

            // After navigating to index 1, prev arrow should appear
            expect(screen.getByLabelText('accessibility.previousImage')).toBeInTheDocument();
        });

        it('should show prev arrow and hide next arrow when on last slide', () => {
            render(
                <ImageCarousel
                    images={threeImages}
                    alt="Room"
                    slug="room"
                />
            );
            const allButtons = screen.getAllByRole('button');
            const lastDot = allButtons.filter((btn) =>
                btn.getAttribute('aria-label')?.includes('goToImage')
            )[2];

            if (!lastDot) throw new Error('Last dot not found');

            fireEvent.click(lastDot);

            expect(screen.getByLabelText('accessibility.previousImage')).toBeInTheDocument();
            expect(screen.queryByLabelText('accessibility.nextImage')).not.toBeInTheDocument();
        });
    });

    describe('CSS structure', () => {
        it('should have scroll-snap classes on the scrollable container', () => {
            const { container } = render(
                <ImageCarousel
                    images={threeImages}
                    alt="Room"
                    slug="room"
                />
            );
            const scrollDiv = container.querySelector('.snap-x.snap-mandatory');
            expect(scrollDiv).toBeInTheDocument();
        });

        it('should have aspect-[4/3] class on the root carousel div', () => {
            const { container } = render(
                <ImageCarousel
                    images={threeImages}
                    alt="Room"
                    slug="room"
                />
            );
            const root = container.firstChild as HTMLElement;
            expect(root.className).toContain('aspect-[4/3]');
        });

        it('should apply bg-muted to the empty state container', () => {
            const { container } = render(
                <ImageCarousel
                    images={[]}
                    alt="Empty"
                    slug="empty"
                />
            );
            const root = container.firstChild as HTMLElement;
            expect(root.className).toContain('bg-muted');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-label on prev and next arrow buttons', () => {
            render(
                <ImageCarousel
                    images={fiveImages}
                    alt="Gallery"
                    slug="gallery"
                />
            );

            // Navigate to middle to reveal prev button
            const allButtons = screen.getAllByRole('button');
            const thirdDot = allButtons.filter((btn) =>
                btn.getAttribute('aria-label')?.includes('goToImage')
            )[2];

            if (!thirdDot) throw new Error('Third dot not found');
            fireEvent.click(thirdDot);

            expect(screen.getByLabelText('accessibility.previousImage')).toBeInTheDocument();
            expect(screen.getByLabelText('accessibility.nextImage')).toBeInTheDocument();
        });
    });
});
