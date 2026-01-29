/**
 * Tests for PageTabs Component
 *
 * Tests the page-level tab navigation (Level 3):
 * 1. Renders tabs from config
 * 2. Shows active state for current path
 * 3. Uses basePath for URL construction
 * 4. Supports labelKey translation
 * 5. Accessibility attributes
 */

import type { TabConfig } from '@/lib/sections/types';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Track current pathname for tests
let mockPathname = '/accommodations/123';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
    Link: ({
        to,
        children,
        className,
        role,
        ...props
    }: { to: string; children: ReactNode; className?: string; role?: string }) => (
        <a
            href={to}
            className={className}
            role={role}
            {...props}
        >
            {children}
        </a>
    ),
    useLocation: () => ({ pathname: mockPathname })
}));

// Mock translations
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'admin-tabs.overview': 'General',
                'admin-tabs.gallery': 'Gallery',
                'admin-tabs.amenities': 'Amenities',
                'admin-tabs.reviews': 'Reviews',
                'admin-tabs.pricing': 'Pricing'
            };
            return translations[key] || key;
        }
    })
}));

// Import after mocks
import {
    PageTabs,
    accommodationTabs,
    destinationTabs,
    eventTabs,
    postTabs,
    userTabs
} from '@/components/layout/PageTabs';

