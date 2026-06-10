/**
 * Subject Builder Test Suite
 *
 * Tests for the email subject line builder including:
 * - All notification types return proper subject strings
 * - Placeholder replacement with actual values
 * - Fallback for unknown notification types
 * - Handling of missing variables in templates
 *
 * @module test/utils/subject-builder.test
 */

import { describe, expect, it } from 'vitest';
import { NotificationType } from '../../src/types/notification.types';
import { getSubject } from '../../src/utils/subject-builder';

describe('Subject Builder', () => {
    describe('getSubject', () => {
        describe('Notification type subjects', () => {
            it('should return subscription purchase subject with planName', () => {
                // Arrange
                const data = { planName: 'Pro' };

                // Act
                const result = getSubject(NotificationType.SUBSCRIPTION_PURCHASE, data);

                // Assert
                expect(result).toBe('Confirmación de compra - Pro');
            });

            it('should return addon purchase subject with addonName', () => {
                // Arrange
                const data = { addonName: 'Soporte Prioritario' };

                // Act
                const result = getSubject(NotificationType.ADDON_PURCHASE, data);

                // Assert
                expect(result).toBe('Add-on adquirido - Soporte Prioritario');
            });

            it('should return payment success subject with amount', () => {
                // Arrange
                const data = { amount: '1500' };

                // Act
                const result = getSubject(NotificationType.PAYMENT_SUCCESS, data);

                // Assert
                expect(result).toBe('Pago recibido - $1500');
            });

            it('should return payment failure subject without placeholders', () => {
                // Arrange
                const data = {};

                // Act
                const result = getSubject(NotificationType.PAYMENT_FAILURE, data);

                // Assert
                expect(result).toBe('Error en tu pago - Acción requerida');
            });

            it('should return renewal reminder subject with planName', () => {
                // Arrange
                const data = { planName: 'Enterprise' };

                // Act
                const result = getSubject(NotificationType.RENEWAL_REMINDER, data);

                // Assert
                expect(result).toBe('Tu suscripción se renueva pronto - Enterprise');
            });

            it('should return plan change confirmation subject', () => {
                // Arrange
                const data = {};

                // Act
                const result = getSubject(NotificationType.PLAN_CHANGE_CONFIRMATION, data);

                // Assert
                expect(result).toBe('Cambio de plan confirmado');
            });

            it('should return addon expiration warning subject with addonName', () => {
                // Arrange
                const data = { addonName: 'Analytics Plus' };

                // Act
                const result = getSubject(NotificationType.ADDON_EXPIRATION_WARNING, data);

                // Assert
                expect(result).toBe('Tu add-on Analytics Plus expira pronto');
            });

            it('should return addon expired subject with addonName', () => {
                // Arrange
                const data = { addonName: 'SEO Tools' };

                // Act
                const result = getSubject(NotificationType.ADDON_EXPIRED, data);

                // Assert
                expect(result).toBe('Tu add-on SEO Tools ha expirado');
            });

            it('should return addon renewal confirmation subject with addonName', () => {
                // Arrange
                const data = { addonName: 'Premium Support' };

                // Act
                const result = getSubject(NotificationType.ADDON_RENEWAL_CONFIRMATION, data);

                // Assert
                expect(result).toBe('Add-on renovado - Premium Support');
            });

            it('should return trial ending reminder subject', () => {
                // Arrange
                const data = {};

                // Act
                const result = getSubject(NotificationType.TRIAL_ENDING_REMINDER, data);

                // Assert
                expect(result).toBe('Tu período de prueba termina pronto');
            });

            it('should return trial expired subject', () => {
                // Arrange
                const data = {};

                // Act
                const result = getSubject(NotificationType.TRIAL_EXPIRED, data);

                // Assert
                expect(result).toBe('Tu período de prueba ha finalizado');
            });

            it('should return admin payment failure subject with userEmail', () => {
                // Arrange
                const data = { userEmail: 'user@example.com' };

                // Act
                const result = getSubject(NotificationType.ADMIN_PAYMENT_FAILURE, data);

                // Assert
                expect(result).toBe('[Admin] Fallo de pago - user@example.com');
            });

            it('should return admin system event subject with eventType', () => {
                // Arrange
                const data = { eventType: 'high_error_rate' };

                // Act
                const result = getSubject(NotificationType.ADMIN_SYSTEM_EVENT, data);

                // Assert
                expect(result).toBe('[Admin] Evento del sistema - high_error_rate');
            });
        });

        describe('Placeholder replacement', () => {
            it('should replace single placeholder with provided value', () => {
                // Arrange
                const data = { planName: 'Starter' };

                // Act
                const result = getSubject(NotificationType.SUBSCRIPTION_PURCHASE, data);

                // Assert
                expect(result).toContain('Starter');
                expect(result).not.toContain('{planName}');
            });

            it('should replace multiple placeholders in the same subject', () => {
                // Arrange - ADDON_EXPIRATION_WARNING has {addonName}
                const data = { addonName: 'Custom Widget' };

                // Act
                const result = getSubject(NotificationType.ADDON_EXPIRATION_WARNING, data);

                // Assert
                expect(result).toContain('Custom Widget');
                expect(result).not.toContain('{addonName}');
            });

            it('should handle special characters in replacement values', () => {
                // Arrange
                const data = { planName: 'Plan "Especial" & Premium' };

                // Act
                const result = getSubject(NotificationType.SUBSCRIPTION_PURCHASE, data);

                // Assert
                expect(result).toBe('Confirmación de compra - Plan "Especial" & Premium');
            });

            it('should handle empty string as replacement value', () => {
                // Arrange
                const data = { planName: '' };

                // Act
                const result = getSubject(NotificationType.SUBSCRIPTION_PURCHASE, data);

                // Assert
                expect(result).toBe('Confirmación de compra - ');
            });
        });

        describe('Missing variables handling', () => {
            it('should preserve placeholder when variable is not provided', () => {
                // Arrange
                const data = {};

                // Act
                const result = getSubject(NotificationType.ADDON_PURCHASE, data);

                // Assert
                expect(result).toBe('Add-on adquirido - {addonName}');
            });

            it('should preserve placeholder when data has unrelated keys', () => {
                // Arrange
                const data = { unrelatedKey: 'value' };

                // Act
                const result = getSubject(NotificationType.SUBSCRIPTION_PURCHASE, data);

                // Assert
                expect(result).toBe('Confirmación de compra - {planName}');
            });

            it('should replace only provided variables and preserve missing ones', () => {
                // Arrange - admin_payment_failure has {userEmail}
                const data = { otherKey: 'value' };

                // Act
                const result = getSubject(NotificationType.ADMIN_PAYMENT_FAILURE, data);

                // Assert
                expect(result).toContain('{userEmail}');
            });
        });

        describe('Fallback for unknown types', () => {
            it('should return fallback subject for unknown notification type', () => {
                // Arrange
                const unknownType = 'completely_unknown_type' as NotificationType;
                const data = {};

                // Act
                const result = getSubject(unknownType, data);

                // Assert
                expect(result).toBe('Notificación de Hospeda');
            });

            it('should return fallback subject for empty string type', () => {
                // Arrange
                const emptyType = '' as NotificationType;
                const data = {};

                // Act
                const result = getSubject(emptyType, data);

                // Assert
                expect(result).toBe('Notificación de Hospeda');
            });
        });

        // Soft-cancel confirmation subjects (SPEC-147)
        describe('SPEC-147 subscription cancel subjects', () => {
            it('SUBSCRIPTION_CANCEL_CONFIRMED: should replace planName and accessUntil', () => {
                // The caller (notification.service.ts generateSubject) is responsible for
                // pre-formatting accessUntil to a locale string before passing to getSubject.
                // Here we verify the pattern substitution works correctly with a formatted date.
                const data = { planName: 'Pro Host', accessUntil: '15 de julio de 2026' };

                const result = getSubject(NotificationType.SUBSCRIPTION_CANCEL_CONFIRMED, data);

                expect(result).toBe(
                    'Cancellation confirmed — Pro Host access until 15 de julio de 2026'
                );
                // Must not contain a raw ISO timestamp
                expect(result).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/);
            });

            it('SUBSCRIPTION_CANCEL_CONFIRMED: preserves placeholder when accessUntil is missing', () => {
                const data = { planName: 'Starter' };

                const result = getSubject(NotificationType.SUBSCRIPTION_CANCEL_CONFIRMED, data);

                expect(result).toContain('{accessUntil}');
                expect(result).toContain('Starter');
            });

            it('SUBSCRIPTION_ACCESS_ENDING_SOON: should replace planName and daysRemaining (no accessUntil in subject)', () => {
                const data = { planName: 'Pro Host', daysRemaining: '3' };

                const result = getSubject(NotificationType.SUBSCRIPTION_ACCESS_ENDING_SOON, data);

                expect(result).toBe('Your Pro Host access ends in 3 days — act now to keep it');
                // accessUntil is NOT in this subject pattern (it's used in the email body only)
                expect(result).not.toContain('{accessUntil}');
            });
        });

        // AI cost threshold alert subjects (SPEC-173 T-025)
        describe('AI cost threshold alert subjects', () => {
            it('should return subject with thresholdPct and scope for global 50% alert', () => {
                // Arrange
                const data = { thresholdPct: '50', scope: 'global' };

                // Act
                const result = getSubject(NotificationType.AI_COST_THRESHOLD_ALERT, data);

                // Assert
                expect(result).toBe('[Admin] Alerta de costo IA — 50% del presupuesto (global)');
            });

            it('should return subject with thresholdPct and scope for feature 80% alert', () => {
                // Arrange
                const data = { thresholdPct: '80', scope: 'feature:chat' };

                // Act
                const result = getSubject(NotificationType.AI_COST_THRESHOLD_ALERT, data);

                // Assert
                expect(result).toBe(
                    '[Admin] Alerta de costo IA — 80% del presupuesto (feature:chat)'
                );
            });

            it('should return subject with thresholdPct=100 for 100% threshold', () => {
                // Arrange
                const data = { thresholdPct: '100', scope: 'global' };

                // Act
                const result = getSubject(NotificationType.AI_COST_THRESHOLD_ALERT, data);

                // Assert
                expect(result).toBe('[Admin] Alerta de costo IA — 100% del presupuesto (global)');
            });

            it('should preserve placeholder text when thresholdPct is missing', () => {
                // Arrange
                const data = { scope: 'global' };

                // Act
                const result = getSubject(NotificationType.AI_COST_THRESHOLD_ALERT, data);

                // Assert — placeholder preserved when variable missing
                expect(result).toContain('{thresholdPct}');
                expect(result).toContain('global');
            });
        });
    });
});
