/**
 * @file AmenitiesSection.test.tsx
 * @description Tests for the AmenitiesSection form component.
 *
 * Covers (BETA-133):
 * - Amenities render grouped under collapsible category headers
 * - A category group's `<details>` toggles open/closed via its `<summary>`
 * - Toggling a checkbox still fires the onToggleAmenity/onToggleFeature handlers
 * - Features (no category data) still render as a single flat checkbox grid
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AmenitiesSectionProps } from '@/components/host/editor/AmenitiesSection.client';
import { AmenitiesSection } from '@/components/host/editor/AmenitiesSection.client';
import type { AccommodationEditData, AmenityData } from '@/lib/api/types';

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string) => fallback ?? key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/catalog-names', () => ({
    translateAmenityName: ({ name }: { readonly name: string }) => name
}));

vi.mock('@/components/host/editor/AmenitiesSection.module.css', () => ({
    default: new Proxy({}, { get: (_target, prop) => String(prop) })
}));

const MOCK_DATA: AccommodationEditData = {
    id: 'acc-1',
    name: 'Test',
    summary: 'Test summary for accommodation',
    description: 'Test description',
    type: 'HOTEL',
    destinationId: 'dest-1',
    latitude: null,
    longitude: null,
    maxGuests: 2,
    bedrooms: 1,
    bathrooms: 1,
    beds: 1,
    basePrice: 1000,
    currency: 'ARS',
    isAvailable: true,
    isFeatured: false,
    amenityIds: [],
    featureIds: [],
    phone: '',
    email: '',
    website: '',
    facebookUrl: '',
    instagramUrl: '',
    twitterUrl: '',
    linkedinUrl: '',
    tiktokUrl: '',
    youtubeUrl: ''
};

const MOCK_AMENITIES: readonly AmenityData[] = [
    { id: 'am-wifi', slug: 'wifi', category: 'CONNECTIVITY' },
    { id: 'am-pool', slug: 'pool', category: 'OUTDOORS' },
    { id: 'am-safe', slug: 'safe', category: 'SAFETY' },
    { id: 'am-unknown', slug: 'mystery', category: 'NOT_A_REAL_CATEGORY' },
    { id: 'am-null', slug: 'orphan', category: null }
];

const MOCK_FEATURES: readonly AmenityData[] = [
    { id: 'ft-river', slug: 'river_front', category: null }
];

function buildProps(overrides: Partial<AmenitiesSectionProps> = {}): AmenitiesSectionProps {
    return {
        locale: 'es',
        data: MOCK_DATA,
        amenities: MOCK_AMENITIES,
        features: MOCK_FEATURES,
        onToggleAmenity: vi.fn(),
        onToggleFeature: vi.fn(),
        ...overrides
    };
}

describe('AmenitiesSection', () => {
    it('should render the section title', () => {
        render(<AmenitiesSection {...buildProps()} />);
        expect(screen.getByText('Servicios y comodidades')).toBeInTheDocument();
    });

    it('should group amenities under their category headers', () => {
        render(<AmenitiesSection {...buildProps()} />);

        expect(screen.getByText('Conectividad')).toBeInTheDocument();
        expect(screen.getByText('Exteriores')).toBeInTheDocument();
        expect(screen.getByText('Seguridad')).toBeInTheDocument();
        expect(screen.getByText('wifi')).toBeInTheDocument();
        expect(screen.getByText('pool')).toBeInTheDocument();
        expect(screen.getByText('safe')).toBeInTheDocument();
    });

    it('should fall back unrecognized/null categories to the "Otros" group', () => {
        render(<AmenitiesSection {...buildProps()} />);

        expect(screen.getByText('Otros')).toBeInTheDocument();
        expect(screen.getByText('mystery')).toBeInTheDocument();
        expect(screen.getByText('orphan')).toBeInTheDocument();
    });

    it('should render each category group as a collapsible <details>/<summary>', () => {
        const { container } = render(<AmenitiesSection {...buildProps()} />);

        const detailsElements = container.querySelectorAll('details');
        expect(detailsElements.length).toBeGreaterThan(0);

        for (const details of detailsElements) {
            expect(details.querySelector('summary')).not.toBeNull();
        }
    });

    it('should default-expand a category with a selected item', () => {
        const { container } = render(
            <AmenitiesSection
                {...buildProps({
                    data: { ...MOCK_DATA, amenityIds: ['am-safe'] }
                })}
            />
        );

        const safeGroup = Array.from(container.querySelectorAll('details')).find((details) =>
            details.textContent?.includes('Seguridad')
        );
        expect(safeGroup).toBeDefined();
        expect((safeGroup as HTMLDetailsElement).open).toBe(true);
    });

    it('should show a selected-count badge on a category with selections', () => {
        render(
            <AmenitiesSection
                {...buildProps({
                    data: { ...MOCK_DATA, amenityIds: ['am-safe'] }
                })}
            />
        );

        expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should toggle a group open/closed when its summary is clicked', () => {
        // am-unknown lives in the "Otros" bucket, so selecting it makes that
        // group default-open regardless of its position in the display order.
        const { container } = render(
            <AmenitiesSection
                {...buildProps({ data: { ...MOCK_DATA, amenityIds: ['am-unknown'] } })}
            />
        );

        const otherGroup = Array.from(container.querySelectorAll('details')).find((details) =>
            details.textContent?.includes('Otros')
        ) as HTMLDetailsElement;
        const summary = otherGroup.querySelector('summary') as HTMLElement;

        expect(otherGroup.open).toBe(true);

        fireEvent.click(summary);
        expect(otherGroup.open).toBe(false);

        fireEvent.click(summary);
        expect(otherGroup.open).toBe(true);
    });

    it('should call onToggleAmenity when an amenity checkbox is clicked', () => {
        const onToggleAmenity = vi.fn();
        render(<AmenitiesSection {...buildProps({ onToggleAmenity })} />);

        const checkbox = screen.getByRole('checkbox', { name: 'wifi' });
        fireEvent.click(checkbox);

        expect(onToggleAmenity).toHaveBeenCalledWith('am-wifi');
    });

    it('should reflect selected amenity ids as checked', () => {
        render(
            <AmenitiesSection
                {...buildProps({ data: { ...MOCK_DATA, amenityIds: ['am-wifi'] } })}
            />
        );

        expect(screen.getByRole('checkbox', { name: 'wifi' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'pool' })).not.toBeChecked();
    });

    it('should render features as a flat checkbox grid (no category grouping)', () => {
        const { container } = render(<AmenitiesSection {...buildProps()} />);

        // Features have no category data, so they must not be wrapped in <details>.
        const featureCheckbox = screen.getByRole('checkbox', { name: 'river_front' });
        expect(featureCheckbox.closest('details')).toBeNull();
        expect(container.querySelector('details')).not.toBeNull(); // amenities still grouped
    });

    it('should call onToggleFeature when a feature checkbox is clicked', () => {
        const onToggleFeature = vi.fn();
        render(<AmenitiesSection {...buildProps({ onToggleFeature })} />);

        const checkbox = screen.getByRole('checkbox', { name: 'river_front' });
        fireEvent.click(checkbox);

        expect(onToggleFeature).toHaveBeenCalledWith('ft-river');
    });

    it('should render nothing for amenities/features when both lists are empty', () => {
        const { container } = render(
            <AmenitiesSection {...buildProps({ amenities: [], features: [] })} />
        );

        expect(container.querySelector('details')).toBeNull();
        expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    });
});
