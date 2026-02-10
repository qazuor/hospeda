/**
 * Gates Component Tests - Billing System
 *
 * Tests EntitlementGate and LimitGate functionality with actual components that use them.
 * Validates gating behavior, fallback rendering, and integration with billing components.
 *
 * Components tested:
 * - VipPromotionsBanner (uses EntitlementGate with 'vip-promotions-access')
 * - FavoriteButton (uses LimitGate with 'max_favorites')
 * - AccommodationContactForm (uses EntitlementGate with 'contact-whatsapp-direct')
 *
 * @module test/components/billing/gates
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock state for controlling gate behavior in tests
 */
interface MockGateState {
    entitlements: Record<string, boolean>;
    limits: Record<string, { withinLimit: boolean; current: number; max: number }>;
    loading: boolean;
}

const mockGateState: MockGateState = {
    entitlements: {},
    limits: {},
    loading: false
};

/**
 * Helper to set mock entitlements for tests
 */
const setMockEntitlements = (entitlements: Record<string, boolean>) => {
    mockGateState.entitlements = entitlements;
};

/**
 * Helper to set mock limits for tests
 */
const setMockLimits = (
    limits: Record<string, { withinLimit: boolean; current: number; max: number }>
) => {
    mockGateState.limits = limits;
};

/**
 * Helper to set loading state
 */
const setMockLoading = (loading: boolean) => {
    mockGateState.loading = loading;
};

/**
 * Reset mock state between tests
 */
const resetMockState = () => {
    mockGateState.entitlements = {};
    mockGateState.limits = {};
    mockGateState.loading = false;
};

// Mock @qazuor/qzpay-react gates
vi.mock('@qazuor/qzpay-react', async () => {
    const actual = await vi.importActual('@qazuor/qzpay-react');

    return {
        ...actual,
        EntitlementGate: ({
            entitlementKey,
            children,
            fallback,
            loading
        }: {
            entitlementKey: string;
            children: ReactNode;
            fallback: ReactNode;
            loading?: ReactNode;
        }) => {
            if (mockGateState.loading && loading) {
                return <>{loading}</>;
            }

            const isGranted = mockGateState.entitlements[entitlementKey] ?? false;
            return <>{isGranted ? children : fallback}</>;
        },
        LimitGate: ({
            limitKey,
            children,
            fallback,
            loading
        }: {
            limitKey: string;
            children: ReactNode;
            fallback: ReactNode;
            loading?: ReactNode;
        }) => {
            if (mockGateState.loading && loading) {
                return <>{loading}</>;
            }

            const limitInfo = mockGateState.limits[limitKey];
            const withinLimit = limitInfo?.withinLimit ?? true;
            return <>{withinLimit ? children : fallback}</>;
        }
    };
});

// Mock icons
vi.mock('@repo/icons', () => ({
    FavoriteIcon: ({ size, className }: { size?: number; className?: string }) => (
        <svg
            data-testid="favorite-icon"
            data-size={size}
            className={className}
        >
            <title>Favorite</title>
        </svg>
    )
}));

// Mock useBookmark hook for FavoriteButton
const mockToggleBookmark = vi.fn();
const mockSetInitialBookmarked = vi.fn();

// Track bookmark state for proper mock behavior
let mockIsBookmarked = false;

vi.mock('@/hooks/useBookmark', () => ({
    useBookmark: vi.fn((_entityId: string, _entityType: string) => ({
        isBookmarked: mockIsBookmarked,
        isLoading: false,
        toggleBookmark: mockToggleBookmark,
        setInitialBookmarked: (initialState: boolean) => {
            mockIsBookmarked = initialState;
            mockSetInitialBookmarked(initialState);
        }
    }))
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
    webLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn()
    }
}));

// Import components after mocks
import AccommodationContactForm from '@/components/accommodations/AccommodationContactForm.client';
import { VipPromotionsBanner } from '@/components/billing/VipPromotionsBanner';
import { FavoriteButton } from '@/components/shared/FavoriteButton.client';

