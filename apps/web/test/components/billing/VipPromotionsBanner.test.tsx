/**
 * VipPromotionsBanner Component Tests
 *
 * Tests for the VIP promotions banner with entitlement gating
 *
 * @module test/components/billing/VipPromotionsBanner.test
 */

import { VipPromotionsBanner } from '@/components/billing/VipPromotionsBanner';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock @qazuor/qzpay-react
vi.mock('@qazuor/qzpay-react', () => ({
    EntitlementGate: ({
        children,
        fallback
    }: {
        children: React.ReactNode;
        fallback: React.ReactNode;
    }) => {
        // Default to showing fallback for easier testing
        const showContent = (global as any).__MOCK_HAS_ENTITLEMENT__ === true;
        return <>{showContent ? children : fallback}</>;
    }
}));

describe('VipPromotionsBanner', () => {
    describe('when user does NOT have VIP access', () => {
        it('should render upgrade fallback', () => {
            (global as any).__MOCK_HAS_ENTITLEMENT__ = false;

            render(<VipPromotionsBanner />);

            // Should show fallback message
            expect(screen.getByText('Promociones VIP exclusivas')).toBeInTheDocument();
            expect(screen.getByText(/Tourist VIP/)).toBeInTheDocument();
            expect(
                screen.getByText(/descuentos y ofertas exclusivas de alojamientos/)
            ).toBeInTheDocument();
        });

        it('should render upgrade link in fallback', () => {
            (global as any).__MOCK_HAS_ENTITLEMENT__ = false;

            render(<VipPromotionsBanner />);

            const upgradeLink = screen.getByRole('link', { name: /Ver planes/ });
            expect(upgradeLink).toBeInTheDocument();
            expect(upgradeLink).toHaveAttribute('href', '/precios/turistas');
        });
    });

    describe('when user HAS VIP access', () => {
        it('should render VIP promotions content', () => {
            (global as any).__MOCK_HAS_ENTITLEMENT__ = true;

            render(<VipPromotionsBanner />);

            // Should show VIP content
            expect(screen.getByText('Promociones VIP Disponibles')).toBeInTheDocument();
            expect(
                screen.getByText(/Accedé a descuentos y ofertas exclusivas/)
            ).toBeInTheDocument();
        });

        it('should render link to promotions page', () => {
            (global as any).__MOCK_HAS_ENTITLEMENT__ = true;

            render(<VipPromotionsBanner />);

            const promotionsLink = screen.getByRole('link', {
                name: /Ver promociones/
            });
            expect(promotionsLink).toBeInTheDocument();
            expect(promotionsLink).toHaveAttribute('href', '/mi-cuenta/promociones');
        });

        it('should apply purple theme styling', () => {
            (global as any).__MOCK_HAS_ENTITLEMENT__ = true;

            const { container } = render(<VipPromotionsBanner />);

            // Check for purple-themed classes
            const banner = container.querySelector('.bg-purple-50');
            expect(banner).toBeInTheDocument();
            expect(banner).toHaveClass('border-purple-200');
        });
    });

    describe('accessibility', () => {
        it('should have proper heading hierarchy when showing VIP content', () => {
            (global as any).__MOCK_HAS_ENTITLEMENT__ = true;

            render(<VipPromotionsBanner />);

            const heading = screen.getByRole('heading', {
                name: /Promociones VIP Disponibles/
            });
            expect(heading).toBeInTheDocument();
            expect(heading.tagName).toBe('H3');
        });

        it('should have accessible link when showing VIP content', () => {
            (global as any).__MOCK_HAS_ENTITLEMENT__ = true;

            render(<VipPromotionsBanner />);

            const link = screen.getByRole('link', { name: /Ver promociones/ });
            expect(link).toBeInTheDocument();
        });
    });
});
