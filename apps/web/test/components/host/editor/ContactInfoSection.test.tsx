/**
 * @file ContactInfoSection.test.tsx
 * @description Tests for the ContactInfoSection form component.
 *
 * Covers:
 * - Renders phone country selector + number field, email, website with
 *   initial values
 * - Parses an existing `data.phone` value into country + number
 * - Calls onFieldChange with the recomposed `phone` string when either the
 *   country or the number input changes
 * - Calls onFieldChange when email/website are modified
 * - Displays inline validation errors
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ContactInfoSectionProps } from '@/components/host/editor/ContactInfoSection.client';
import { ContactInfoSection } from '@/components/host/editor/ContactInfoSection.client';

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/components/host/editor/ContactInfoSection.module.css', () => ({
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
    phone: '+54 9 343 1111111',
    email: 'test@example.com',
    website: 'https://example.com',
    facebookUrl: '',
    instagramUrl: '',
    twitterUrl: '',
    linkedinUrl: '',
    tiktokUrl: '',
    youtubeUrl: ''
};

const DEFAULT_PROPS: ContactInfoSectionProps = {
    locale: 'es',
    data: MOCK_DATA,
    errors: {},
    onFieldChange: vi.fn()
};

describe('ContactInfoSection', () => {
    it('should render section title', () => {
        render(<ContactInfoSection {...DEFAULT_PROPS} />);
        expect(screen.getByText('Contacto')).toBeInTheDocument();
    });

    it('should render a country selector and a number input for phone', () => {
        render(<ContactInfoSection {...DEFAULT_PROPS} />);

        const countryInput = screen.getByLabelText(/país/i) as HTMLInputElement;
        expect(countryInput).toBeInTheDocument();
        expect(countryInput).toHaveAttribute('list');

        const numberInput = screen.getByLabelText(/número/i) as HTMLInputElement;
        expect(numberInput.type).toBe('tel');
    });

    it('should parse an existing phone value into country + number', () => {
        render(<ContactInfoSection {...DEFAULT_PROPS} />);

        const countryInput = screen.getByLabelText(/país/i) as HTMLInputElement;
        expect(countryInput.value).toBe('Argentina (+54)');

        const numberInput = screen.getByLabelText(/número/i) as HTMLInputElement;
        expect(numberInput.value).toBe('9 343 1111111');
    });

    it('should default to Argentina when the stored phone has no known dial code', () => {
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                data={{ ...MOCK_DATA, phone: '343 1111111' }}
            />
        );

        const countryInput = screen.getByLabelText(/país/i) as HTMLInputElement;
        expect(countryInput.value).toBe('Argentina (+54)');

        const numberInput = screen.getByLabelText(/número/i) as HTMLInputElement;
        expect(numberInput.value).toBe('343 1111111');
    });

    it('should not drop an empty phone value', () => {
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                data={{ ...MOCK_DATA, phone: '' }}
            />
        );

        const countryInput = screen.getByLabelText(/país/i) as HTMLInputElement;
        expect(countryInput.value).toBe('Argentina (+54)');

        const numberInput = screen.getByLabelText(/número/i) as HTMLInputElement;
        expect(numberInput.value).toBe('');
    });

    it('should recompose phone via onFieldChange when the number is modified', () => {
        const onFieldChange = vi.fn();
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        const numberInput = screen.getByLabelText(/número/i);
        fireEvent.change(numberInput, { target: { value: '9 343 2222222' } });

        expect(onFieldChange).toHaveBeenCalledWith('phone', '+54 9 343 2222222');
    });

    it('should recompose phone via onFieldChange when the country is changed', () => {
        const onFieldChange = vi.fn();
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        const countryInput = screen.getByLabelText(/país/i);
        fireEvent.change(countryInput, { target: { value: 'Uruguay (+598)' } });

        expect(onFieldChange).toHaveBeenCalledWith('phone', '+598 9 343 1111111');
    });

    it('should not call onFieldChange while the country query does not match a known country', () => {
        const onFieldChange = vi.fn();
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        const countryInput = screen.getByLabelText(/país/i);
        fireEvent.change(countryInput, { target: { value: 'Uru' } });

        expect(onFieldChange).not.toHaveBeenCalled();
    });

    it('should render email and website fields with initial values', () => {
        render(<ContactInfoSection {...DEFAULT_PROPS} />);

        const emailInput = screen.getByLabelText(/^email$/i) as HTMLInputElement;
        expect(emailInput.value).toBe('test@example.com');
        expect(emailInput.type).toBe('email');

        const websiteInput = screen.getByLabelText(/sitio web/i) as HTMLInputElement;
        expect(websiteInput.value).toBe('https://example.com');
        expect(websiteInput.type).toBe('url');
    });

    it('should call onFieldChange when email is modified', () => {
        const onFieldChange = vi.fn();
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        const emailInput = screen.getByLabelText(/^email$/i);
        fireEvent.change(emailInput, { target: { value: 'nuevo@example.com' } });

        expect(onFieldChange).toHaveBeenCalledWith('email', 'nuevo@example.com');
    });

    it('should call onFieldChange when website is modified', () => {
        const onFieldChange = vi.fn();
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        const websiteInput = screen.getByLabelText(/sitio web/i);
        fireEvent.change(websiteInput, { target: { value: 'https://nuevo.com' } });

        expect(onFieldChange).toHaveBeenCalledWith('website', 'https://nuevo.com');
    });

    it('should display validation error for phone on the number input', () => {
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                errors={{ phone: 'Formato inválido' }}
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent('Formato inválido');
        expect(screen.getByLabelText(/número/i)).toHaveAttribute('aria-invalid', 'true');
    });

    it('should display validation error for email', () => {
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                errors={{ email: 'Email inválido' }}
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent('Email inválido');
    });

    it('should display validation error for website', () => {
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                errors={{ website: 'URL inválida' }}
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent('URL inválida');
    });
});