describe('Billing Gates - EntitlementGate and LimitGate', () => {
    beforeEach(() => {
        resetMockState();
        mockIsBookmarked = false;
        vi.clearAllMocks();
    });

    afterEach(() => {
        resetMockState();
        mockIsBookmarked = false;
        vi.clearAllMocks();
    });

    describe('EntitlementGate - Basic Behavior', () => {
        it('should render children when entitlement is granted', () => {
            // Arrange
            setMockEntitlements({ 'vip-promotions-access': true });

            // Act
            render(<VipPromotionsBanner />);

            // Assert
            expect(screen.getByText('Promociones VIP Disponibles')).toBeInTheDocument();
            expect(screen.getByText('Ver promociones')).toBeInTheDocument();
            expect(screen.queryByText('Promociones VIP exclusivas')).not.toBeInTheDocument();
        });

        it('should render fallback when entitlement is denied', () => {
            // Arrange
            setMockEntitlements({ 'vip-promotions-access': false });

            // Act
            render(<VipPromotionsBanner />);

            // Assert
            expect(screen.getByText('Promociones VIP exclusivas')).toBeInTheDocument();
            expect(
                screen.getByText(/Esta función está disponible en el plan/i)
            ).toBeInTheDocument();
            expect(screen.queryByText('Promociones VIP Disponibles')).not.toBeInTheDocument();
        });

        it('should render fallback when entitlement is undefined', () => {
            // Arrange - no entitlements set (defaults to denied)
            setMockEntitlements({});

            // Act
            render(<VipPromotionsBanner />);

            // Assert - should show fallback
            expect(screen.getByText('Promociones VIP exclusivas')).toBeInTheDocument();
            expect(screen.queryByText('Promociones VIP Disponibles')).not.toBeInTheDocument();
        });
    });

    describe('LimitGate - Basic Behavior', () => {
        it('should render children when under limit', () => {
            // Arrange
            setMockLimits({
                max_favorites: { withinLimit: true, current: 1, max: 3 }
            });

            // Act
            render(
                <FavoriteButton
                    entityId="test-id"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                />
            );

            // Assert - favorite button rendered (not limit fallback)
            expect(screen.getByTestId('favorite-icon')).toBeInTheDocument();
            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Agregar a favoritos');
            expect(screen.queryByText(/Límite alcanzado/i)).not.toBeInTheDocument();
        });

        it('should render fallback when limit reached', () => {
            // Arrange
            setMockLimits({
                max_favorites: { withinLimit: false, current: 3, max: 3 }
            });

            // Act
            render(
                <FavoriteButton
                    entityId="test-id"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                />
            );

            // Assert - limit fallback shown
            expect(screen.getByText(/Límite alcanzado/i)).toBeInTheDocument();
            expect(screen.getByText(/Has alcanzado el límite de/i)).toBeInTheDocument();
            expect(screen.queryByTestId('favorite-icon')).not.toBeInTheDocument();
        });

        it('should bypass limit gate when item is already bookmarked', () => {
            // Arrange - limit reached but item already bookmarked
            mockIsBookmarked = true;
            setMockLimits({
                max_favorites: { withinLimit: false, current: 3, max: 3 }
            });

            // Act
            render(
                <FavoriteButton
                    entityId="test-id"
                    entityType="ACCOMMODATION"
                    initialBookmarked={true}
                />
            );

            // Assert - button shown (allows removal), no limit fallback
            expect(screen.getByTestId('favorite-icon')).toBeInTheDocument();
            expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Quitar de favoritos');
            expect(screen.queryByText(/Límite alcanzado/i)).not.toBeInTheDocument();
        });
    });

    describe('VipPromotionsBanner - EntitlementGate Integration', () => {
        it('should show VIP content when entitlement granted', () => {
            // Arrange
            setMockEntitlements({ 'vip-promotions-access': true });

            // Act
            render(<VipPromotionsBanner />);

            // Assert - VIP content visible
            expect(screen.getByText('Promociones VIP Disponibles')).toBeInTheDocument();
            expect(
                screen.getByText(
                    'Accedé a descuentos y ofertas exclusivas de alojamientos solo para miembros VIP.'
                )
            ).toBeInTheDocument();

            // Assert - link to promotions page
            const promoLink = screen.getByRole('link', { name: 'Ver promociones' });
            expect(promoLink).toHaveAttribute('href', '/mi-cuenta/promociones');
        });

        it('should show upgrade fallback when entitlement denied', () => {
            // Arrange
            setMockEntitlements({ 'vip-promotions-access': false });

            // Act
            render(<VipPromotionsBanner />);

            // Assert - upgrade fallback visible
            expect(screen.getByText('Promociones VIP exclusivas')).toBeInTheDocument();
            expect(
                screen.getByText(/Esta función está disponible en el plan/i)
            ).toBeInTheDocument();
            expect(screen.getByText(/Tourist VIP/i)).toBeInTheDocument();

            // Assert - upgrade link
            const upgradeLink = screen.getByRole('link', { name: /Ver planes/i });
            expect(upgradeLink).toHaveAttribute('href', '/precios/turistas');
        });
    });

    describe('AccommodationContactForm - EntitlementGate Integration', () => {
        it('should show WhatsApp section when entitlement granted', () => {
            // Arrange
            setMockEntitlements({ 'contact-whatsapp-direct': true });

            // Act
            render(<AccommodationContactForm accommodationId="test-accommodation" />);

            // Assert - WhatsApp section visible
            expect(screen.getByText('¿Preferís WhatsApp?')).toBeInTheDocument();
            expect(
                screen.getByText(/Contactá directamente al anfitrión por WhatsApp/i)
            ).toBeInTheDocument();

            // Assert - WhatsApp link
            const whatsappLink = screen.getByRole('link', { name: 'Abrir WhatsApp' });
            expect(whatsappLink).toHaveAttribute('target', '_blank');
            expect(whatsappLink).toHaveAttribute('rel', 'noopener noreferrer');
            expect(whatsappLink.getAttribute('href')).toContain('wa.me');
            expect(whatsappLink.getAttribute('href')).toContain('test-accommodation');
        });

        it('should show upgrade fallback when entitlement denied', () => {
            // Arrange
            setMockEntitlements({ 'contact-whatsapp-direct': false });

            // Act
            render(<AccommodationContactForm accommodationId="test-accommodation" />);

            // Assert - upgrade fallback shown instead of WhatsApp section
            expect(screen.getByText('Contacto directo por WhatsApp')).toBeInTheDocument();
            expect(
                screen.getByText(/Esta función está disponible en el plan/i)
            ).toBeInTheDocument();
            expect(screen.getByText(/Premium/i)).toBeInTheDocument();

            // Assert - WhatsApp section not visible
            expect(screen.queryByText('¿Preferís WhatsApp?')).not.toBeInTheDocument();
        });

        it('should always show contact form regardless of entitlement', () => {
            // Arrange
            setMockEntitlements({ 'contact-whatsapp-direct': false });

            // Act
            render(<AccommodationContactForm accommodationId="test-accommodation" />);

            // Assert - form always visible
            expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
            expect(screen.getByLabelText('Email')).toBeInTheDocument();
            expect(screen.getByLabelText('Mensaje')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
        });
    });

    describe('FavoriteButton - LimitGate Integration', () => {
        it('should allow adding favorite when under limit', async () => {
            // Arrange
            const user = userEvent.setup();
            setMockLimits({
                max_favorites: { withinLimit: true, current: 1, max: 3 }
            });

            mockToggleBookmark.mockResolvedValue(true);

            // Act
            render(
                <FavoriteButton
                    entityId="test-id"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                />
            );

            const favoriteButton = screen.getByRole('button', { name: 'Agregar a favoritos' });
            await user.click(favoriteButton);

            // Assert - toggle was called
            expect(mockToggleBookmark).toHaveBeenCalledTimes(1);
        });

        it('should show limit fallback when trying to add at limit', () => {
            // Arrange
            setMockLimits({
                max_favorites: { withinLimit: false, current: 3, max: 3 }
            });

            // Act
            render(
                <FavoriteButton
                    entityId="test-id"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                />
            );

            // Assert - limit fallback displayed
            expect(screen.getByText(/Límite alcanzado/i)).toBeInTheDocument();

            // Assert - upgrade link present (using getAllBy since text appears multiple times)
            const upgradeLinks = screen.getAllByRole('link', { name: /Mejorar plan/i });
            expect(upgradeLinks[0]).toHaveAttribute('href', '/precios/turistas');
        });

        it('should allow removing favorite even at limit', async () => {
            // Arrange
            const user = userEvent.setup();
            mockIsBookmarked = true;
            setMockLimits({
                max_favorites: { withinLimit: false, current: 3, max: 3 }
            });

            mockToggleBookmark.mockResolvedValue(false);

            // Act - already bookmarked, so limit gate is bypassed
            render(
                <FavoriteButton
                    entityId="test-id"
                    entityType="ACCOMMODATION"
                    initialBookmarked={true}
                />
            );

            const favoriteButton = screen.getByRole('button', { name: 'Quitar de favoritos' });
            await user.click(favoriteButton);

            // Assert - toggle was called (removal allowed)
            expect(mockToggleBookmark).toHaveBeenCalledTimes(1);
            expect(screen.queryByText(/Límite alcanzado/i)).not.toBeInTheDocument();
        });

        it('should handle disabled state correctly', () => {
            // Arrange
            setMockLimits({
                max_favorites: { withinLimit: true, current: 1, max: 3 }
            });

            // Act
            render(
                <FavoriteButton
                    entityId="test-id"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                    disabled={true}
                />
            );

            // Assert - button is disabled
            const favoriteButton = screen.getByRole('button');
            expect(favoriteButton).toBeDisabled();
            expect(favoriteButton).toHaveClass('cursor-not-allowed', 'opacity-50');
        });
    });

    describe('Fallback Components - Upgrade CTA', () => {
        it('should render UpgradeFallback with correct plan information', () => {
            // Arrange
            setMockEntitlements({ 'vip-promotions-access': false });

            // Act
            render(<VipPromotionsBanner />);

            // Assert - feature name
            expect(screen.getByText('Promociones VIP exclusivas')).toBeInTheDocument();

            // Assert - required plan
            expect(screen.getByText(/Tourist VIP/i)).toBeInTheDocument();

            // Assert - description
            expect(
                screen.getByText(
                    'Accedé a descuentos y ofertas exclusivas de alojamientos solo para miembros VIP.'
                )
            ).toBeInTheDocument();

            // Assert - upgrade link
            const upgradeLink = screen.getByRole('link', { name: /Ver planes/i });
            expect(upgradeLink).toHaveAttribute('href', '/precios/turistas');
        });

        it('should render LimitFallback with usage information', () => {
            // Arrange
            setMockLimits({
                max_favorites: { withinLimit: false, current: 3, max: 3 }
            });

            // Act
            render(
                <FavoriteButton
                    entityId="test-id"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                />
            );

            // Assert - limit reached message
            expect(screen.getByText(/Límite alcanzado/i)).toBeInTheDocument();
            expect(screen.getByText(/Has alcanzado el límite de/i)).toBeInTheDocument();

            // Assert - upgrade CTA
            const upgradeButton = screen.getByRole('link', { name: /Mejorar plan/i });
            expect(upgradeButton).toBeInTheDocument();
            expect(upgradeButton).toHaveAttribute('href', '/precios/turistas');
        });
    });

    describe('Loading States', () => {
        it('should show loading state for LimitGate when loading', () => {
            // Arrange
            setMockLoading(true);

            // Act
            render(
                <FavoriteButton
                    entityId="test-id"
                    entityType="ACCOMMODATION"
                    initialBookmarked={false}
                />
            );

            // Assert - loading indicator shown
            expect(screen.getByText('Cargando...')).toBeInTheDocument();
        });
    });

    describe('Multiple Gates on Same Page', () => {
        it('should handle multiple gates with different entitlements', () => {
            // Arrange - VIP denied, WhatsApp granted
            setMockEntitlements({
                'vip-promotions-access': false,
                'contact-whatsapp-direct': true
            });

            // Act
            const { container } = render(
                <div>
                    <VipPromotionsBanner />
                    <AccommodationContactForm accommodationId="test-id" />
                </div>
            );

            // Assert - VIP shows fallback
            expect(screen.getByText('Promociones VIP exclusivas')).toBeInTheDocument();

            // Assert - WhatsApp shows content
            expect(screen.getByText('¿Preferís WhatsApp?')).toBeInTheDocument();

            // Assert - both components rendered
            expect(container).toBeTruthy();
        });

        it('should handle both EntitlementGate and LimitGate on same page', () => {
            // Arrange
            setMockEntitlements({ 'vip-promotions-access': true });
            setMockLimits({
                max_favorites: { withinLimit: true, current: 2, max: 3 }
            });

            // Act
            const { container } = render(
                <div>
                    <VipPromotionsBanner />
                    <FavoriteButton
                        entityId="test-id"
                        entityType="ACCOMMODATION"
                        initialBookmarked={false}
                    />
                </div>
            );

            // Assert - VIP content shown
            expect(screen.getByText('Promociones VIP Disponibles')).toBeInTheDocument();

            // Assert - Favorite button shown
            expect(screen.getByTestId('favorite-icon')).toBeInTheDocument();

            // Assert - no fallbacks
            expect(screen.queryByText(/Límite alcanzado/i)).not.toBeInTheDocument();
            expect(screen.queryByText('Promociones VIP exclusivas')).not.toBeInTheDocument();

            expect(container).toBeTruthy();
        });
    });
});
