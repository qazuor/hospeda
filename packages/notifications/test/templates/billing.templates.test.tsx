/**
 * Billing Email Templates Test Suite
 *
 * Tests for billing-related email templates including:
 * - Templates render without errors
 * - Templates include required fields from payload
 * - Spanish text is present
 * - Templates handle missing optional fields gracefully
 *
 * @module test/templates/billing.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    PaymentFailure,
    type PaymentFailureProps
} from '../../src/templates/billing/payment-failure';
import {
    PaymentSuccess,
    type PaymentSuccessProps
} from '../../src/templates/billing/payment-success';
import {
    PlanChangeConfirmation,
    type PlanChangeConfirmationProps
} from '../../src/templates/billing/plan-change-confirmation';
import {
    PurchaseConfirmation,
    type PurchaseConfirmationProps
} from '../../src/templates/billing/purchase-confirmation';
import {
    RenewalReminder,
    type RenewalReminderProps
} from '../../src/templates/billing/renewal-reminder';

describe('Billing Email Templates', () => {
    describe('PaymentSuccess', () => {
        const validProps: PaymentSuccessProps = {
            recipientName: 'Juan Pérez',
            amount: 10000, // $100.00 ARS
            currency: 'ARS',
            planName: 'Plan Standard',
            paymentMethod: 'Tarjeta de crédito'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(PaymentSuccess(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include required fields from payload', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PaymentSuccess(validProps));

            // Assert
            expect(html).toContain('Juan Pérez');
            expect(html).toContain('Plan Standard');
            expect(html).toContain('$100'); // Formatted amount
        });

        it('should include Spanish text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PaymentSuccess(validProps));

            // Assert
            expect(html).toContain('Pago confirmado');
            expect(html).toContain('Hola');
            expect(html).toContain('pago ha sido procesado exitosamente');
            expect(html).toContain('Concepto');
            expect(html).toContain('Monto');
        });

        it('should handle missing optional payment method gracefully', () => {
            // Arrange
            const propsWithoutPaymentMethod: PaymentSuccessProps = {
                ...validProps,
                paymentMethod: undefined
            };

            // Act
            const render = () => renderToStaticMarkup(PaymentSuccess(propsWithoutPaymentMethod));

            // Assert - Should not throw and should still render
            expect(render).not.toThrow();
            const html = render();
            expect(html).not.toContain('Método de pago');
        });

        it('should format currency correctly for ARS', () => {
            // Arrange
            const props: PaymentSuccessProps = {
                ...validProps,
                amount: 150050, // $1,500.50
                currency: 'ARS'
            };

            // Act
            const html = renderToStaticMarkup(PaymentSuccess(props));

            // Assert
            expect(html).toContain('$1'); // Should have peso sign and formatting
        });

        it('should format currency correctly for USD', () => {
            // Arrange
            const props: PaymentSuccessProps = {
                ...validProps,
                amount: 5000, // USD 50.00
                currency: 'USD'
            };

            // Act
            const html = renderToStaticMarkup(PaymentSuccess(props));

            // Assert
            expect(html).toContain('USD');
        });

        it('should include call-to-action button', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PaymentSuccess(validProps));

            // Assert
            expect(html).toContain('Ver recibo');
            expect(html).toContain('/mi-cuenta/billing');
        });
    });

    describe('PaymentFailure', () => {
        const validProps: PaymentFailureProps = {
            recipientName: 'María González',
            amount: 15000,
            currency: 'ARS',
            failureReason: 'Fondos insuficientes',
            retryDate: '2024-12-25'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(PaymentFailure(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include required fields from payload', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PaymentFailure(validProps));

            // Assert
            expect(html).toContain('María González');
            expect(html).toContain('$150'); // Formatted amount
            expect(html).toContain('Fondos insuficientes');
        });

        it('should include Spanish text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PaymentFailure(validProps));

            // Assert
            expect(html).toContain('No se pudo procesar tu pago');
            expect(html).toContain('Hola');
            expect(html).toContain('no fue posible completar la transacción');
            expect(html).toContain('Motivo');
        });

        it('should handle missing optional retry date gracefully', () => {
            // Arrange
            const propsWithoutRetryDate: PaymentFailureProps = {
                ...validProps,
                retryDate: undefined
            };

            // Act
            const render = () => renderToStaticMarkup(PaymentFailure(propsWithoutRetryDate));

            // Assert
            expect(render).not.toThrow();
        });

        it('should handle missing optional failure reason gracefully', () => {
            // Arrange
            const propsWithoutReason: PaymentFailureProps = {
                ...validProps,
                failureReason: undefined
            };

            // Act
            const render = () => renderToStaticMarkup(PaymentFailure(propsWithoutReason));

            // Assert
            expect(render).not.toThrow();
        });
    });

    describe('RenewalReminder', () => {
        const validProps: RenewalReminderProps = {
            recipientName: 'Carlos Rodríguez',
            planName: 'Plan Premium',
            amount: 20000,
            currency: 'ARS',
            renewalDate: '2024-12-31'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(RenewalReminder(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include required fields from payload', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(RenewalReminder(validProps));

            // Assert
            expect(html).toContain('Carlos Rodríguez');
            expect(html).toContain('Plan Premium');
            expect(html).toContain('$200'); // Formatted amount
        });

        it('should include Spanish text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(RenewalReminder(validProps));

            // Assert
            expect(html).toContain('Recordatorio de renovación');
            expect(html).toContain('Hola');
            expect(html).toContain('se renovará próximamente');
            expect(html).toContain('Plan');
        });

        it('should format renewal date in Spanish', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(RenewalReminder(validProps));

            // Assert
            // Should contain Spanish month name or formatted date
            expect(html).toMatch(/\d{1,2}.*de.*(diciembre|enero|febrero)/i);
        });

        it('should include unsubscribe link', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(RenewalReminder(validProps));

            // Assert
            // Renewal reminders are REMINDER category, so should have unsubscribe
            expect(html).toContain('preferencias');
        });
    });

    describe('PlanChangeConfirmation', () => {
        const validProps: PlanChangeConfirmationProps = {
            recipientName: 'Ana Martínez',
            oldPlanName: 'Plan Básico',
            newPlanName: 'Plan Premium',
            amount: 25000,
            currency: 'ARS'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(PlanChangeConfirmation(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include required fields from payload', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PlanChangeConfirmation(validProps));

            // Assert
            expect(html).toContain('Ana Martínez');
            expect(html).toContain('Plan Básico');
            expect(html).toContain('Plan Premium');
            expect(html).toContain('$250'); // Formatted amount
        });

        it('should include Spanish text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PlanChangeConfirmation(validProps));

            // Assert
            expect(html).toContain('Cambio de plan confirmado');
            expect(html).toContain('Hola');
            expect(html).toContain('cambio de plan ha sido procesado exitosamente');
        });

        it('should handle empty old plan name gracefully', () => {
            // Arrange
            const propsWithoutOldPlan: PlanChangeConfirmationProps = {
                ...validProps,
                oldPlanName: ''
            };

            // Act
            const render = () => renderToStaticMarkup(PlanChangeConfirmation(propsWithoutOldPlan));

            // Assert
            expect(render).not.toThrow();
        });
    });

    describe('PurchaseConfirmation', () => {
        const validProps: PurchaseConfirmationProps = {
            recipientName: 'Diego López',
            planName: 'Plan Enterprise',
            amount: 50000,
            currency: 'ARS',
            billingPeriod: 'monthly',
            nextBillingDate: '2025-01-31'
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(PurchaseConfirmation(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include required fields from payload', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PurchaseConfirmation(validProps));

            // Assert
            expect(html).toContain('Diego López');
            expect(html).toContain('Plan Enterprise');
            expect(html).toContain('$500'); // Formatted amount
        });

        it('should include Spanish text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PurchaseConfirmation(validProps));

            // Assert
            expect(html).toContain('Gracias por tu compra');
            expect(html).toContain('Hola');
            expect(html).toContain('compra ha sido confirmada exitosamente');
        });

        it('should handle missing optional billing period gracefully', () => {
            // Arrange
            const propsWithoutBillingPeriod: PurchaseConfirmationProps = {
                ...validProps,
                billingPeriod: undefined
            };

            // Act
            const render = () =>
                renderToStaticMarkup(PurchaseConfirmation(propsWithoutBillingPeriod));

            // Assert
            expect(render).not.toThrow();
        });

        it('should handle missing optional next billing date gracefully', () => {
            // Arrange
            const propsWithoutNextBilling: PurchaseConfirmationProps = {
                ...validProps,
                nextBillingDate: undefined
            };

            // Act
            const render = () =>
                renderToStaticMarkup(PurchaseConfirmation(propsWithoutNextBilling));

            // Assert
            expect(render).not.toThrow();
        });

        it('should format next billing date in Spanish', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(PurchaseConfirmation(validProps));

            // Assert
            // Should contain Spanish month name or formatted date
            expect(html).toMatch(/\d{1,2}.*de.*(enero|febrero|marzo)/i);
        });
    });
});
