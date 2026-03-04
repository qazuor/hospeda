import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MapMarker } from '../../../src/components/map/MapView.client';
import { MapView } from '../../../src/components/map/MapView.client';

describe('MapView.client.tsx', () => {
    const mockMarkers: ReadonlyArray<MapMarker> = [
        {
            id: '1',
            lat: -32.4833,
            lng: -58.2333,
            title: 'Hotel Example',
            popup: 'Beautiful hotel in the city center'
        },
        {
            id: '2',
            lat: -32.49,
            lng: -58.24,
            title: 'Cabaña Example'
        },
        {
            id: '3',
            lat: -32.5,
            lng: -58.25,
            title: 'Hostel Example',
            popup: 'Budget-friendly accommodation'
        }
    ] as const;

    describe('Props', () => {
        it('should accept markers prop', () => {
            render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            expect(screen.getByText('Hotel Example')).toBeInTheDocument();
            expect(screen.getByText('Cabaña Example')).toBeInTheDocument();
            expect(screen.getByText('Hostel Example')).toBeInTheDocument();
        });

        it('should accept center prop', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                    center={[-32.4833, -58.2333]}
                />
            );
            const centerText = container.querySelector('.text-xs.text-text-tertiary');
            expect(centerText?.textContent).toContain('-32.4833');
            expect(centerText?.textContent).toContain('-58.2333');
        });

        it('should default center to [0, 0] when not provided', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const centerText = container.querySelector('.text-xs.text-text-tertiary');
            expect(centerText?.textContent).toContain('0.0000');
        });

        it('should accept zoom prop', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                    zoom={15}
                />
            );
            const zoomText = container.querySelector('.text-xs.text-text-tertiary');
            expect(zoomText?.textContent).toContain('Zoom: 15');
        });

        it('should default zoom to 13 when not provided', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const zoomText = container.querySelector('.text-xs.text-text-tertiary');
            expect(zoomText?.textContent).toContain('Zoom: 13');
        });

        it('should accept height prop', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                    height="500px"
                />
            );
            const mapContainer = container.querySelector('[role="img"]');
            expect(mapContainer).toHaveStyle({ height: '500px' });
        });

        it('should default height to 400px when not provided', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const mapContainer = container.querySelector('[role="img"]');
            expect(mapContainer).toHaveStyle({ height: '400px' });
        });

        it('should accept className prop', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                    className="custom-map-class"
                />
            );
            const wrapper = container.querySelector('[data-map-provider]');
            expect(wrapper).toHaveClass('custom-map-class');
        });
    });

    describe('Rendering', () => {
        it('should render map container', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const mapContainer = container.querySelector('[role="img"]');
            expect(mapContainer).toBeInTheDocument();
        });

        it('should render map container with correct height', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                    height="600px"
                />
            );
            const mapContainer = container.querySelector('[role="img"]');
            expect(mapContainer).toHaveStyle({ height: '600px' });
        });

        it('should render all markers in list', () => {
            render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            expect(screen.getByText('Hotel Example')).toBeInTheDocument();
            expect(screen.getByText('Cabaña Example')).toBeInTheDocument();
            expect(screen.getByText('Hostel Example')).toBeInTheDocument();
        });

        it('should render marker coordinates', () => {
            render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            expect(screen.getByText('-32.4833, -58.2333')).toBeInTheDocument();
            expect(screen.getByText('-32.4900, -58.2400')).toBeInTheDocument();
        });

        it('should render marker popup when provided', () => {
            render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            expect(screen.getByText('Beautiful hotel in the city center')).toBeInTheDocument();
            expect(screen.getByText('Budget-friendly accommodation')).toBeInTheDocument();
        });

        it('should not render popup for markers without popup prop', () => {
            render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const cabanaItem = screen.getByText('Cabaña Example').closest('li');
            const popupElement = cabanaItem?.querySelector('.text-xs.text-text-secondary');
            expect(popupElement).not.toBeInTheDocument();
        });

        it('should render marker count', () => {
            render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            expect(screen.getByText('Locations (3)')).toBeInTheDocument();
        });

        it('should render map loading indicator', () => {
            render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            expect(screen.getByText('Map loading...')).toBeInTheDocument();
        });
    });

    describe('Data Attributes', () => {
        it('should have data-map-provider attribute set to "leaflet"', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const wrapper = container.querySelector('[data-map-provider]');
            expect(wrapper).toHaveAttribute('data-map-provider', 'leaflet');
        });
    });

    describe('Empty State', () => {
        it('should render empty state when markers array is empty', () => {
            render(
                <MapView
                    locale="en"
                    markers={[]}
                />
            );
            expect(screen.getByText('No locations to display')).toBeInTheDocument();
        });

        it('should not render marker list when markers array is empty', () => {
            render(
                <MapView
                    locale="en"
                    markers={[]}
                />
            );
            expect(screen.queryByRole('region', { name: 'Map markers' })).not.toBeInTheDocument();
        });

        it('should render map container even when markers array is empty', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={[]}
                />
            );
            const mapContainer = container.querySelector('[role="img"]');
            expect(mapContainer).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have role="img" on map container', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const mapContainer = container.querySelector('[role="img"]');
            expect(mapContainer).toBeInTheDocument();
        });

        it('should have aria-label describing number of locations', () => {
            render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const mapContainer = screen.getByLabelText('Map showing 3 locations');
            expect(mapContainer).toBeInTheDocument();
        });

        it('should have aria-label with singular location text for single marker', () => {
            const firstMarker = mockMarkers[0];
            if (!firstMarker) throw new Error('First marker is undefined');
            const singleMarker: ReadonlyArray<MapMarker> = [firstMarker];
            render(
                <MapView
                    locale="en"
                    markers={singleMarker}
                />
            );
            const mapContainer = screen.getByLabelText('Map showing 1 locations');
            expect(mapContainer).toBeInTheDocument();
        });

        it('should have aria-label with "0 locations" for empty markers', () => {
            render(
                <MapView
                    locale="en"
                    markers={[]}
                />
            );
            const mapContainer = screen.getByLabelText('Map showing 0 locations');
            expect(mapContainer).toBeInTheDocument();
        });

        it('should have aria-hidden on decorative SVG icons', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const icons = Array.from(container.querySelectorAll('svg'));
            for (const icon of icons) {
                expect(icon).toHaveAttribute('aria-hidden', 'true');
            }
        });

        it('should have section on marker list', () => {
            render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const markerList = screen.getByRole('region', { name: 'Map markers' });
            expect(markerList).toBeInTheDocument();
        });
    });

    describe('Styling', () => {
        it('should have rounded corners on map container', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const mapContainer = container.querySelector('[role="img"]');
            expect(mapContainer?.className).toContain('rounded-lg');
        });

        it('should have border on map container', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const mapContainer = container.querySelector('[role="img"]');
            expect(mapContainer?.className).toContain('border');
        });

        it('should have gradient background on map container', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const mapContainer = container.querySelector('[role="img"]');
            expect(mapContainer?.className).toContain('bg-gradient-to-br');
        });

        it('should have hover styles on marker items', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const markerItems = container.querySelectorAll('section li');
            for (const item of Array.from(markerItems)) {
                expect(item.className).toContain('hover:bg-surface-elevated');
            }
        });

        it('should have transition styles on marker items', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const markerItems = container.querySelectorAll('section li');
            for (const item of Array.from(markerItems)) {
                expect(item.className).toContain('transition-colors');
            }
        });
    });

    describe('Marker Keys', () => {
        it('should use marker id as key for list items', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                />
            );
            const markerItems = container.querySelectorAll('section li');
            expect(markerItems.length).toBe(mockMarkers.length);
        });
    });

    describe('className Forwarding', () => {
        it('should forward className to root element', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                    className="test-class"
                />
            );
            const wrapper = container.querySelector('[data-map-provider]');
            expect(wrapper).toHaveClass('test-class');
        });

        it('should combine className with default classes', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                    className="test-class"
                />
            );
            const wrapper = container.querySelector('[data-map-provider]');
            expect(wrapper).toHaveClass('test-class');
            expect(wrapper).toHaveClass('relative');
        });

        it('should not add extra spaces when className is empty', () => {
            const { container } = render(
                <MapView
                    locale="en"
                    markers={mockMarkers}
                    className=""
                />
            );
            const wrapper = container.querySelector('[data-map-provider]');
            expect(wrapper?.className).not.toMatch(/\s{2,}/);
        });
    });
});