describe('PageTabs', () => {
    beforeEach(() => {
        mockPathname = '/accommodations/123';
    });

    describe('rendering', () => {
        it('should render tabs from config', () => {
            const tabs: TabConfig[] = [
                { id: 'overview', label: 'Overview', href: '' },
                { id: 'details', label: 'Details', href: '/details' }
            ];

            render(
                <PageTabs
                    tabs={tabs}
                    basePath="/test"
                />
            );

            expect(screen.getByText('Overview')).toBeInTheDocument();
            expect(screen.getByText('Details')).toBeInTheDocument();
        });

        it('should render tabs with labelKey using translations', () => {
            const tabs: TabConfig[] = [
                { id: 'overview', label: 'Fallback', labelKey: 'admin-tabs.overview', href: '' },
                {
                    id: 'gallery',
                    label: 'Fallback',
                    labelKey: 'admin-tabs.gallery',
                    href: '/gallery'
                }
            ];

            render(
                <PageTabs
                    tabs={tabs}
                    basePath="/test"
                />
            );

            expect(screen.getByText('General')).toBeInTheDocument();
            expect(screen.getByText('Gallery')).toBeInTheDocument();
        });

        it('should construct correct hrefs with basePath', () => {
            const tabs: TabConfig[] = [
                { id: 'overview', label: 'Overview', href: '' },
                { id: 'gallery', label: 'Gallery', href: '/gallery' }
            ];

            render(
                <PageTabs
                    tabs={tabs}
                    basePath="/accommodations/123"
                />
            );

            const overviewTab = screen.getByText('Overview').closest('a');
            const galleryTab = screen.getByText('Gallery').closest('a');

            expect(overviewTab).toHaveAttribute('href', '/accommodations/123');
            expect(galleryTab).toHaveAttribute('href', '/accommodations/123/gallery');
        });
    });

    describe('active state', () => {
        it('should mark current tab as active', () => {
            mockPathname = '/accommodations/123';

            const tabs: TabConfig[] = [
                { id: 'overview', label: 'Overview', href: '' },
                { id: 'gallery', label: 'Gallery', href: '/gallery' }
            ];

            render(
                <PageTabs
                    tabs={tabs}
                    basePath="/accommodations/123"
                />
            );

            const overviewTab = screen.getByText('Overview').closest('a');
            expect(overviewTab).toHaveAttribute('aria-selected', 'true');
            expect(overviewTab).toHaveAttribute('aria-current', 'page');
        });

        it('should not mark inactive tabs', () => {
            mockPathname = '/accommodations/123';

            const tabs: TabConfig[] = [
                { id: 'overview', label: 'Overview', href: '' },
                { id: 'gallery', label: 'Gallery', href: '/gallery' }
            ];

            render(
                <PageTabs
                    tabs={tabs}
                    basePath="/accommodations/123"
                />
            );

            const galleryTab = screen.getByText('Gallery').closest('a');
            expect(galleryTab).toHaveAttribute('aria-selected', 'false');
            expect(galleryTab).not.toHaveAttribute('aria-current');
        });

        it('should mark nested route tab as active', () => {
            mockPathname = '/accommodations/123/gallery';

            const tabs: TabConfig[] = [
                { id: 'overview', label: 'Overview', href: '' },
                { id: 'gallery', label: 'Gallery', href: '/gallery' }
            ];

            render(
                <PageTabs
                    tabs={tabs}
                    basePath="/accommodations/123"
                />
            );

            const galleryTab = screen.getByText('Gallery').closest('a');
            expect(galleryTab).toHaveAttribute('aria-selected', 'true');
        });
    });

    describe('accessibility', () => {
        it('should have tablist role on container', () => {
            const tabs: TabConfig[] = [{ id: 'test', label: 'Test', href: '' }];

            render(<PageTabs tabs={tabs} />);

            expect(screen.getByRole('tablist')).toBeInTheDocument();
        });

        it('should have tab role on each tab', () => {
            const tabs: TabConfig[] = [
                { id: 'tab1', label: 'Tab 1', href: '' },
                { id: 'tab2', label: 'Tab 2', href: '/tab2' }
            ];

            render(<PageTabs tabs={tabs} />);

            const tabElements = screen.getAllByRole('tab');
            expect(tabElements).toHaveLength(2);
        });

        it('should have aria-label on container', () => {
            const tabs: TabConfig[] = [{ id: 'test', label: 'Test', href: '' }];

            render(<PageTabs tabs={tabs} />);

            expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Page sections');
        });

        it('should have data-tab-id attribute', () => {
            const tabs: TabConfig[] = [
                { id: 'overview', label: 'Overview', href: '' },
                { id: 'gallery', label: 'Gallery', href: '/gallery' }
            ];

            render(<PageTabs tabs={tabs} />);

            expect(screen.getByText('Overview').closest('a')).toHaveAttribute(
                'data-tab-id',
                'overview'
            );
            expect(screen.getByText('Gallery').closest('a')).toHaveAttribute(
                'data-tab-id',
                'gallery'
            );
        });
    });

    describe('custom className', () => {
        it('should apply custom className to container', () => {
            const tabs: TabConfig[] = [{ id: 'test', label: 'Test', href: '' }];

            render(
                <PageTabs
                    tabs={tabs}
                    className="custom-class"
                />
            );

            // The className is applied to the div with role="tablist"
            expect(screen.getByRole('tablist')).toHaveClass('custom-class');
        });
    });

    describe('pre-defined tab configurations', () => {
        it('should export accommodationTabs', () => {
            expect(accommodationTabs).toBeDefined();
            expect(accommodationTabs).toHaveLength(5);
            expect(accommodationTabs.map((t) => t.id)).toEqual([
                'overview',
                'gallery',
                'amenities',
                'reviews',
                'pricing'
            ]);
        });

        it('should export destinationTabs', () => {
            expect(destinationTabs).toBeDefined();
            expect(destinationTabs).toHaveLength(4);
            expect(destinationTabs.map((t) => t.id)).toEqual([
                'overview',
                'attractions',
                'accommodations',
                'events'
            ]);
        });

        it('should export userTabs', () => {
            expect(userTabs).toBeDefined();
            expect(userTabs).toHaveLength(3);
            expect(userTabs.map((t) => t.id)).toEqual(['profile', 'permissions', 'activity']);
        });

        it('should export eventTabs', () => {
            expect(eventTabs).toBeDefined();
            expect(eventTabs).toHaveLength(3);
            expect(eventTabs.map((t) => t.id)).toEqual(['overview', 'tickets', 'attendees']);
        });

        it('should export postTabs', () => {
            expect(postTabs).toBeDefined();
            expect(postTabs).toHaveLength(3);
            expect(postTabs.map((t) => t.id)).toEqual(['content', 'seo', 'sponsorship']);
        });
    });

    describe('without basePath', () => {
        it('should use href directly when no basePath provided', () => {
            const tabs: TabConfig[] = [
                { id: 'overview', label: 'Overview', href: '/full/path' },
                { id: 'details', label: 'Details', href: '/full/path/details' }
            ];

            render(<PageTabs tabs={tabs} />);

            expect(screen.getByText('Overview').closest('a')).toHaveAttribute('href', '/full/path');
            expect(screen.getByText('Details').closest('a')).toHaveAttribute(
                'href',
                '/full/path/details'
            );
        });
    });
});
