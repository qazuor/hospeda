import { PremiumBlock } from '@/features/billing/PremiumBlock';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key
    })
}));

describe('PremiumBlock', () => {
    it('renders null when the items list is empty', () => {
        // Arrange — no premium-locked fields collected → no block.
        const { container } = render(<PremiumBlock items={[]} />);

        // Assert
        expect(container.firstChild).toBeNull();
    });

    it('renders the title, copy and CTA when there is at least one item', () => {
        // Arrange
        const items = [{ id: 'facebookUrl', label: 'Facebook', description: 'Tu URL pública.' }];

        // Act
        render(<PremiumBlock items={items} />);

        // Assert — i18n keys come through verbatim (mocked t).
        expect(screen.getByText('admin-entities.premiumBlock.title')).toBeInTheDocument();
        expect(screen.getByText('admin-entities.premiumBlock.description')).toBeInTheDocument();
        expect(screen.getByText('admin-entities.premiumBlock.cta')).toBeInTheDocument();
    });

    it('renders one row per item with label and optional description', () => {
        // Arrange — three social-network gates as in contact-info section.
        const items = [
            { id: 'facebookUrl', label: 'Facebook', description: 'Conectá tu página.' },
            { id: 'instagramUrl', label: 'Instagram' },
            { id: 'twitterUrl', label: 'X (Twitter)', description: 'Tu cuenta oficial.' }
        ];

        // Act
        render(<PremiumBlock items={items} />);

        // Assert — labels present.
        expect(screen.getByText('Facebook')).toBeInTheDocument();
        expect(screen.getByText('Instagram')).toBeInTheDocument();
        expect(screen.getByText('X (Twitter)')).toBeInTheDocument();
        // Descriptions present only when provided.
        expect(screen.getByText('Conectá tu página.')).toBeInTheDocument();
        expect(screen.getByText('Tu cuenta oficial.')).toBeInTheDocument();
        // Per-item testid hooks for E2E reach.
        expect(screen.getByTestId('premium-block-item-facebookUrl')).toBeInTheDocument();
        expect(screen.getByTestId('premium-block-item-instagramUrl')).toBeInTheDocument();
        expect(screen.getByTestId('premium-block-item-twitterUrl')).toBeInTheDocument();
    });

    it('uses the supplied upgrade URL when provided, defaults otherwise', () => {
        // Arrange — explicit URL overrides the default.
        const { rerender } = render(
            <PremiumBlock
                items={[{ id: 'a', label: 'Feature A' }]}
                upgradeUrl="/custom-upgrade"
            />
        );

        // Assert — CTA points at the custom URL.
        const customCta = screen.getByText('admin-entities.premiumBlock.cta').closest('a');
        expect(customCta).toHaveAttribute('href', '/custom-upgrade');

        // Default URL when omitted.
        rerender(<PremiumBlock items={[{ id: 'a', label: 'Feature A' }]} />);
        const defaultCta = screen.getByText('admin-entities.premiumBlock.cta').closest('a');
        expect(defaultCta).toHaveAttribute('href', '/billing/my-plan');
    });
});
