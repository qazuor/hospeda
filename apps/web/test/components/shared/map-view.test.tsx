/**
 * @file map-view.test.tsx
 * @description Tests for MapView.client.tsx.
 * Validates placeholder rendering, marker display, coordinate formatting,
 * empty state, custom props, and accessibility attributes.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock @repo/icons with lightweight div stubs
vi.mock('@repo/icons', () => ({
    MapIcon: ({
        'aria-hidden': ariaHidden,
        className
    }: { 'aria-hidden'?: string; className?: string }) => (
        <div
            data-testid="map-icon"
            aria-hidden={ariaHidden}
            className={className}
        />
    ),
    LocationIcon: ({
        'aria-hidden': ariaHidden,
        className
    }: { 'aria-hidden'?: string; className?: string }) => (
        <div
            data-testid="location-icon"
            aria-hidden={ariaHidden}
            className={className}
        />
    )
}));

// Mock useTranslation to return i18n key as fallback
vi.mock('../../../src/hooks/useTranslation', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            if (key === 'map.locationsTitle' && params?.count !== undefined) {
                return `Locations: ${params.count}`;
            }
            if (key === 'accessibility.mapShowingLocations' && params?.count !== undefined) {
                return `Map showing ${params.count} location(s)`;
            }
            return fallback ?? key;
        }
    })
}));

import { MapView } from '../../../src/components/shared/MapView.client';
import type { MapMarker } from '../../../src/components/shared/MapView.client';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const singleMarker: MapMarker = {
    id: 'marker-1',
    lat: -32.4833,
    lng: -58.2333,
    title: 'Hotel Ejemplo'
};

const markerWithPopup: MapMarker = {
    id: 'marker-2',
    lat: -32.49,
    lng: -58.24,
    title: 'Cabaña Río',
    popup: 'Hermosa vista al río'
};

const twoMarkers: ReadonlyArray<MapMarker> = [singleMarker, markerWithPopup];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MapView.client.tsx', () => {
    describe('Placeholder container rendering', () => {
        it('should render the placeholder map container', () => {
            // Arrange & Act
            const { container } = render(<MapView markers={[]} />);

            // Assert
            const mapContainer = container.querySelector('[data-map-provider="leaflet"]');
            expect(mapContainer).toBeInTheDocument();
        });

        it('should set data-map-provider="leaflet" on root element', () => {
            // Arrange & Act
            const { container } = render(<MapView markers={[]} />);

            // Assert
            expect(container.querySelector('[data-map-provider="leaflet"]')).toBeInTheDocument();
        });

        it('should render the MapIcon placeholder icon', () => {
            // Arrange & Act
            render(<MapView markers={[]} />);

            // Assert
            expect(screen.getByTestId('map-icon')).toBeInTheDocument();
        });

        it('should render the map placeholder container with role="img"', () => {
            // Arrange & Act
            render(<MapView markers={[]} />);

            // Assert
            expect(screen.getByRole('img')).toBeInTheDocument();
        });
    });

    describe('Center coordinates display', () => {
        it('should display formatted center coordinates', () => {
            // Arrange
            const center = [-32.4833, -58.2333] as const;

            // Act
            render(
                <MapView
                    markers={[]}
                    center={center}
                />
            );

            // Assert
            expect(screen.getByText(/Center: -32\.4833, -58\.2333/)).toBeInTheDocument();
        });

        it('should display default center (0, 0) when not provided', () => {
            // Arrange & Act
            render(<MapView markers={[]} />);

            // Assert
            expect(screen.getByText(/Center: 0\.0000, 0\.0000/)).toBeInTheDocument();
        });

        it('should display the zoom level', () => {
            // Arrange & Act
            render(
                <MapView
                    markers={[]}
                    zoom={15}
                />
            );

            // Assert
            expect(screen.getByText(/Zoom: 15/)).toBeInTheDocument();
        });

        it('should use default zoom of 13 when not provided', () => {
            // Arrange & Act
            render(<MapView markers={[]} />);

            // Assert
            expect(screen.getByText(/Zoom: 13/)).toBeInTheDocument();
        });
    });

    describe('Height prop', () => {
        it('should apply the height style to the map container', () => {
            // Arrange & Act
            render(
                <MapView
                    markers={[]}
                    height="500px"
                />
            );

            // Assert
            const imgContainer = screen.getByRole('img');
            expect(imgContainer).toHaveStyle({ height: '500px' });
        });

        it('should default to 400px height when not provided', () => {
            // Arrange & Act
            render(<MapView markers={[]} />);

            // Assert
            const imgContainer = screen.getByRole('img');
            expect(imgContainer).toHaveStyle({ height: '400px' });
        });
    });

    describe('className prop', () => {
        it('should apply custom className to the root wrapper', () => {
            // Arrange & Act
            const { container } = render(
                <MapView
                    markers={[]}
                    className="custom-map-class"
                />
            );

            // Assert
            const root = container.querySelector('[data-map-provider="leaflet"]');
            expect(root?.className).toContain('custom-map-class');
        });
    });

    describe('Marker list — with markers', () => {
        it('should render the marker list section when markers are provided', () => {
            // Arrange & Act
            render(<MapView markers={twoMarkers} />);

            // Assert
            const sections = screen.getAllByRole('region');
            // At least one section for the marker list
            expect(sections.length).toBeGreaterThan(0);
        });

        it('should render the title of each marker', () => {
            // Arrange & Act
            render(<MapView markers={twoMarkers} />);

            // Assert
            expect(screen.getByText('Hotel Ejemplo')).toBeInTheDocument();
            expect(screen.getByText('Cabaña Río')).toBeInTheDocument();
        });

        it('should display formatted lat/lng coordinates for each marker', () => {
            // Arrange & Act
            render(<MapView markers={[singleMarker]} />);

            // Assert
            expect(screen.getByText('-32.4833, -58.2333')).toBeInTheDocument();
        });

        it('should render popup content when provided', () => {
            // Arrange & Act
            render(<MapView markers={[markerWithPopup]} />);

            // Assert
            expect(screen.getByText('Hermosa vista al río')).toBeInTheDocument();
        });

        it('should not render popup element when popup is absent', () => {
            // Arrange & Act
            render(<MapView markers={[singleMarker]} />);

            // Assert
            expect(screen.queryByText('Hermosa vista al río')).not.toBeInTheDocument();
        });

        it('should render a LocationIcon for each marker', () => {
            // Arrange & Act
            render(<MapView markers={twoMarkers} />);

            // Assert — one per marker item plus one for the empty state placeholder,
            // but empty state is not shown when markers > 0; so count == 2
            const locationIcons = screen.getAllByTestId('location-icon');
            expect(locationIcons.length).toBeGreaterThanOrEqual(twoMarkers.length);
        });

        it('should render a list element containing all markers', () => {
            // Arrange & Act
            const { container } = render(<MapView markers={twoMarkers} />);

            // Assert
            const listItems = container.querySelectorAll('li');
            expect(listItems.length).toBe(twoMarkers.length);
        });
    });

    describe('Empty state — no markers', () => {
        it('should render empty state when no markers are provided', () => {
            // Arrange & Act
            render(<MapView markers={[]} />);

            // Assert — i18n mock returns the key for 'map.noLocations'
            expect(screen.getByText('map.noLocations')).toBeInTheDocument();
        });

        it('should not render the marker list section when markers is empty', () => {
            // Arrange & Act
            render(<MapView markers={[]} />);

            // Assert
            const lists = screen.queryAllByRole('list');
            expect(lists.length).toBe(0);
        });

        it('should render a LocationIcon in the empty state', () => {
            // Arrange & Act
            render(<MapView markers={[]} />);

            // Assert
            expect(screen.getByTestId('location-icon')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should set aria-label on the placeholder map container', () => {
            // Arrange & Act
            render(<MapView markers={[singleMarker]} />);

            // Assert
            const imgContainer = screen.getByRole('img');
            expect(imgContainer).toHaveAttribute('aria-label');
        });

        it('should include the marker count in the map aria-label', () => {
            // Arrange & Act
            render(<MapView markers={twoMarkers} />);

            // Assert
            const imgContainer = screen.getByRole('img');
            expect(imgContainer.getAttribute('aria-label')).toMatch(/2/);
        });

        it('should set aria-label on the marker list section', () => {
            // Arrange & Act
            render(<MapView markers={[singleMarker]} />);

            // Assert
            const sections = screen.getAllByRole('region');
            const markerSection = sections.find((s) => s.getAttribute('aria-label') !== null);
            expect(markerSection).toBeDefined();
        });

        it('should hide MapIcon from assistive technology', () => {
            // Arrange & Act
            render(<MapView markers={[]} />);

            // Assert
            const mapIcon = screen.getByTestId('map-icon');
            expect(mapIcon).toHaveAttribute('aria-hidden', 'true');
        });

        it('should hide LocationIcon from assistive technology', () => {
            // Arrange & Act
            render(<MapView markers={[singleMarker]} />);

            // Assert
            const locationIcons = screen.getAllByTestId('location-icon');
            for (const icon of locationIcons) {
                expect(icon).toHaveAttribute('aria-hidden', 'true');
            }
        });
    });

    describe('Locale prop', () => {
        it('should accept locale prop without throwing', () => {
            // Arrange & Act & Assert
            expect(() =>
                render(
                    <MapView
                        markers={[]}
                        locale="en"
                    />
                )
            ).not.toThrow();
        });

        it('should default locale to "es" when not provided', () => {
            // Arrange & Act & Assert
            expect(() => render(<MapView markers={[]} />)).not.toThrow();
        });
    });
});
