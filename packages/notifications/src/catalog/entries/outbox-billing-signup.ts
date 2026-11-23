/**
 * Catalog entries of the subscription signup and lifecycle outbox mails
 * (`createBillingSignupRenderers`).
 *
 * @module catalog/entries/outbox-billing-signup
 */

import { defineOutboxEntry } from '../define-entry.js';
import type { EmailCatalogEntry } from '../types.js';

const SUBSCRIPTION_ID = '00000000-0000-4000-8000-000000000211';
const PAYMENT_ID = '00000000-0000-4000-8000-000000000212';
const RECEIPT_ID = '00000000-0000-4000-8000-000000000213';
const ADDON_INSTANCE_ID = '00000000-0000-4000-8000-000000000214';

/** The signup and lifecycle billing outbox mails. */
export const OUTBOX_BILLING_SIGNUP_ENTRIES: readonly EmailCatalogEntry[] = [
    defineOutboxEntry({
        template: 'billing.signup-declined',
        name: 'Alta rechazada',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'provider-risk',
                label: 'Rechazo por riesgo del proveedor',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        declineReason: 'cc_rejected_high_risk',
                        successionPredecessor: false
                    }
                }
            },
            {
                id: 'payment-method',
                label: 'Rechazo por medio de pago',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        declineReason: 'cc_rejected_insufficient_amount',
                        successionPredecessor: false
                    }
                }
            },
            {
                id: 'unknown-reason',
                label: 'Motivo desconocido',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'venue',
                        declineReason: null,
                        successionPredecessor: false
                    }
                }
            },
            {
                id: 'succession-retry',
                label: 'Cambio de plan: terminar el checkout del sucesor',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        declineReason: 'payment_method_not_ready',
                        successionPredecessor: true
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.grace-started',
        name: 'Comenzó el período de gracia',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Sin cambio de plan pendiente',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        graceEndsAt: '2026-03-20T03:00:00.000Z'
                    }
                }
            },
            {
                id: 'plan-change-pending',
                label: 'Con cambio de plan pendiente',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        graceEndsAt: '2026-03-20T03:00:00.000Z',
                        planChangePending: true
                    }
                }
            },
            {
                id: 'scheduled-change',
                label: 'Con cambio programado de plan',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        graceEndsAt: '2026-03-20T03:00:00.000Z',
                        scheduledChange: {
                            planName: 'Plan Profesional',
                            effectiveAt: '2026-04-01T03:00:00.000Z'
                        }
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.paid-after-cancellation',
        name: 'Pago recibido tras la cancelación',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Sin complementos recurrentes cortados',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        serviceEndsAt: '2026-03-31T03:00:00.000Z',
                        recurringAddonsCut: false
                    }
                }
            },
            {
                id: 'addons-cut',
                label: 'Con complementos recurrentes cortados',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        serviceEndsAt: '2026-03-31T03:00:00.000Z',
                        recurringAddonsCut: true
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.payment-credited',
        name: 'Pago acreditado',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'subscription',
                label: 'Pago de una suscripción con plan',
                input: {
                    payload: {
                        paymentId: PAYMENT_ID,
                        subscriptionId: SUBSCRIPTION_ID,
                        receiptId: RECEIPT_ID,
                        receiptNumber: 1042,
                        amountMinor: 1500000,
                        currency: 'ARS',
                        planName: 'Plan Profesional'
                    }
                }
            },
            {
                id: 'addon',
                label: 'Pago de un complemento, sin plan',
                input: {
                    payload: {
                        paymentId: PAYMENT_ID,
                        addonInstanceId: ADDON_INSTANCE_ID,
                        receiptId: RECEIPT_ID,
                        receiptNumber: 1043,
                        amountMinor: 450000,
                        currency: 'ARS'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.signup-confirmed',
        name: 'Suscripción activa',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'with-payment',
                label: 'Con primer pago y próximo cobro',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        planName: 'Plan Profesional',
                        firstPayment: { amountMinor: 1500000, currency: 'ARS' },
                        nextChargeDate: '2026-04-01'
                    }
                }
            },
            {
                id: 'still-processing',
                label: 'Pago todavía en proceso',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        planName: 'Plan Profesional'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.before-cancel',
        name: 'Autorización pendiente vencida',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Autorización vencida antes del cobro',
                input: { payload: { subscriptionId: SUBSCRIPTION_ID } }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.signup-incomplete',
        name: 'Alta sin completar',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Sin cortesía cerrada',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        paymentMethod: 'CARD',
                        windowEndsAt: null,
                        closedCourtesyMonths: null
                    }
                }
            },
            {
                id: 'courtesy-closed',
                label: 'Con cortesía cerrada',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'venue',
                        paymentMethod: 'MANUAL',
                        windowEndsAt: '2026-03-15T03:00:00.000Z',
                        closedCourtesyMonths: 3
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.arrears-suspension',
        name: 'Suspensión por mora',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'card-basic',
                label: 'Tarjeta, sin pérdidas adicionales',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        paymentMethod: 'CARD',
                        touristVipLost: false,
                        promoLost: false,
                        oneTimeAddons: []
                    }
                }
            },
            {
                id: 'manual-with-losses',
                label: 'Pago manual, con Turista VIP, promoción y complementos perdidos',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        paymentMethod: 'MANUAL',
                        touristVipLost: true,
                        promoLost: true,
                        oneTimeAddons: [
                            { name: 'Impulso de visibilidad 7 días (ejemplo)', remainingDays: 1 },
                            { name: 'Destacado de portada 30 días (ejemplo)', remainingDays: 12 }
                        ]
                    }
                }
            }
        ]
    })
];
