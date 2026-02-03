import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanCard } from '../../../src/components/pricing/PlanCard';

// Mock billing-api-client
vi.mock('../../../src/lib/billing-api-client', () => ({
    createCheckoutSession: vi.fn()
}));

describe('PlanCard', () => {
    const mockFeatures = [
        { name: 'Feature 1', included: true },
        { name: 'Feature 2', included: true },
        { name: 'Feature 3', included: false }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic rendering', () => {
        it('should render plan name and description', () => {
            render(
                <PlanCard
                    name="Plan Básico"
                    description="Plan para empezar"
                    price={990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                />
            );

            expect(screen.getByText('Plan Básico')).toBeInTheDocument();
            expect(screen.getByText('Plan para empezar')).toBeInTheDocument();
        });

        it('should render formatted price with currency', () => {
            render(
                <PlanCard
                    name="Plan Pro"
                    description="Plan profesional"
                    price={1990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                    currency="ARS"
                />
            );

            expect(screen.getByText('ARS')).toBeInTheDocument();
            expect(screen.getByText('$19.900')).toBeInTheDocument();
            expect(screen.getByText('/mes')).toBeInTheDocument();
        });

        it('should render "Gratis" for free plans', () => {
            render(
                <PlanCard
                    name="Plan Gratuito"
                    description="Plan gratis"
                    price={0}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Crear cuenta gratis"
                />
            );

            expect(screen.getByText('Gratis')).toBeInTheDocument();
            expect(screen.queryByText('ARS')).not.toBeInTheDocument();
        });

        it('should render badge when provided', () => {
            render(
                <PlanCard
                    name="Plan Pro"
                    description="Plan profesional"
                    price={1990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                    badge="Más Popular"
                />
            );

            expect(screen.getByText('Más Popular')).toBeInTheDocument();
        });

        it('should apply highlighted styles', () => {
            const { container } = render(
                <PlanCard
                    name="Plan Pro"
                    description="Plan profesional"
                    price={1990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                    highlighted={true}
                />
            );

            const card = container.querySelector('.bg-primary');
            expect(card).toBeInTheDocument();
        });

        it('should show trial text when provided', () => {
            render(
                <PlanCard
                    name="Plan Pro"
                    description="Plan profesional"
                    price={1990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                    trialText="Prueba gratis por 14 días"
                    isTrial={true}
                />
            );

            expect(screen.getByText('Prueba gratis por 14 días')).toBeInTheDocument();
        });
    });

    describe('Pricing display', () => {
        it('should show original and discounted price with promo code', () => {
            render(
                <PlanCard
                    name="Plan Pro"
                    description="Plan profesional"
                    price={1590000}
                    originalPrice={1990000}
                    promoCode="SAVE20"
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                />
            );

            expect(screen.getByText('$19.900')).toBeInTheDocument(); // Original (strikethrough)
            expect(screen.getByText('$15.900')).toBeInTheDocument(); // Discounted
            expect(screen.getByText('Con código SAVE20')).toBeInTheDocument();
        });

        it('should show annual period text correctly', () => {
            render(
                <PlanCard
                    name="Plan Pro"
                    description="Plan profesional"
                    price={19900000}
                    period="annual"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                />
            );

            expect(screen.getByText('/año')).toBeInTheDocument();
            expect(screen.getByText('Pagás $199.000 por año')).toBeInTheDocument();
        });
    });

    describe('CTA behavior without checkout', () => {
        it('should render CTA button with provided text', () => {
            render(
                <PlanCard
                    name="Plan Básico"
                    description="Plan para empezar"
                    price={990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Comenzar ahora"
                />
            );

            expect(screen.getByRole('button', { name: 'Comenzar ahora' })).toBeInTheDocument();
        });

        it('should navigate to ctaLink when clicked and no onCheckout', async () => {
            const user = userEvent.setup();
            const mockLocation = { href: '' };

            Object.defineProperty(window, 'location', {
                value: mockLocation,
                writable: true,
                configurable: true
            });

            render(
                <PlanCard
                    name="Plan Básico"
                    description="Plan para empezar"
                    price={990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                    ctaLink="/auth/sign-up?plan=basic"
                />
            );

            const button = screen.getByRole('button', { name: 'Suscribirse' });
            await user.click(button);

            expect(mockLocation.href).toBe('/auth/sign-up?plan=basic');
        });

        it('should call onCtaClick when provided', async () => {
            const user = userEvent.setup();
            const mockOnCtaClick = vi.fn();

            render(
                <PlanCard
                    name="Plan Básico"
                    description="Plan para empezar"
                    price={990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                    onCtaClick={mockOnCtaClick}
                />
            );

            const button = screen.getByRole('button', { name: 'Suscribirse' });
            await user.click(button);

            expect(mockOnCtaClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('Checkout functionality', () => {
        it('should call onCheckout when authenticated user clicks button', async () => {
            const user = userEvent.setup();
            const mockOnCheckout = vi.fn().mockResolvedValue(undefined);

            render(
                <PlanCard
                    name="Plan Pro"
                    description="Plan profesional"
                    price={1990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                    onCheckout={mockOnCheckout}
                    planSlug="owner-pro"
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button', { name: 'Suscribirse' });
            await user.click(button);

            await waitFor(() => {
                expect(mockOnCheckout).toHaveBeenCalledWith('owner-pro-monthly');
            });
        });

        it('should show loading state during checkout', async () => {
            const user = userEvent.setup();
            const mockOnCheckout = vi
                .fn()
                .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

            render(
                <PlanCard
                    name="Plan Pro"
                    description="Plan profesional"
                    price={1990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                    onCheckout={mockOnCheckout}
                    planSlug="owner-pro"
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button', { name: 'Suscribirse' });
            await user.click(button);

            expect(screen.getByRole('button', { name: 'Cargando...' })).toBeInTheDocument();
            expect(button).toBeDisabled();

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Suscribirse' })).toBeEnabled();
            });
        });

        it('should display error message on checkout failure', async () => {
            const user = userEvent.setup();
            const mockOnCheckout = vi
                .fn()
                .mockRejectedValue(new Error('Fallo al crear sesión de pago'));

            render(
                <PlanCard
                    name="Plan Pro"
                    description="Plan profesional"
                    price={1990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                    onCheckout={mockOnCheckout}
                    planSlug="owner-pro"
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button', { name: 'Suscribirse' });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText('Fallo al crear sesión de pago')).toBeInTheDocument();
            });
        });

        it('should allow retry after error', async () => {
            const user = userEvent.setup();
            const mockOnCheckout = vi
                .fn()
                .mockRejectedValueOnce(new Error('Error de prueba'))
                .mockResolvedValueOnce(undefined);

            render(
                <PlanCard
                    name="Plan Pro"
                    description="Plan profesional"
                    price={1990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                    onCheckout={mockOnCheckout}
                    planSlug="owner-pro"
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button', { name: 'Suscribirse' });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText('Error de prueba')).toBeInTheDocument();
            });

            // Click again to retry
            await user.click(button);

            await waitFor(() => {
                expect(mockOnCheckout).toHaveBeenCalledTimes(2);
            });
        });

        it('should use annual price ID for annual period', async () => {
            const user = userEvent.setup();
            const mockOnCheckout = vi.fn().mockResolvedValue(undefined);

            render(
                <PlanCard
                    name="Plan Pro"
                    description="Plan profesional"
                    price={19900000}
                    period="annual"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                    onCheckout={mockOnCheckout}
                    planSlug="owner-pro"
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button', { name: 'Suscribirse' });
            await user.click(button);

            await waitFor(() => {
                expect(mockOnCheckout).toHaveBeenCalledWith('owner-pro-annual');
            });
        });
    });

    describe('Trial plans', () => {
        it('should show trial button text for trial plans', () => {
            render(
                <PlanCard
                    name="Plan Pro"
                    description="Plan profesional"
                    price={1990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                    isTrial={true}
                    isAuthenticated={true}
                    onCheckout={vi.fn()}
                    planSlug="owner-pro"
                />
            );

            expect(
                screen.getByRole('button', { name: 'Comenzar prueba gratis (14 días)' })
            ).toBeInTheDocument();
        });
    });

    describe('Unauthenticated users', () => {
        it('should render sign-up link for unauthenticated users on paid plans', () => {
            render(
                <PlanCard
                    name="Plan Pro"
                    description="Plan profesional"
                    price={1990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                    ctaLink="/auth/sign-up?plan=owner-pro"
                    isAuthenticated={false}
                />
            );

            const button = screen.getByRole('button', { name: 'Suscribirse' });
            expect(button).toBeInTheDocument();
        });

        it('should not call onCheckout for unauthenticated users', async () => {
            const user = userEvent.setup();
            const mockOnCheckout = vi.fn().mockResolvedValue(undefined);
            const mockOnCtaClick = vi.fn();

            render(
                <PlanCard
                    name="Plan Pro"
                    description="Plan profesional"
                    price={1990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                    onCheckout={mockOnCheckout}
                    onCtaClick={mockOnCtaClick}
                    planSlug="owner-pro"
                    isAuthenticated={false}
                />
            );

            const button = screen.getByRole('button', { name: 'Suscribirse' });
            await user.click(button);

            expect(mockOnCheckout).not.toHaveBeenCalled();
            expect(mockOnCtaClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('Free plans', () => {
        it('should render free plan CTA as link', () => {
            render(
                <PlanCard
                    name="Plan Gratuito"
                    description="Plan gratis"
                    price={0}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Crear cuenta gratis"
                    ctaLink="/auth/sign-up?plan=tourist-free"
                />
            );

            const button = screen.getByRole('button', { name: 'Crear cuenta gratis' });
            expect(button).toBeInTheDocument();
        });

        it('should not trigger checkout for free plans', async () => {
            const user = userEvent.setup();
            const mockOnCheckout = vi.fn().mockResolvedValue(undefined);
            const mockOnCtaClick = vi.fn();

            render(
                <PlanCard
                    name="Plan Gratuito"
                    description="Plan gratis"
                    price={0}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Crear cuenta gratis"
                    onCheckout={mockOnCheckout}
                    onCtaClick={mockOnCtaClick}
                    isAuthenticated={true}
                />
            );

            const button = screen.getByRole('button', { name: 'Crear cuenta gratis' });
            await user.click(button);

            // Free plans should use onCtaClick, not checkout
            expect(mockOnCheckout).not.toHaveBeenCalled();
            expect(mockOnCtaClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('Spanish text', () => {
        it('should display all text in Spanish', () => {
            const mockOnCheckout = vi.fn().mockRejectedValue(new Error('Test error'));

            const { rerender } = render(
                <PlanCard
                    name="Plan Pro"
                    description="Plan profesional"
                    price={1990000}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Suscribirse"
                    onCheckout={mockOnCheckout}
                    planSlug="owner-pro"
                    isAuthenticated={true}
                    isTrial={true}
                />
            );

            // Check trial text
            expect(
                screen.getByRole('button', { name: 'Comenzar prueba gratis (14 días)' })
            ).toBeInTheDocument();

            // Check free plan text
            rerender(
                <PlanCard
                    name="Plan Gratuito"
                    description="Plan gratis"
                    price={0}
                    period="monthly"
                    features={mockFeatures}
                    ctaText="Crear cuenta gratis"
                />
            );
            expect(screen.getByText('Gratis')).toBeInTheDocument();
        });
    });
});
