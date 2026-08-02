/**
 * @file SocialNetworksSection.test.tsx
 * @description Unit coverage for the commerce editor's social section (HOS-258).
 *
 * @module test/components/commerce/editor/SocialNetworksSection
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SocialNetworksSection } from '../../../../src/components/commerce/editor/SocialNetworksSection.client';

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? `[MISSING:${key}]`
    })
}));

const emptySocial = {
    facebook: '',
    instagram: '',
    twitter: '',
    tiktok: '',
    youtube: '',
    linkedIn: ''
};

function renderSection(
    overrides: Partial<React.ComponentProps<typeof SocialNetworksSection>> = {}
): { onSocialChange: ReturnType<typeof vi.fn> } {
    const onSocialChange = vi.fn();
    render(
        <SocialNetworksSection
            locale="es"
            social={emptySocial}
            errors={{}}
            onSocialChange={onSocialChange}
            {...overrides}
        />
    );
    return { onSocialChange };
}

describe('SocialNetworksSection', () => {
    it('renders one input per network, linkedIn included (SPEC-253 AC-4)', () => {
        renderSection();

        for (const key of ['facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'linkedIn']) {
            expect(screen.getByLabelText(key)).toBeInTheDocument();
        }
        expect(document.querySelectorAll('input')).toHaveLength(6);
    });

    it('seeds each input from the social prop', () => {
        renderSection({
            social: { ...emptySocial, facebook: 'https://facebook.com/x' }
        });

        expect(screen.getByLabelText('facebook')).toHaveValue('https://facebook.com/x');
        expect(screen.getByLabelText('instagram')).toHaveValue('');
    });

    it('reports an edit as a single keyed change', () => {
        const { onSocialChange } = renderSection();

        fireEvent.change(screen.getByLabelText('instagram'), {
            target: { value: 'https://instagram.com/y' }
        });

        expect(onSocialChange).toHaveBeenCalledWith('instagram', 'https://instagram.com/y');
    });

    it('lowercases linkedIn in its placeholder host', () => {
        renderSection();

        // The state key is camelCase but the domain is not — a naive
        // `https://${key}.com` would print "https://linkedIn.com/...".
        expect(screen.getByLabelText('linkedIn')).toHaveAttribute(
            'placeholder',
            'https://linkedin.com/...'
        );
        expect(screen.getByLabelText('facebook')).toHaveAttribute(
            'placeholder',
            'https://facebook.com/...'
        );
    });

    it('surfaces a dotted-key error on the matching field only', () => {
        renderSection({ errors: { 'socialNetworks.tiktok': 'URL inválida' } });

        expect(screen.getByText('URL inválida')).toBeInTheDocument();
        expect(screen.getByLabelText('tiktok')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('youtube')).toHaveAttribute('aria-invalid', 'false');
    });

    it('renders the scrollspy anchor the section nav will target', () => {
        renderSection();

        expect(document.getElementById('editor-socialNetworks')).not.toBeNull();
    });
});
