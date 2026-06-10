/**
 * @file ContactInfoSection.test.tsx
 * @description Tests for the ContactInfoSection form component.
 *
 * Covers:
 * - Renders phone, email, website fields with initial values
 * - Calls onFieldChange when fields are modified
 * - Displays inline validation errors
 */

import { ContactInfoSection } from '@/components/host/editor/ContactInfoSection.client';
import type { ContactInfoSectionProps } from '@/components/host/editor/ContactInfoSection.client';
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

    it('should render phone, email, and website fields with initial values', () => {
        render(<ContactInfoSection {...DEFAULT_PROPS} />);

        const phoneInput = screen.getByLabelText(/teléfono/i) as HTMLInputElement;
        expect(phoneInput.value).toBe('+54 9 343 1111111');
        expect(phoneInput.type).toBe('tel');

        const emailInput = screen.getByLabelText(/^email$/i) as HTMLInputElement;
        expect(emailInput.value).toBe('test@example.com');
        expect(emailInput.type).toBe('email');

        const websiteInput = screen.getByLabelText(/sitio web/i) as HTMLInputElement;
        expect(websiteInput.value).toBe('https://example.com');
        expect(websiteInput.type).toBe('url');
    });

    it('should call onFieldChange when phone is modified', () => {
        const onFieldChange = vi.fn();
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        const phoneInput = screen.getByLabelText(/teléfono/i);
        fireEvent.change(phoneInput, { target: { value: '+54 9 343 2222222' } });

        expect(onFieldChange).toHaveBeenCalledWith('phone', '+54 9 343 2222222');
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

    it('should display validation error for phone', () => {
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                errors={{ phone: 'Formato inválido' }}
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent('Formato inválido');
        expect(screen.getByLabelText(/teléfono/i)).toHaveAttribute('aria-invalid', 'true');
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
