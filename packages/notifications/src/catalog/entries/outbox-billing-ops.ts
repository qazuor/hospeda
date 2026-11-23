/**
 * Catalog entries of the billing operations outbox mails: reconciliation
 * notices, manual installments, late-payment refunds, one-time add-ons and
 * chargebacks.
 *
 * The reconciliation summary resolves holders and plans through a reader the
 * host app fakes for the preview; the one-time add-on mail reads listing names
 * through a fake reader too.
 *
 * @module catalog/entries/outbox-billing-ops
 */

import { defineOutboxEntry } from '../define-entry.js';
import type { EmailCatalogEntry } from '../types.js';

const SUBSCRIPTION_ID = '00000000-0000-4000-8000-000000000201';
const ADDON_INSTANCE_ID = '00000000-0000-4000-8000-000000000202';
const MARK_ID = '00000000-0000-4000-8000-000000000203';
const PAYMENT_ID = '00000000-0000-4000-8000-000000000204';
const MANUAL_PAYMENT_ID = '00000000-0000-4000-8000-000000000205';
const REFUND_ID = '00000000-0000-4000-8000-000000000206';
const LISTING_ID = '00000000-0000-4000-8000-000000000207';
const WINDOW_ID = '00000000-0000-4000-8000-000000000208';
const PAUSE_ID = '00000000-0000-4000-8000-000000000209';

const QUIET_OMITTED = { marks: 0, escalations: 0, underCharges: 0, pauseGifts: 0 };

