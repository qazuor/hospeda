/**
 * @file SocialNetworksSection.test.tsx
 * @description Tests for the SocialNetworksSection form component.
 *
 * Covers:
 * - Renders all 6 social network URL fields with initial values
 * - Calls onFieldChange when fields are modified
 * - Displays inline validation errors
 */

import { SocialNetworksSection } from '@/components/host/editor/SocialNetworksSection.client';
import type { SocialNetworksSectionProps } from '@/components/host/editor/SocialNetworksSection.client';
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
    instagramUrl: 'https://instagram.com/test',
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

    it('should display initial values for populated fields', () => {
        render(<SocialNetworksSection {...DEFAULT_PROPS} />);

        const facebookInput = screen.getByLabelText(/facebook/i) as HTMLInputElement;
        expect(facebookInput.value).toBe('https://facebook.com/test');

        const instagramInput = screen.getByLabelText(/instagram/i) as HTMLInputElement;
        expect(instagramInput.value).toBe('https://instagram.com/test');

        const twitterInput = screen.getByLabelText(/twitter/i) as HTMLInputElement;
        expect(twitterInput.value).toBe('');
    });

    it('should call onFieldChange when a field is modified', () => {
        const onFieldChange = vi.fn();
        render(
            <SocialNetworksSection
                {...DEFAULT_PROPS}
                onFieldChange={onFieldChange}
            />
        );

        const twitterInput = screen.getByLabelText(/twitter/i);
        fireEvent.change(twitterInput, { target: { value: 'https://x.com/test' } });

        expect(onFieldChange).toHaveBeenCalledWith('twitterUrl', 'https://x.com/test');
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

    it('should set all input types to url', () => {
        render(<SocialNetworksSection {...DEFAULT_PROPS} />);

        expect(screen.getByLabelText(/facebook/i)).toHaveAttribute('type', 'url');
        expect(screen.getByLabelText(/instagram/i)).toHaveAttribute('type', 'url');
        expect(screen.getByLabelText(/twitter/i)).toHaveAttribute('type', 'url');
        expect(screen.getByLabelText(/linkedin/i)).toHaveAttribute('type', 'url');
        expect(screen.getByLabelText(/tiktok/i)).toHaveAttribute('type', 'url');
        expect(screen.getByLabelText(/youtube/i)).toHaveAttribute('type', 'url');
    });
});
