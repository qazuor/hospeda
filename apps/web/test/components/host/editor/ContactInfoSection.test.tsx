/**
 * @file ContactInfoSection.test.tsx
 * @description Tests for the ContactInfoSection form component.
 *
 * Covers:
 * - Renders the phone country combobox trigger + number field, the WhatsApp
 *   country combobox + number field, email, and website with initial values
 * - Parses an existing `data.phone` / `data.whatsapp` value into country + number
 * - Calls onFieldChange with the recomposed `phone` / `whatsapp` string when either
 *   the country (via CountryCodeCombobox) or the number input changes
 * - Calls onFieldChange when email/website are modified
 * - Displays inline validation errors
 *
 * The phone and WhatsApp fields share the "País" / "Número" sub-labels, so each
 * is wrapped in its own <fieldset> whose <legend> ("Teléfono" / "WhatsApp") is
 * the accessible group name. Queries are scoped to the relevant group to avoid
 * cross-field ambiguity (the same disambiguation an assistive-tech user relies on).
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
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

vi.mock('@/components/host/editor/CountryCodeCombobox.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('@repo/icons', () => ({
    ChevronDownIcon: ({ size }: { size: number }) => (
        <svg
            data-testid="chevron-down-icon"
            width={size}
        />
    ),
    SearchIcon: ({ size }: { size: number }) => (
        <svg
            data-testid="search-icon"
            width={size}
        />
    )
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
    whatsapp: '',
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

/** Scope queries to the phone <fieldset> (legend "Teléfono"). */
function phoneGroup() {
    return within(screen.getByRole('group', { name: /^teléfono$/i }));
}

/** Scope queries to the WhatsApp <fieldset> (legend "WhatsApp"). */
function whatsappGroup() {
    return within(screen.getByRole('group', { name: /^whatsapp$/i }));
}

describe('ContactInfoSection', () => {
    it('should render section title', () => {
        render(<ContactInfoSection {...DEFAULT_PROPS} />);
        expect(screen.getByText('Contacto')).toBeInTheDocument();
    });

    it('should render a country combobox trigger and a number input for phone', () => {
        render(<ContactInfoSection {...DEFAULT_PROPS} />);

        const countryTrigger = phoneGroup().getByRole('button', { name: /argentina/i });
        expect(countryTrigger).toBeInTheDocument();
        expect(countryTrigger).toHaveAttribute('aria-haspopup', 'listbox');

        const numberInput = phoneGroup().getByLabelText(/número/i) as HTMLInputElement;
        expect(numberInput.type).toBe('tel');
    });

    it('should parse an existing phone value into country + number', () => {
        render(<ContactInfoSection {...DEFAULT_PROPS} />);

        expect(phoneGroup().getByRole('button', { name: /argentina/i })).toHaveTextContent(
            'Argentina (+54)'
        );

        const numberInput = phoneGroup().getByLabelText(/número/i) as HTMLInputElement;
        expect(numberInput.value).toBe('9 343 1111111');
    });

    it('should default to Argentina when the stored phone has no known dial code', () => {
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                data={{ ...MOCK_DATA, phone: '343 1111111' }}
            />
        );

        expect(phoneGroup().getByRole('button', { name: /argentina/i })).toHaveTextContent(
            'Argentina (+54)'
        );

        const numberInput = phoneGroup().getByLabelText(/número/i) as HTMLInputElement;
        expect(numberInput.value).toBe('343 1111111');
    });

    it('should not drop an empty phone value', () => {
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                data={{ ...MOCK_DATA, phone: '' }}
            />
        );

        expect(phoneGroup().getByRole('button', { name: /argentina/i })).toHaveTextContent(
            'Argentina (+54)'
        );

        const numberInput = phoneGroup().getByLabelText(/número/i) as HTMLInputElement;
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

        const numberInput = phoneGroup().getByLabelText(/número/i);
        fireEvent.change(numberInput, { target: { value: '9 343 2222222' } });

        expect(onFieldChange).toHaveBeenCalledWith('phone', '+54 9 343 2222222');
    });

    it('should recompose phone via onFieldChange when a country is selected from the combobox', () => {
        const onFieldChange = vi.fn();
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        // The combobox trigger lives inside the phone fieldset; the dropdown
        // listbox is portaled to document.body, so options are queried globally
        // (only the phone combobox is open, so the match is unambiguous).
        fireEvent.click(phoneGroup().getByRole('button', { name: /argentina/i }));
        fireEvent.mouseDown(screen.getByRole('option', { name: /uruguay/i }));

        expect(onFieldChange).toHaveBeenCalledWith('phone', '+598 9 343 1111111');
        expect(phoneGroup().getByRole('button', { name: /uruguay/i })).toHaveTextContent(
            'Uruguay (+598)'
        );
    });

    it('should not call onFieldChange while only searching the combobox without selecting', () => {
        const onFieldChange = vi.fn();
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        // Trigger is in-group; the portaled search combobox is queried globally.
        fireEvent.click(phoneGroup().getByRole('button', { name: /argentina/i }));
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Uru' } });

        expect(onFieldChange).not.toHaveBeenCalled();
    });

    it('should render a country combobox trigger and a number input for WhatsApp', () => {
        render(<ContactInfoSection {...DEFAULT_PROPS} />);

        const countryTrigger = whatsappGroup().getByRole('button', { name: /argentina/i });
        expect(countryTrigger).toBeInTheDocument();
        expect(countryTrigger).toHaveAttribute('aria-haspopup', 'listbox');

        const numberInput = whatsappGroup().getByLabelText(/número/i) as HTMLInputElement;
        expect(numberInput.type).toBe('tel');
    });

    it('should parse an existing whatsapp value into country + number', () => {
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                data={{ ...MOCK_DATA, whatsapp: '+598 9 343 3333333' }}
            />
        );

        expect(whatsappGroup().getByRole('button', { name: /uruguay/i })).toHaveTextContent(
            'Uruguay (+598)'
        );

        const numberInput = whatsappGroup().getByLabelText(/número/i) as HTMLInputElement;
        expect(numberInput.value).toBe('9 343 3333333');
    });

    it('should recompose whatsapp via onFieldChange when the number is modified', () => {
        const onFieldChange = vi.fn();
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        const numberInput = whatsappGroup().getByLabelText(/número/i);
        fireEvent.change(numberInput, { target: { value: '9 343 4444444' } });

        expect(onFieldChange).toHaveBeenCalledWith('whatsapp', '+54 9 343 4444444');
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
        expect(phoneGroup().getByLabelText(/número/i)).toHaveAttribute('aria-invalid', 'true');
    });

    it('should display validation error for whatsapp on the number input', () => {
        render(
            <ContactInfoSection
                {...DEFAULT_PROPS}
                errors={{ whatsapp: 'Formato inválido' }}
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent('Formato inválido');
        expect(whatsappGroup().getByLabelText(/número/i)).toHaveAttribute('aria-invalid', 'true');
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
