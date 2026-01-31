/**
 * Admin Email Templates Test Suite
 *
 * Tests for admin notification email templates including:
 * - Templates render without errors
 * - Templates include required fields from payload
 * - Spanish text is present
 * - Templates handle missing optional fields gracefully
 * - Severity badges are displayed correctly
 *
 * @module test/templates/admin.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    AdminPaymentFailure,
    type AdminPaymentFailureProps
} from '../../src/templates/admin/admin-payment-failure';
import {
    AdminSystemEvent,
    type AdminSystemEventProps
} from '../../src/templates/admin/admin-system-event';

describe('Admin Email Templates', () => {
    describe('AdminPaymentFailure', () => {
        const validProps: AdminPaymentFailureProps = {
            recipientName: 'Admin Principal',
            affectedUserEmail: 'cliente@example.com',
            affectedUserId: 'user_789',
            severity: 'critical',
            eventDetails: {
                amount: 15000,
                currency: 'ARS',
                failureReason: 'Tarjeta rechazada',
                attemptCount: 3,
                planName: 'Plan Premium'
            }
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(AdminPaymentFailure(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include required fields from payload', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AdminPaymentFailure(validProps));

            // Assert
            expect(html).toContain('Admin Principal');
            expect(html).toContain('cliente@example.com');
            expect(html).toContain('user_789');
            expect(html).toContain('Tarjeta rechazada');
        });

        it('should include Spanish text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AdminPaymentFailure(validProps));

            // Assert
            expect(html).toContain('Fallo de Pago Detectado');
            expect(html).toContain('Hola');
            expect(html).toContain('NOTIFICACIÓN ADMINISTRATIVA');
            expect(html).toContain('Información del Usuario');
            expect(html).toContain('Detalles del Pago');
            expect(html).toContain('Motivo del fallo');
        });

        it('should display critical severity badge correctly', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AdminPaymentFailure(validProps));

            // Assert
            expect(html).toContain('CRÍTICO');
        });

        it('should display warning severity badge correctly', () => {
            // Arrange
            const propsWithWarning: AdminPaymentFailureProps = {
                ...validProps,
                severity: 'warning'
            };

            // Act
            const html = renderToStaticMarkup(AdminPaymentFailure(propsWithWarning));

            // Assert
            expect(html).toContain('ADVERTENCIA');
        });

        it('should display info severity badge correctly', () => {
            // Arrange
            const propsWithInfo: AdminPaymentFailureProps = {
                ...validProps,
                severity: 'info'
            };

            // Act
            const html = renderToStaticMarkup(AdminPaymentFailure(propsWithInfo));

            // Assert
            expect(html).toContain('INFO');
        });

        it('should handle missing optional affected user email gracefully', () => {
            // Arrange
            const propsWithoutEmail: AdminPaymentFailureProps = {
                ...validProps,
                affectedUserEmail: undefined
            };

            // Act
            const render = () => renderToStaticMarkup(AdminPaymentFailure(propsWithoutEmail));

            // Assert
            expect(render).not.toThrow();
            const html = render();
            expect(html).toContain('user_789'); // Should still have user ID
        });

        it('should handle missing optional affected user ID gracefully', () => {
            // Arrange
            const propsWithoutUserId: AdminPaymentFailureProps = {
                ...validProps,
                affectedUserId: undefined
            };

            // Act
            const render = () => renderToStaticMarkup(AdminPaymentFailure(propsWithoutUserId));

            // Assert
            expect(render).not.toThrow();
            const html = render();
            expect(html).toContain('cliente@example.com'); // Should still have email
        });

        it('should format amount in event details correctly', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AdminPaymentFailure(validProps));

            // Assert
            expect(html).toContain('$150'); // Formatted amount
        });

        it('should display failure reason from event details', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AdminPaymentFailure(validProps));

            // Assert
            expect(html).toContain('Tarjeta rechazada');
        });

        it('should handle missing failure reason in event details gracefully', () => {
            // Arrange
            const propsWithoutReason: AdminPaymentFailureProps = {
                ...validProps,
                eventDetails: {
                    amount: 15000,
                    currency: 'ARS'
                }
            };

            // Act
            const render = () => renderToStaticMarkup(AdminPaymentFailure(propsWithoutReason));

            // Assert
            expect(render).not.toThrow();
        });

        it('should display JSON event details', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AdminPaymentFailure(validProps));

            // Assert
            // Should contain formatted JSON with event details
            expect(html).toContain('Información Adicional');
            expect(html).toContain('amount');
            expect(html).toContain('15000');
        });

        it('should include admin badge', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AdminPaymentFailure(validProps));

            // Assert
            expect(html).toContain('NOTIFICACIÓN ADMINISTRATIVA');
        });

        it('should not include unsubscribe link for admin notifications', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AdminPaymentFailure(validProps));

            // Assert
            // Admin notifications should NOT have unsubscribe (ADMIN category always sends)
            expect(html).not.toContain('Cancelar suscripción');
            expect(html).not.toContain('preferencias de notificaciones');
        });
    });

    describe('AdminSystemEvent', () => {
        const validProps: AdminSystemEventProps = {
            recipientName: 'Admin Técnico',
            severity: 'warning',
            eventDetails: {
                eventType: 'DATABASE_SLOW_QUERY',
                queryTime: '5.2s',
                table: 'billingCustomer',
                threshold: '2s',
                timestamp: '2024-12-20T15:30:00Z'
            }
        };

        it('should render without errors', () => {
            // Arrange & Act
            const render = () => renderToStaticMarkup(AdminSystemEvent(validProps));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include required fields from payload', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AdminSystemEvent(validProps));

            // Assert
            expect(html).toContain('Admin Técnico');
            expect(html).toContain('DATABASE_SLOW_QUERY');
        });

        it('should include Spanish text', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AdminSystemEvent(validProps));

            // Assert
            expect(html).toContain('Evento del Sistema');
            expect(html).toContain('Hola');
            expect(html).toContain('NOTIFICACIÓN ADMINISTRATIVA');
            expect(html).toContain('Información del Evento');
            expect(html).toContain('Detalles Completos');
        });

        it('should display warning severity badge correctly', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AdminSystemEvent(validProps));

            // Assert
            expect(html).toContain('ADVERTENCIA');
        });

        it('should display critical severity badge correctly', () => {
            // Arrange
            const propsWithCritical: AdminSystemEventProps = {
                ...validProps,
                severity: 'critical'
            };

            // Act
            const html = renderToStaticMarkup(AdminSystemEvent(propsWithCritical));

            // Assert
            expect(html).toContain('CRÍTICO');
        });

        it('should display info severity badge correctly', () => {
            // Arrange
            const propsWithInfo: AdminSystemEventProps = {
                ...validProps,
                severity: 'info'
            };

            // Act
            const html = renderToStaticMarkup(AdminSystemEvent(propsWithInfo));

            // Assert
            expect(html).toContain('INFO');
        });

        it('should display JSON event details', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AdminSystemEvent(validProps));

            // Assert
            // Should contain formatted JSON with event details
            expect(html).toContain('Detalles Completos');
            expect(html).toContain('DATABASE_SLOW_QUERY');
            expect(html).toContain('5.2s');
        });

        it('should handle complex event details object', () => {
            // Arrange
            const propsWithComplexDetails: AdminSystemEventProps = {
                ...validProps,
                eventDetails: {
                    eventType: 'HIGH_ERROR_RATE',
                    errorCount: 150,
                    timeWindow: '5m',
                    affectedEndpoints: ['/api/bookings', '/api/payments'],
                    metadata: {
                        region: 'sa-east-1',
                        errorTypes: ['TIMEOUT', 'CONNECTION_REFUSED']
                    }
                }
            };

            // Act
            const render = () => renderToStaticMarkup(AdminSystemEvent(propsWithComplexDetails));

            // Assert
            expect(render).not.toThrow();
            const html = render();
            expect(html).toContain('HIGH_ERROR_RATE');
            expect(html).toContain('150');
        });

        it('should handle empty event details gracefully', () => {
            // Arrange
            const propsWithEmptyDetails: AdminSystemEventProps = {
                ...validProps,
                eventDetails: {}
            };

            // Act
            const render = () => renderToStaticMarkup(AdminSystemEvent(propsWithEmptyDetails));

            // Assert
            expect(render).not.toThrow();
        });

        it('should include admin badge', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AdminSystemEvent(validProps));

            // Assert
            expect(html).toContain('NOTIFICACIÓN ADMINISTRATIVA');
        });

        it('should not include unsubscribe link for admin notifications', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AdminSystemEvent(validProps));

            // Assert
            // Admin notifications should NOT have unsubscribe
            expect(html).not.toContain('Cancelar suscripción');
            expect(html).not.toContain('preferencias de notificaciones');
        });

        it('should include technical footer note', () => {
            // Arrange & Act
            const html = renderToStaticMarkup(AdminSystemEvent(validProps));

            // Assert
            expect(html).toContain('notificación automática del sistema');
            expect(html).toContain('panel de administración');
        });
    });
});
