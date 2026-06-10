/**
 * @file LocationSection.test.tsx
 * @description Tests for the LocationSection form component.
 *
 * Covers:
 * - Renders latitude and longitude fields with initial values
 * - Calls onFieldChange when fields are modified
 * - Displays inline validation errors
 * - Shows hint text
 */

import { LocationSection } from '@/components/host/editor/LocationSection.client';
import type { LocationSectionProps } from '@/components/host/editor/LocationSection.client';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/components/host/editor/LocationSection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

const MOCK_DATA = {
    id: 'acc-1',
    name: 'Test',
    summary: 'Test summary for accommodation',
    description: 'Test description',
    type: 'HOTEL',
    destinationId: 'dest-1',
    latitude: -32.47,
    longitude: -58.23,
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

const DEFAULT_PROPS: LocationSectionProps = {
    locale: 'es',
    data: MOCK_DATA,
    errors: {},
    onFieldChange: vi.fn()
};

describe('LocationSection', () => {
    it('should render section title', () => {
        render(<LocationSection {...DEFAULT_PROPS} />);
        expect(screen.getByText('Ubicación')).toBeInTheDocument();
    });

    it('should render latitude and longitude fields with initial values', () => {
        render(<LocationSection {...DEFAULT_PROPS} />);

        const latInput = screen.getByLabelText(/latitud/i) as HTMLInputElement;
        expect(latInput.value).toBe('-32.47');
        expect(latInput.type).toBe('number');

        const lngInput = screen.getByLabelText(/longitud/i) as HTMLInputElement;
        expect(lngInput.value).toBe('-58.23');
        expect(lngInput.type).toBe('number');
    });

    it('should render empty fields when coordinates are null', () => {
        const dataWithNullCoords = { ...MOCK_DATA, latitude: null, longitude: null };
        render(
            <LocationSection
                {...DEFAULT_PROPS}
                data={dataWithNullCoords}
            />
        );

        const latInput = screen.getByLabelText(/latitud/i) as HTMLInputElement;
        expect(latInput.value).toBe('');

        const lngInput = screen.getByLabelText(/longitud/i) as HTMLInputElement;
        expect(lngInput.value).toBe('');
    });

    it('should call onFieldChange when latitude is modified', () => {
        const onFieldChange = vi.fn();
        render(
            <LocationSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        const latInput = screen.getByLabelText(/latitud/i);
        fireEvent.change(latInput, { target: { value: '-33.0' } });

        expect(onFieldChange).toHaveBeenCalledWith('latitude', -33);
    });

    it('should call onFieldChange when longitude is modified', () => {
        const onFieldChange = vi.fn();
        render(
            <LocationSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        const lngInput = screen.getByLabelText(/longitud/i);
        fireEvent.change(lngInput, { target: { value: '-59.0' } });

        expect(onFieldChange).toHaveBeenCalledWith('longitude', -59);
    });

    it('should call onFieldChange with null when field is cleared', () => {
        const onFieldChange = vi.fn();
        render(
            <LocationSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        const latInput = screen.getByLabelText(/latitud/i);
        fireEvent.change(latInput, { target: { value: '' } });

        expect(onFieldChange).toHaveBeenCalledWith('latitude', null);
    });

    it('should display validation error for latitude', () => {
        render(
            <LocationSection
                {...DEFAULT_PROPS}
                errors={{ latitude: 'Latitud inválida' }}
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent('Latitud inválida');
        expect(screen.getByLabelText(/latitud/i)).toHaveAttribute('aria-invalid', 'true');
    });

    it('should display validation error for longitude', () => {
        render(
            <LocationSection
                {...DEFAULT_PROPS}
                errors={{ longitude: 'Longitud inválida' }}
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent('Longitud inválida');
    });

    it('should show hint text', () => {
        render(<LocationSection {...DEFAULT_PROPS} />);
        expect(
            screen.getByText('Ingresá las coordenadas exactas de tu propiedad.')
        ).toBeInTheDocument();
    });

    it('should set correct min/max attributes on inputs', () => {
        render(<LocationSection {...DEFAULT_PROPS} />);

        const latInput = screen.getByLabelText(/latitud/i);
        expect(latInput).toHaveAttribute('min', '-90');
        expect(latInput).toHaveAttribute('max', '90');

        const lngInput = screen.getByLabelText(/longitud/i);
        expect(lngInput).toHaveAttribute('min', '-180');
        expect(lngInput).toHaveAttribute('max', '180');
    });
});
