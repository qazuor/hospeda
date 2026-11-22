/**
 * Catalog entries of the billing notice outbox mails: renewal, grace reminder,
 * promo ending, plan migration (announced, upcoming, cancelled), courtesy
 * revocation and the provider watch alert.
 *
 * Money amounts in payloads are integer minor units (centavos), as the
 * renderers expect.
 *
 * @module catalog/entries/outbox-billing-notices
 */

import { defineOutboxEntry } from '../define-entry.js';
import type { EmailCatalogEntry } from '../types.js';

const SUBSCRIPTION_ID = '00000000-0000-4000-8000-000000000101';

const MIGRATION_DETAILS = {
    planName: 'Plan Básico',
    targetPlanName: 'Plan Profesional',
    direction: 'UP',
    losesPromo: false,
    currentAmountMinor: 1500000,
    newAmountMinor: 2200000,
    currency: 'ARS'
} as const;

/** The billing notice outbox mails. */
export const OUTBOX_BILLING_NOTICES_ENTRIES: readonly EmailCatalogEntry[] = [
    defineOutboxEntry({
        template: 'billing.renewal-upcoming',
        name: 'Aviso de renovación próxima',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'card',
                label: 'Pago con tarjeta (cobro automático)',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        planName: 'Plan Profesional',
                        renewalDate: '2026-12-15',
                        daysBefore: 7,
                        paymentMethod: 'CARD'
                    }
                }
            },
            {
                id: 'manual',
                label: 'Pago manual (el titular debe pagar)',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        planName: 'Plan Profesional',
                        renewalDate: '2026-12-15',
                        daysBefore: 7,
                        paymentMethod: 'MANUAL'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.grace-reminder',
        name: 'Recordatorio de período de gracia',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'card',
                label: 'Pago con tarjeta',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        graceEndsAt: '2026-12-20T15:00:00.000Z',
                        daysBefore: 3,
                        deadlinesVersion: 1,
                        paymentMethod: 'CARD'
                    }
                }
            },
            {
                id: 'manual',
                label: 'Pago manual',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'venue',
                        graceEndsAt: '2026-12-20T15:00:00.000Z',
                        daysBefore: 3,
                        deadlinesVersion: 1,
                        paymentMethod: 'MANUAL'
                    }
                }
            },
            {
                id: 'with-plan-change',
                label: 'Con un cambio de plan programado',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        vertical: 'accommodation',
                        graceEndsAt: '2026-12-20T15:00:00.000Z',
                        daysBefore: 3,
                        deadlinesVersion: 1,
                        paymentMethod: 'CARD',
                        planChangePending: true,
                        scheduledChange: {
                            planName: 'Plan Profesional',
                            effectiveAt: '2027-01-05T03:00:00.000Z'
                        }
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.promo-ending',
        name: 'Aviso de fin de promoción',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Último cobro con descuento',
                input: {
                    payload: {
                        planName: 'Plan Profesional',
                        lastDiscountedChargeDate: '2026-12-15',
                        amountAfterMinor: 2200000,
                        currency: 'ARS'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.plan-migration-announced',
        name: 'Anuncio de migración de plan',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'scheduled',
                label: 'Migración con fecha programada',
                input: {
                    payload: {
                        ...MIGRATION_DETAILS,
                        variant: 'SCHEDULED',
                        applicationDate: '2027-01-15'
                    }
                }
            },
            {
                id: 'on-hold',
                label: 'Migración en espera de fecha',
                input: { payload: { ...MIGRATION_DETAILS, variant: 'WAITING' } }
            },
            {
                id: 'to-resolve',
                label: 'Plan retirado, destino por resolver',
                input: { payload: { variant: 'TO_RESOLVE', planName: 'Plan Básico' } }
            },
            {
                id: 'price-increase',
                label: 'Aumento de precio programado, con promo perdida',
                input: {
                    payload: {
                        ...MIGRATION_DETAILS,
                        targetPlanName: 'Plan Básico',
                        losesPromo: true,
                        variant: 'SCHEDULED',
                        applicationDate: '2027-01-15',
                        reason: 'PRICE_INCREASE'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.plan-migration-upcoming',
        name: 'Recordatorio de migración de plan próxima',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'plan-retirement',
                label: 'Retiro de plan, sube de precio',
                input: {
                    payload: {
                        ...MIGRATION_DETAILS,
                        applicationDate: '2027-01-15',
                        daysBefore: 7
                    }
                }
            },
            {
                id: 'price-increase-provider-notifies',
                label: 'Aumento de precio, notifica el proveedor de pagos',
                input: {
                    payload: {
                        ...MIGRATION_DETAILS,
                        targetPlanName: 'Plan Básico',
                        losesPromo: true,
                        applicationDate: '2027-01-15',
                        daysBefore: 7,
                        providerNotifies: true,
                        reason: 'PRICE_INCREASE'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.plan-migration-cancelled',
        name: 'Cancelación de migración de plan',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'nothing-changes',
                label: 'Cancelada, no cambia nada',
                input: { payload: { variant: 'NOTHING_CHANGES', planName: 'Plan Básico' } }
            },
            {
                id: 'already-started',
                label: 'Cancelada con el cambio ya iniciado',
                input: {
                    payload: {
                        variant: 'ALREADY_STARTED',
                        planName: 'Plan Básico',
                        applicationDate: '2027-01-15',
                        newAmountMinor: 2200000,
                        currency: 'ARS'
                    }
                }
            },
            {
                id: 'price-increase-nothing-changes',
                label: 'Aumento de precio cancelado, no cambia nada',
                input: {
                    payload: {
                        variant: 'NOTHING_CHANGES',
                        planName: 'Plan Básico',
                        reason: 'PRICE_INCREASE'
                    }
                }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.courtesy-revoked',
        name: 'Aviso de cortesía revocada',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Cortesía revocada con próximo cobro',
                input: { payload: { nextChargeOn: '2026-12-15' } }
            }
        ]
    }),
    defineOutboxEntry({
        template: 'billing.provider-watch-alert',
        name: 'Alerta de vigilancia del proveedor de pagos',
        domain: 'billing',
        audience: 'staff',
        scenarios: [
            {
                id: 'value-changed',
                label: 'Cambio de valor en sandbox',
                input: {
                    payload: {
                        account: 'sandbox',
                        finishedAt: '2026-11-21T09:00:00-03:00',
                        alerts: [
                            {
                                measurementId: 'measurement-example-1',
                                kind: 'value_changed',
                                label: 'Medición de ejemplo',
                                expected: 'authorized',
                                obtained: 'pending',
                                details: ['El estado devuelto difiere del esperado (ejemplo).']
                            }
                        ],
                        omitted: 0
                    }
                }
            },
            {
                id: 'run-failed',
                label: 'Corrida fallida en producción, con alertas omitidas',
                input: {
                    payload: {
                        account: 'production',
                        finishedAt: '2026-11-21T09:00:00-03:00',
                        alerts: [
                            {
                                measurementId: 'measurement-example-2',
                                kind: 'measurement_errored',
                                expected: 'respuesta 200',
                                obtained: 'tiempo de espera agotado',
                                details: []
                            }
                        ],
                        run: { outcome: 'failed', reason: 'Fallo de ejemplo en la corrida.' },
                        omitted: 2
                    }
                }
            }
        ]
    })
];
