/**
 * @file PricingSection.test.tsx
 * @description Tests for the PricingSection form component.
 *
 * Covers (BETA-137):
 * - Renders the basePrice input with its initial value and wires
 *   onFieldChange.
 * - Does NOT render an interactive currency select (multi-currency is not
 *   implemented yet) — no combobox role and the old `acc-currency` id are
 *   both absent.
 * - Renders a static, read-only ARS currency indicator instead.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PricingSectionProps } from '@/components/host/editor/PricingSection.client';
import { PricingSection } from '@/components/host/editor/PricingSection.client';

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/components/host/editor/PricingSection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

const MOCK_DATA = {
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

const DEFAULT_PROPS: PricingSectionProps = {
    locale: 'es',
    data: MOCK_DATA,
    errors: {},
    onFieldChange: vi.fn()
};

describe('PricingSection', () => {
    it('should render section title', () => {
        render(<PricingSection {...DEFAULT_PROPS} />);
        expect(screen.getByText('Precio')).toBeInTheDocument();
    });

    it('should render the basePrice input with its initial value', () => {
        render(<PricingSection {...DEFAULT_PROPS} />);

        const priceInput = screen.getByLabelText(/precio por noche/i) as HTMLInputElement;
        expect(priceInput.value).toBe('1000');
        expect(priceInput.type).toBe('number');
    });

    it('should call onFieldChange when basePrice is modified', () => {
        const onFieldChange = vi.fn();
        render(
            <PricingSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        const priceInput = screen.getByLabelText(/precio por noche/i);
        fireEvent.change(priceInput, { target: { value: '1500' } });

        expect(onFieldChange).toHaveBeenCalledWith('basePrice', 1500);
    });

    it('should display validation error for basePrice', () => {
        render(
            <PricingSection
                {...DEFAULT_PROPS}
                errors={{ basePrice: 'El precio debe ser un número positivo' }}
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent(
            'El precio debe ser un número positivo'
        );
        expect(screen.getByLabelText(/precio por noche/i)).toHaveAttribute('aria-invalid', 'true');
    });

    it('should NOT render an interactive currency select (BETA-137)', () => {
        render(<PricingSection {...DEFAULT_PROPS} />);

        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(document.getElementById('acc-currency')).not.toBeInTheDocument();
    });

    it('should render a static ARS currency indicator instead', () => {
        render(<PricingSection {...DEFAULT_PROPS} />);

        expect(screen.getByText('Moneda')).toBeInTheDocument();
        expect(screen.getByText('ARS — Peso argentino')).toBeInTheDocument();
    });
});
