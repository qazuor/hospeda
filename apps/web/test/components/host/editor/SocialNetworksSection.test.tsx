/**
 * @file SocialNetworksSection.test.tsx
 * @description Tests for the SocialNetworksSection form component.
 *
 * Covers:
 * - Renders all 6 social network handle fields with their domain prefix
 * - Parses a stored full URL back to just the handle
 * - Falls back to showing the raw value when a stored URL doesn't match the
 *   expected domain (nothing hidden/lost)
 * - Composes the full URL via onFieldChange when a handle is typed
 * - Displays inline validation errors
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SocialNetworksSectionProps } from '@/components/host/editor/SocialNetworksSection.client';
import { SocialNetworksSection } from '@/components/host/editor/SocialNetworksSection.client';

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/components/host/editor/SocialNetworksSection.module.css', () => ({
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
    facebookUrl: 'https://facebook.com/test',
    instagramUrl: 'https://www.instagram.com/testuser',
    twitterUrl: '',
    linkedinUrl: '',
    tiktokUrl: '',
    youtubeUrl: ''
};

const DEFAULT_PROPS: SocialNetworksSectionProps = {
    locale: 'es',
    data: MOCK_DATA,
    errors: {},
    onFieldChange: vi.fn()
};

describe('SocialNetworksSection', () => {
    it('should render section title', () => {
        render(<SocialNetworksSection {...DEFAULT_PROPS} />);
        expect(screen.getByText('Redes sociales')).toBeInTheDocument();
    });

    it('should render all 6 social network fields', () => {
        render(<SocialNetworksSection {...DEFAULT_PROPS} />);

        expect(screen.getByLabelText(/facebook/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/instagram/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/twitter/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/linkedin/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/tiktok/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/youtube/i)).toBeInTheDocument();
    });

    it('should render the fixed domain prefix for each network', () => {
        render(<SocialNetworksSection {...DEFAULT_PROPS} />);

        expect(screen.getByText('facebook.com/')).toBeInTheDocument();
        expect(screen.getByText('instagram.com/')).toBeInTheDocument();
        expect(screen.getByText('x.com/')).toBeInTheDocument();
        expect(screen.getByText('linkedin.com/in/')).toBeInTheDocument();
        expect(screen.getByText('tiktok.com/@')).toBeInTheDocument();
        expect(screen.getByText('youtube.com/@')).toBeInTheDocument();
    });

    it('should parse a stored full URL down to just the handle', () => {
        render(<SocialNetworksSection {...DEFAULT_PROPS} />);

        const facebookInput = screen.getByLabelText(/facebook/i) as HTMLInputElement;
        expect(facebookInput.value).toBe('test');

        const instagramInput = screen.getByLabelText(/instagram/i) as HTMLInputElement;
        expect(instagramInput.value).toBe('testuser');

        const twitterInput = screen.getByLabelText(/twitter/i) as HTMLInputElement;
        expect(twitterInput.value).toBe('');
    });

    it('should show the raw stored value when it does not match the expected domain', () => {
        render(
            <SocialNetworksSection
                {...DEFAULT_PROPS}
                data={{ ...MOCK_DATA, facebookUrl: 'https://not-facebook.example.com/test' }}
            />
        );

        const facebookInput = screen.getByLabelText(/facebook/i) as HTMLInputElement;
        expect(facebookInput.value).toBe('https://not-facebook.example.com/test');
    });

    it('should not save a bare domain when the handle is cleared', () => {
        const onFieldChange = vi.fn();
        render(
            <SocialNetworksSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        const facebookInput = screen.getByLabelText(/facebook/i);
        fireEvent.change(facebookInput, { target: { value: '' } });

        expect(onFieldChange).toHaveBeenCalledWith('facebookUrl', '');
    });

    it('should compose the full URL via onFieldChange when a handle is typed', () => {
        const onFieldChange = vi.fn();
        render(
            <SocialNetworksSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        const twitterInput = screen.getByLabelText(/twitter/i);
        fireEvent.change(twitterInput, { target: { value: 'mi-usuario' } });

        expect(onFieldChange).toHaveBeenCalledWith('twitterUrl', 'https://x.com/mi-usuario');
    });

    it('should display validation error for a specific social field', () => {
        render(
            <SocialNetworksSection
                {...DEFAULT_PROPS}
                errors={{ facebookUrl: 'URL de Facebook inválida' }}
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent('URL de Facebook inválida');
        expect(screen.getByLabelText(/facebook/i)).toHaveAttribute('aria-invalid', 'true');
    });

    it('should set all handle input types to text', () => {
        render(<SocialNetworksSection {...DEFAULT_PROPS} />);

        expect(screen.getByLabelText(/facebook/i)).toHaveAttribute('type', 'text');
        expect(screen.getByLabelText(/instagram/i)).toHaveAttribute('type', 'text');
        expect(screen.getByLabelText(/twitter/i)).toHaveAttribute('type', 'text');
        expect(screen.getByLabelText(/linkedin/i)).toHaveAttribute('type', 'text');
        expect(screen.getByLabelText(/tiktok/i)).toHaveAttribute('type', 'text');
        expect(screen.getByLabelText(/youtube/i)).toHaveAttribute('type', 'text');
    });
});