/** The billing operations outbox mails. */
export const OUTBOX_BILLING_OPS_ENTRIES: readonly EmailCatalogEntry[] = [
    defineOutboxEntry({
        template: 'billing.reconciliation-summary',
        name: 'Resumen de conciliación de cobros',
        domain: 'billing',
        audience: 'staff',
        scenarios: [
            {
                id: 'populated',
                label: 'Con novedades en todas las secciones',
                input: {
                    payload: {
                        windowId: WINDOW_ID,
                        coversFrom: '2026-03-01T03:00:00.000Z',
                        closesAt: '2026-03-02T03:00:00.000Z',
                        windowMinutes: 1440,
                        totals: { events: 6 },
                        marks: [
                            {
                                reason: 'COBRO_DUPLICADO',
                                subjectType: 'subscription',
                                subjectId: SUBSCRIPTION_ID,
                                count: 2
                            },
                            {
                                reason: 'COBRO_DUPLICADO',
                                subjectType: 'addon_instance',
                                subjectId: ADDON_INSTANCE_ID,
                                count: 1
                            }
                        ],
                        escalations: [
                            {
                                reason: 'COBRO_DUPLICADO',
                                subjectType: 'subscription',
                                subjectId: SUBSCRIPTION_ID,
                                markId: MARK_ID
                            }
                        ],
                        underCharges: [
                            {
                                subscriptionId: SUBSCRIPTION_ID,
                                paymentId: PAYMENT_ID,
                                currency: 'ARS',
                                expectedMinor: 1500000,
                                chargedMinor: 1200000,
                                differenceMinor: 300000
                            }
                        ],
                        pauseGifts: [
                            {
                                subscriptionId: SUBSCRIPTION_ID,
                                pauseId: PAUSE_ID,
                                pauseStartedAt: '2026-02-01T03:00:00.000Z',
                                pauseEndedAt: '2026-02-15T03:00:00.000Z',
                                skippedChargeAt: '2026-02-10T03:00:00.000Z',
                                nextChargeAfterReturnAt: '2026-03-10T03:00:00.000Z',
                                giftDays: 14
                            }
                        ],
                        omitted: { marks: 3, escalations: 0, underCharges: 1, pauseGifts: 0 }
                    }
                }
            },
            {
                id: 'quiet-day',
                label: 'Día tranquilo, sin novedades',
                input: {
                    payload: {
                        windowId: WINDOW_ID,
                        coversFrom: '2026-03-01T03:00:00.000Z',
                        closesAt: '2026-03-02T03:00:00.000Z',
                        windowMinutes: 1440,
                        totals: { events: 0 },
                        marks: [],
                        escalations: [],
                        underCharges: [],
                        pauseGifts: [],
                        omitted: QUIET_OMITTED
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.duplicate-charge-detected',
        name: 'Cobro duplicado detectado',
        domain: 'billing',
        audience: 'staff',
        scenarios: [
            {
                id: 'subscription',
                label: 'Sobre una suscripción',
                input: {
                    payload: {
                        markId: MARK_ID,
                        subjectType: 'subscription',
                        subjectId: SUBSCRIPTION_ID,
                        reason: 'COBRO_DUPLICADO',
                        paymentId: PAYMENT_ID,
                        openedAt: '2026-03-02T14:30:00.000Z'
                    }
                }
            },
            {
                id: 'addon-without-payment',
                label: 'Sobre un complemento, sin pago asociado',
                input: {
                    payload: {
                        markId: MARK_ID,
                        subjectType: 'addon_instance',
                        subjectId: ADDON_INSTANCE_ID,
                        reason: 'COBRO_DUPLICADO',
                        paymentId: null,
                        openedAt: '2026-03-02T14:30:00.000Z'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.mark-escalated',
        name: 'Marca de conciliación escalada',
        domain: 'billing',
        audience: 'staff',
        scenarios: [
            {
                id: 'default',
                label: 'Marca escalada tras el plazo',
                input: {
                    payload: {
                        markId: MARK_ID,
                        subjectType: 'subscription',
                        subjectId: SUBSCRIPTION_ID,
                        reason: 'COBRO_DUPLICADO',
                        placedAt: '2026-03-01T14:30:00.000Z',
                        escalatedAt: '2026-03-08T14:30:00.000Z',
                        escalationDays: 7
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.revocation-refund-failed',
        name: 'Falló el reembolso por revocación',
        domain: 'billing',
        audience: 'staff',
        scenarios: [
            {
                id: 'revocation-payment',
                label: 'Revocación de una suscripción (pago)',
                input: {
                    payload: {
                        refundId: REFUND_ID,
                        refundReason: 'REVOCATION',
                        sourceKind: 'payment',
                        sourceId: PAYMENT_ID,
                        subjectType: 'subscription',
                        subjectId: SUBSCRIPTION_ID,
                        amountMinor: 1500000,
                        currency: 'ARS',
                        failedAt: '2026-03-05T16:00:00.000Z'
                    }
                }
            },
            {
                id: 'one-time-addon-manual',
                label: 'Complemento único, pago manual, sin sujeto',
                input: {
                    payload: {
                        refundId: REFUND_ID,
                        refundReason: 'ONE_TIME_ADDON_REVOCATION',
                        sourceKind: 'manual_payment',
                        sourceId: MANUAL_PAYMENT_ID,
                        subjectType: null,
                        subjectId: null,
                        amountMinor: 450000,
                        currency: null,
                        failedAt: '2026-03-05T16:00:00.000Z'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.manual-installment-unpaid',
        name: 'Cuota de pago manual sin pago',
        domain: 'billing',
        audience: 'staff',
        scenarios: [
            {
                id: 'first-installment',
                label: 'Primera cuota',
                input: {
                    payload: {
                        manualPaymentId: MANUAL_PAYMENT_ID,
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        periodStart: '2026-03-01T03:00:00.000Z',
                        openedAt: '2026-03-01T03:00:00.000Z',
                        firstInstallment: true
                    }
                }
            },
            {
                id: 'renewal-installment',
                label: 'Cuota de renovación',
                input: {
                    payload: {
                        manualPaymentId: MANUAL_PAYMENT_ID,
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'venue',
                        periodStart: '2026-04-01T03:00:00.000Z',
                        openedAt: '2026-04-01T03:00:00.000Z',
                        firstInstallment: false
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.manual-installment-opened',
        name: 'Cuota de pago manual abierta',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'es-first',
                label: 'Primera cuota con importe (español)',
                input: {
                    payload: {
                        manualPaymentId: MANUAL_PAYMENT_ID,
                        subscriptionId: SUBSCRIPTION_ID,
                        locale: 'es',
                        planSlug: 'partner-gold',
                        planName: 'Plan Profesional',
                        amountMinor: 3000000,
                        currency: 'ARS',
                        dueAt: '2026-03-15T03:00:00.000Z',
                        firstInstallment: true
                    }
                }
            },
            {
                id: 'es-renewal-no-amount',
                label: 'Renovación sin importe (español)',
                input: {
                    payload: {
                        manualPaymentId: MANUAL_PAYMENT_ID,
                        subscriptionId: SUBSCRIPTION_ID,
                        locale: 'es',
                        planSlug: 'partner-gold',
                        planName: 'Plan Profesional',
                        amountMinor: null,
                        currency: null,
                        dueAt: '2026-04-15T03:00:00.000Z',
                        firstInstallment: false
                    }
                }
            },
            {
                id: 'en-first',
                label: 'Primera cuota con importe (inglés)',
                input: {
                    payload: {
                        manualPaymentId: MANUAL_PAYMENT_ID,
                        subscriptionId: SUBSCRIPTION_ID,
                        locale: 'en',
                        planSlug: 'partner-gold',
                        planName: 'Plan Profesional',
                        amountMinor: 3000000,
                        currency: 'ARS',
                        dueAt: '2026-03-15T03:00:00.000Z',
                        firstInstallment: true
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.late-payment-refunded',
        name: 'Pago tardío reembolsado',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'es',
                label: 'Español',
                input: {
                    payload: {
                        refundId: REFUND_ID,
                        paymentId: PAYMENT_ID,
                        addonInstanceId: ADDON_INSTANCE_ID,
                        locale: 'es',
                        addonSlug: 'visibility-boost-7d',
                        addonName: 'Impulso de visibilidad 7 días',
                        amountMinor: 1500000,
                        currency: 'ARS'
                    }
                }
            },
            {
                id: 'en',
                label: 'Inglés',
                input: {
                    payload: {
                        refundId: REFUND_ID,
                        paymentId: PAYMENT_ID,
                        addonInstanceId: ADDON_INSTANCE_ID,
                        locale: 'en',
                        addonSlug: 'visibility-boost-7d',
                        addonName: 'Visibility boost 7 days',
                        amountMinor: 1500000,
                        currency: 'ARS'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.one-time-addon-activated',
        name: 'Complemento único activado',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'es-with-listing',
                label: 'Con ficha y fecha de fin (español)',
                input: {
                    payload: {
                        addonInstanceId: ADDON_INSTANCE_ID,
                        locale: 'es',
                        addonSlug: 'visibility-boost-7d',
                        addonName: 'Impulso de visibilidad 7 días',
                        listingId: LISTING_ID,
                        vertical: 'accommodation',
                        endsAt: '2026-03-20T03:00:00.000Z'
                    }
                }
            },
            {
                id: 'es-without-listing',
                label: 'Sin ficha ni fecha de fin (español)',
                input: {
                    payload: {
                        addonInstanceId: ADDON_INSTANCE_ID,
                        locale: 'es',
                        addonSlug: 'visibility-boost-7d',
                        addonName: 'Impulso de visibilidad 7 días',
                        listingId: null,
                        vertical: null,
                        endsAt: null
                    }
                }
            },
            {
                id: 'en-with-listing',
                label: 'Con ficha y fecha de fin (inglés)',
                input: {
                    payload: {
                        addonInstanceId: ADDON_INSTANCE_ID,
                        locale: 'en',
                        addonSlug: 'visibility-boost-7d',
                        addonName: 'Visibility boost 7 days',
                        listingId: LISTING_ID,
                        vertical: 'venue',
                        endsAt: '2026-03-20T03:00:00.000Z'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.addon-listing-purged-cancel',
        name: 'Aviso de ficha borrada con complemento',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Complemento cancelado por ficha borrada',
                input: { payload: { subscriptionId: SUBSCRIPTION_ID } }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.chargeback-suspension',
        name: 'Suspensión por contracargo',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'basic',
                label: 'Contracargo simple',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        paymentMethod: 'CARD',
                        touristVipLost: false,
                        oneTimeAddons: [],
                        chargedBackPayment: {
                            amountMinor: 1500000,
                            currency: 'ARS',
                            chargedOn: '2026-02-20'
                        },
                        courtesyEnded: false
                    }
                }
            },
            {
                id: 'with-losses',
                label: 'Con cortesía cerrada, Turista VIP y complementos perdidos',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'venue',
                        paymentMethod: 'CARD',
                        touristVipLost: true,
                        oneTimeAddons: [
                            { name: 'Impulso de visibilidad 7 días (ejemplo)', remainingDays: 4 }
                        ],
                        chargedBackPayment: {
                            amountMinor: 1500000,
                            currency: 'ARS',
                            chargedOn: '2026-02-20'
                        },
                        courtesyEnded: true
                    }
                }
            }
        ]
    })
];
