// @vitest-environment jsdom
/**
 * HOS-2058: the accommodation amenities tab renders the real `amenities`
 * relation, grouped by type, with badges only for declared scope/availability.
 * `useTranslations` is not mocked: amenity names resolve via trans (es).
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The global @repo/icons mock (test/setup.tsx) has no getAmenityTypeIcon.
vi.mock('@repo/icons', () => ({
    getAmenityTypeIcon: () => () => <svg data-testid="type-icon" />
}));

import { AccommodationAmenitiesList } from '../AccommodationAmenitiesList';

const amenities = [
    {
        id: 'a1',
        slug: 'air_conditioning',
        type: 'CLIMATE_CONTROL',
        scope: 'private',
        availability: 'year_round'
    },
    { id: 'a2', slug: 'wifi', type: 'CONNECTIVITY', scope: null, availability: null },
    { id: 'a3', slug: 'heating', type: 'CLIMATE_CONTROL', scope: 'shared', availability: null },
    { id: 'a4', slug: 'pool', type: 'OUTDOORS', scope: null, availability: 'seasonal' }
] as const;

describe('AccommodationAmenitiesList', () => {
    it('renders the amenities with translated names', () => {
        render(<AccommodationAmenitiesList amenities={amenities} />);
        expect(screen.getByText('Aire acondicionado')).toBeTruthy();
        expect(screen.getByText('WiFi')).toBeTruthy();
    });

    it('groups amenities by type', () => {
        render(<AccommodationAmenitiesList amenities={amenities} />);
        const climate = screen.getByTestId('amenity-group-CLIMATE_CONTROL');
        expect(within(climate).getByText('Aire acondicionado')).toBeTruthy();
        expect(within(climate).getByText('Calefacción')).toBeTruthy();
        expect(within(climate).queryByText('WiFi')).toBeNull();
        expect(screen.getByTestId('amenity-group-CONNECTIVITY')).toBeTruthy();
    });

    it('shows badges only for declared scope and availability', () => {
        render(<AccommodationAmenitiesList amenities={amenities} />);
        // The admin test setup mocks the translator to echo keys.
        const prefix = 'accommodations.amenityAttributes';
        expect(screen.getByText(`${prefix}.scope.private`)).toBeTruthy();
        expect(screen.getByText(`${prefix}.scope.shared`)).toBeTruthy();
        expect(screen.getByText(`${prefix}.availability.yearRound`)).toBeTruthy();
        expect(screen.getByText(`${prefix}.availability.seasonal`)).toBeTruthy();
        // Undeclared (null/null) renders only the name, no badge.
        const wifiRow = screen.getByText('WiFi').closest('li');
        expect(wifiRow?.children.length).toBe(1);
    });
});
