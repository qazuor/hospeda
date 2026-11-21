/**
 * Catalog entries of the billing notifications
 * (`services/notification-templates/billing.ts`): purchases, payments,
 * renewals, plan changes, courtesy and comp grants.
 *
 * @module catalog/entries/notification-billing
 */

import {
    type CompGrantedPayload,
    type CourtesyPayload,
    NotificationType,
    type PaymentNotificationPayload,
    type PaymentRetryWarningPayload,
    type PlanBeingRetiredPayload,
    type PlanDowngradeLimitWarningPayload,
    type PlanPriceChangeNoticePayload,
    type PurchaseConfirmationPayload,
    type SubscriptionEventPayload
} from '../../types/notification.types.js';
import { defineNotificationEntry } from '../define-entry.js';
import { SAMPLE_RECIPIENT } from '../sample-data.js';
import type { EmailCatalogEntry } from '../types.js';

/** The billing notifications. */
export const NOTIFICATION_BILLING_ENTRIES: readonly EmailCatalogEntry[] = [
    defineNotificationEntry<PurchaseConfirmationPayload>({
        type: NotificationType.SUBSCRIPTION_PURCHASE,
        name: 'Confirmación de compra',
        domain: 'billing',
        scenarios: [
            {
                id: 'monthly',
                label: 'Plan mensual',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.SUBSCRIPTION_PURCHASE,
                    planName: 'Plan Profesional',
                    amount: 15000,
                    currency: 'ARS',
                    billingPeriod: 'monthly',
                    nextBillingDate: '2026-02-15'
                }
            },
            {
                id: 'annual',
                label: 'Plan anual',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.SUBSCRIPTION_PURCHASE,
                    planName: 'Plan Profesional',
                    amount: 150000,
                    currency: 'ARS',
                    billingPeriod: 'annual',
                    nextBillingDate: '2027-01-15'
                }
            },
            {
                id: 'minimal',
                label: 'Sin período ni próxima facturación',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.SUBSCRIPTION_PURCHASE,
                    planName: 'Plan Profesional',
                    amount: 15000,
                    currency: 'ARS'
                }
            }
        ]
    }),
    defineNotificationEntry<PaymentNotificationPayload>({
        type: NotificationType.PAYMENT_SUCCESS,
        name: 'Pago recibido',
        domain: 'billing',
        scenarios: [
            {
                id: 'with-payment-method',
                label: 'Con medio de pago',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PAYMENT_SUCCESS,
                    amount: 15000,
                    currency: 'ARS',
                    planName: 'Plan Profesional',
                    paymentMethod: 'Visa terminada en 4242'
                }
            },
            {
                id: 'without-payment-method',
                label: 'Sin medio de pago',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PAYMENT_SUCCESS,
                    amount: 15000,
                    currency: 'ARS',
                    planName: 'Plan Profesional'
                }
            }
        ]
    }),
    defineNotificationEntry<PaymentNotificationPayload>({
        type: NotificationType.PAYMENT_FAILURE,
        name: 'Pago fallido',
        domain: 'billing',
        scenarios: [
            {
                id: 'with-reason',
                label: 'Con motivo del rechazo',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PAYMENT_FAILURE,
                    amount: 15000,
                    currency: 'ARS',
                    planName: 'Plan Profesional',
                    failureReason: 'Fondos insuficientes'
                }
            },
            {
                id: 'with-retry-url',
                label: 'Con enlace para reintentar el checkout',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PAYMENT_FAILURE,
                    amount: 15000,
                    currency: 'ARS',
                    planName: 'Plan Profesional',
                    failureReason: 'Tarjeta rechazada',
                    retryUrl: 'https://hospeda.com.ar/es/propietarios/planes/reintento-de-ejemplo'
                }
            },
            {
                id: 'without-reason',
                label: 'Sin motivo',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PAYMENT_FAILURE,
                    amount: 15000,
                    currency: 'ARS',
                    planName: 'Plan Profesional'
                }
            }
        ]
    }),
    defineNotificationEntry<SubscriptionEventPayload>({
        type: NotificationType.RENEWAL_REMINDER,
        name: 'Recordatorio de renovación',
        domain: 'billing',
        scenarios: [
            {
                id: 'accommodation-with-amount',
                label: 'Alojamiento, con monto (centavos)',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.RENEWAL_REMINDER,
                    planName: 'Plan Profesional',
                    amount: 1500000,
                    currency: 'ARS',
                    renewalDate: '2026-02-15',
                    daysRemaining: 3,
                    productDomain: 'accommodation'
                }
            },
            {
                id: 'venue-without-amount',
                label: 'Comer y salir, sin monto',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.RENEWAL_REMINDER,
                    planName: 'Plan Profesional',
                    renewalDate: '2026-02-15',
                    daysRemaining: 3,
                    productDomain: 'venue'
                }
            }
        ]
    }),
    defineNotificationEntry<SubscriptionEventPayload>({
        type: NotificationType.PLAN_CHANGE_CONFIRMATION,
        name: 'Confirmación de cambio de plan',
        domain: 'billing',
        scenarios: [
            {
                id: 'with-amount',
                label: 'Con monto (centavos)',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PLAN_CHANGE_CONFIRMATION,
                    planName: 'Plan Premium',
                    oldPlanName: 'Plan Profesional',
                    newPlanName: 'Plan Premium',
                    amount: 2500000,
                    currency: 'ARS'
                }
            },
            {
                id: 'without-amount',
                label: 'Sin monto',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PLAN_CHANGE_CONFIRMATION,
                    planName: 'Plan Premium',
                    oldPlanName: 'Plan Profesional',
                    newPlanName: 'Plan Premium'
                }
            }
        ]
    }),
    defineNotificationEntry<CourtesyPayload>({
        type: NotificationType.COURTESY_GRANTED,
        name: 'Cortesía otorgada',
        domain: 'billing',
        scenarios: [
            {
                id: 'default',
                label: 'Tres ciclos de cortesía',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.COURTESY_GRANTED,
                    planName: 'Plan Profesional',
                    cycles: 3,
                    startsAt: '1 de febrero de 2026',
                    endsAt: '1 de mayo de 2026'
                }
            }
        ]
    }),
    defineNotificationEntry<CourtesyPayload>({
        type: NotificationType.COURTESY_STARTED,
        name: 'Cortesía iniciada',
        domain: 'billing',
        scenarios: [
            {
                id: 'default',
                label: 'Cortesía en curso',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.COURTESY_STARTED,
                    planName: 'Plan Profesional',
                    endsAt: '1 de mayo de 2026'
                }
            }
        ]
    }),
    defineNotificationEntry<CompGrantedPayload>({
        type: NotificationType.COMP_GRANTED,
        name: 'Suscripción de cortesía otorgada',
        domain: 'billing',
        scenarios: [
            {
                id: 'had-active-billing',
                label: 'Tenía cobro activo cancelado',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.COMP_GRANTED,
                    planName: 'Plan Profesional',
                    hadActiveBilling: true
                }
            },
            {
                id: 'no-active-billing',
                label: 'Sin cobro activo previo',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.COMP_GRANTED,
                    planName: 'Plan Profesional',
                    hadActiveBilling: false
                }
            }
        ]
    }),
    defineNotificationEntry<CourtesyPayload>({
        type: NotificationType.COURTESY_ENDED,
        name: 'Cortesía finalizada',
        domain: 'billing',
        scenarios: [
            {
                id: 'with-next-billing',
                label: 'Con próxima facturación',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.COURTESY_ENDED,
                    planName: 'Plan Profesional',
                    nextBillingDate: '1 de mayo de 2026'
                }
            },
            {
                id: 'without-next-billing',
                label: 'Sin próxima facturación',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.COURTESY_ENDED,
                    planName: 'Plan Profesional'
                }
            }
        ]
    }),
    defineNotificationEntry<PlanDowngradeLimitWarningPayload>({
        type: NotificationType.PLAN_DOWNGRADE_LIMIT_WARNING,
        name: 'Aviso de límite por cambio a un plan menor',
        domain: 'billing',
        scenarios: [
            {
                id: 'default',
                label: 'Uso por encima del nuevo límite',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PLAN_DOWNGRADE_LIMIT_WARNING,
                    planName: 'Plan Básico',
                    limitKey: 'accommodations',
                    oldLimit: 10,
                    newLimit: 3,
                    currentUsage: 5
                }
            }
        ]
    }),
    defineNotificationEntry<PaymentRetryWarningPayload>({
        type: NotificationType.PAYMENT_RETRY_WARNING,
        name: 'Aviso de reintento de pago',
        domain: 'billing',
        scenarios: [
            {
                id: 'with-payment-method-hint',
                label: 'Con medio de pago',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PAYMENT_RETRY_WARNING,
                    failureCount: 1,
                    maxRetries: 3,
                    paymentMethodHint: 'Visa terminada en 4242'
                }
            },
            {
                id: 'last-attempt',
                label: 'Último intento, sin medio de pago',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PAYMENT_RETRY_WARNING,
                    failureCount: 3,
                    maxRetries: 3
                }
            }
        ]
    }),
    defineNotificationEntry<PlanBeingRetiredPayload>({
        type: NotificationType.PLAN_BEING_RETIRED,
        name: 'Plan en retiro',
        domain: 'subscription',
        scenarios: [
            {
                id: 'default',
                label: 'Con fecha de acceso y sugerencia',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PLAN_BEING_RETIRED,
                    planName: 'Plan Heredado',
                    accessUntil: '2026-03-31T23:59:59.000Z',
                    migrationHint: 'Suscribite a otro plan para conservar tus beneficios.'
                }
            }
        ]
    }),
    defineNotificationEntry<PlanPriceChangeNoticePayload>({
        type: NotificationType.PLAN_PRICE_CHANGE_NOTICE,
        name: 'Aviso de cambio de precio',
        domain: 'billing',
        scenarios: [
            {
                id: 'monthly',
                label: 'Precio mensual (centavos)',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PLAN_PRICE_CHANGE_NOTICE,
                    planName: 'Plan Profesional',
                    oldPriceArs: 1500000,
                    newPriceArs: 1800000,
                    effectiveDate: '2026-03-15T00:00:00.000Z',
                    billingInterval: 'month'
                }
            },
            {
                id: 'annual',
                label: 'Precio anual (centavos)',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.PLAN_PRICE_CHANGE_NOTICE,
                    planName: 'Plan Profesional',
                    oldPriceArs: 15000000,
                    newPriceArs: 18000000,
                    effectiveDate: '2026-03-15T00:00:00.000Z',
                    billingInterval: 'year'
                }
            }
        ]
    })
];
