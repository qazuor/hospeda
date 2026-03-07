/**
 * Subscription Lifecycle Email Templates Test Suite
 *
 * Tests for subscription lifecycle email templates including:
 * - Templates render without errors
 * - Templates include required fields from payload
 * - Spanish text is present
 * - Templates handle missing optional fields gracefully
 *
 * @module test/templates/subscription-templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    SubscriptionCancelled,
    type SubscriptionCancelledProps
} from '../../src/templates/subscription/subscription-cancelled';
import {
    SubscriptionPaused,
    type SubscriptionPausedProps
} from '../../src/templates/subscription/subscription-paused';
import {
    SubscriptionReactivated,
    type SubscriptionReactivatedProps
} from '../../src/templates/subscription/subscription-reactivated';

describe('Subscription Lifecycle Email Templates', () => {
    describe('SubscriptionCancelled', () => {
        const validProps: SubscriptionCancelledProps = {
            recipientName: 'Laura Fernández',
            planName: 'Plan Premium',
            currentPeriodEnd: '2025-01-31',
            baseUrl: 'https://hospeda.com.ar'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(SubscriptionCancelled(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should contain recipient name', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelled(validProps));

            // Assert
            expect(html).toContain('Laura Fernández');
        });

        it('should contain plan name', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelled(validProps));

            // Assert
            expect(html).toContain('Plan Premium');
        });

        it('should include CTA link based on baseUrl', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelled(validProps));

            // Assert
            expect(html).toContain('https://hospeda.com.ar/es/precios/propietarios');
        });

        it('should contain formatted period end date when provided', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelled(validProps));

            // Assert
            expect(html).toMatch(/\d{1,2}.*de.*(enero|febrero|diciembre)/i);
        });

        it('should include Spanish text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionCancelled(validProps));

            // Assert
            expect(html).toContain('Tu suscripcion ha sido cancelada');
            expect(html).toContain('Hola');
            expect(html).toContain('ha sido cancelada');
            expect(html).toContain('Plan');
            expect(html).toContain('Reactivar suscripcion');
        });

        it('should not show period end date when currentPeriodEnd is omitted', () => {
            // Arrange
            const propsWithoutPeriodEnd: SubscriptionCancelledProps = {
                recipientName: 'Laura Fernández',
                planName: 'Plan Premium',
                baseUrl: 'https://hospeda.com.ar'
            };

            // Act
            const render = () => renderToStaticMarkup(SubscriptionCancelled(propsWithoutPeriodEnd));

            // Assert
            expect(render).not.toThrow();
            const html = render();
            expect(html).not.toContain('Acceso hasta');
        });

        it('should render correctly with a different baseUrl', () => {
            // Arrange
            const propsWithCustomUrl: SubscriptionCancelledProps = {
                ...validProps,
                baseUrl: 'https://staging.hospeda.com.ar'
            };

            // Act
            const html = renderToStaticMarkup(SubscriptionCancelled(propsWithCustomUrl));

            // Assert
            expect(html).toContain('https://staging.hospeda.com.ar/es/precios/propietarios');
        });
    });

    describe('SubscriptionPaused', () => {
        const validProps: SubscriptionPausedProps = {
            recipientName: 'Roberto Sosa',
            planName: 'Plan Standard',
            baseUrl: 'https://hospeda.com.ar'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(SubscriptionPaused(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should contain recipient name', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionPaused(validProps));

            // Assert
            expect(html).toContain('Roberto Sosa');
        });

        it('should contain plan name', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionPaused(validProps));

            // Assert
            expect(html).toContain('Plan Standard');
        });

        it('should include CTA link based on baseUrl', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionPaused(validProps));

            // Assert
            expect(html).toContain('https://hospeda.com.ar/es/mi-cuenta/suscripcion');
        });

        it('should include Spanish text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionPaused(validProps));

            // Assert
            expect(html).toContain('Tu suscripcion ha sido pausada');
            expect(html).toContain('Hola');
            expect(html).toContain('ha sido pausada');
            expect(html).toContain('Pausada');
            expect(html).toContain('metodo de pago');
            expect(html).toContain('Actualizar metodo de pago');
        });

        it('should indicate payment method issue', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionPaused(validProps));

            // Assert
            expect(html).toContain('problema con tu metodo de pago');
        });

        it('should show paused status in info section', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionPaused(validProps));

            // Assert
            expect(html).toContain('Estado');
            expect(html).toContain('Pausada');
        });

        it('should render correctly with a different baseUrl', () => {
            // Arrange
            const propsWithCustomUrl: SubscriptionPausedProps = {
                ...validProps,
                baseUrl: 'https://staging.hospeda.com.ar'
            };

            // Act
            const html = renderToStaticMarkup(SubscriptionPaused(propsWithCustomUrl));

            // Assert
            expect(html).toContain('https://staging.hospeda.com.ar/es/mi-cuenta/suscripcion');
        });
    });

    describe('SubscriptionReactivated', () => {
        const validProps: SubscriptionReactivatedProps = {
            recipientName: 'Valentina Torres',
            planName: 'Plan Enterprise',
            nextBillingDate: '2025-02-28',
            baseUrl: 'https://hospeda.com.ar'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(SubscriptionReactivated(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should contain recipient name', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionReactivated(validProps));

            // Assert
            expect(html).toContain('Valentina Torres');
        });

        it('should contain plan name', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionReactivated(validProps));

            // Assert
            expect(html).toContain('Plan Enterprise');
        });

        it('should include CTA link based on baseUrl', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionReactivated(validProps));

            // Assert
            expect(html).toContain('https://hospeda.com.ar/es/mi-cuenta');
        });

        it('should contain formatted next billing date when provided', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionReactivated(validProps));

            // Assert
            expect(html).toMatch(/\d{1,2}.*de.*(febrero|enero|marzo)/i);
            expect(html).toContain('Proxima facturacion');
        });

        it('should include Spanish text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionReactivated(validProps));

            // Assert
            expect(html).toContain('Tu suscripcion ha sido reactivada');
            expect(html).toContain('Hola');
            expect(html).toContain('activa nuevamente');
            expect(html).toContain('Activa');
            expect(html).toContain('Ir al panel');
        });

        it('should render without next billing date when omitted', () => {
            // Arrange
            const propsWithoutNextBilling: SubscriptionReactivatedProps = {
                recipientName: 'Valentina Torres',
                planName: 'Plan Enterprise',
                baseUrl: 'https://hospeda.com.ar'
            };

            // Act
            const render = () =>
                renderToStaticMarkup(SubscriptionReactivated(propsWithoutNextBilling));

            // Assert
            expect(render).not.toThrow();
            const html = render();
            expect(html).not.toContain('Proxima facturacion');
            expect(html).not.toContain('proxima facturacion es el');
        });

        it('should show active status in info section', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(SubscriptionReactivated(validProps));

            // Assert
            expect(html).toContain('Estado');
            expect(html).toContain('Activa');
        });

        it('should render correctly with a different baseUrl', () => {
            // Arrange
            const propsWithCustomUrl: SubscriptionReactivatedProps = {
                ...validProps,
                baseUrl: 'https://staging.hospeda.com.ar'
            };

            // Act
            const html = renderToStaticMarkup(SubscriptionReactivated(propsWithCustomUrl));

            // Assert
            expect(html).toContain('https://staging.hospeda.com.ar/es/mi-cuenta');
        });
    });

    describe('showUnsubscribe=false across lifecycle templates', () => {
        it('should not show unsubscribe link in SubscriptionCancelled template', () => {
            // Arrange
            const props: SubscriptionCancelledProps = {
                recipientName: 'Laura Fernández',
                planName: 'Plan Premium',
                currentPeriodEnd: '2025-01-31',
                baseUrl: 'https://hospeda.com.ar'
            };

            // Act
            const html = renderToStaticMarkup(SubscriptionCancelled(props));

            // Assert
            expect(html).not.toContain('Administrar preferencias de notificaciones');
            expect(html).not.toContain('unsubscribe_url');
        });

        it('should not show unsubscribe link in SubscriptionPaused template', () => {
            // Arrange
            const props: SubscriptionPausedProps = {
                recipientName: 'Roberto Sosa',
                planName: 'Plan Standard',
                baseUrl: 'https://hospeda.com.ar'
            };

            // Act
            const html = renderToStaticMarkup(SubscriptionPaused(props));

            // Assert
            expect(html).not.toContain('Administrar preferencias de notificaciones');
            expect(html).not.toContain('unsubscribe_url');
        });

        it('should not show unsubscribe link in SubscriptionReactivated template', () => {
            // Arrange
            const props: SubscriptionReactivatedProps = {
                recipientName: 'Valentina Torres',
                planName: 'Plan Enterprise',
                nextBillingDate: '2025-02-28',
                baseUrl: 'https://hospeda.com.ar'
            };

            // Act
            const html = renderToStaticMarkup(SubscriptionReactivated(props));

            // Assert
            expect(html).not.toContain('Administrar preferencias de notificaciones');
            expect(html).not.toContain('unsubscribe_url');
        });
    });
});
