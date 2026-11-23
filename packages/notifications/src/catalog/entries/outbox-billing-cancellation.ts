/**
 * Catalog entries of the billing cancellation outbox mails
 * (`createBillingSignupRenderers`, cancellation family).
 *
 * Most renderers only require `subscriptionId`; the scheduled cancellation
 * additionally reads an optional `serviceEndsAt` instant.
 *
 * @module catalog/entries/outbox-billing-cancellation
 */

import { defineOutboxEntry } from '../define-entry.js';
import type { EmailCatalogEntry } from '../types.js';

const SUBSCRIPTION_ID = '00000000-0000-4000-8000-000000000301';

const simple = (template: string, name: string, label: string): EmailCatalogEntry =>
    defineOutboxEntry({
        template,
        name,
        domain: 'billing',
        audience: 'user',
        scenarios: [
            { id: 'default', label, input: { payload: { subscriptionId: SUBSCRIPTION_ID } } }
        ]
    });

/** The fourteen billing cancellation mails. */
export const OUTBOX_BILLING_CANCELLATION_ENTRIES: readonly EmailCatalogEntry[] = [
    simple(
        'billing.attempt-replaced-cancel',
        'Aviso de intento de alta reemplazado',
        'Intento reemplazado'
    ),
    simple(
        'billing.attempt-cancelled-cancel',
        'Aviso de intento de alta cancelado',
        'Intento pendiente cancelado'
    ),
    simple(
        'billing.tourist-vip-inherited-cancel',
        'Aviso de cancelación de Turista VIP heredado',
        'Turista VIP heredado'
    ),
    simple(
        'billing.addon-cancelled',
        'Aviso de cancelación de un complemento',
        'Complemento cancelado'
    ),
    simple(
        'billing.addon-authorization-expired-cancel',
        'Aviso de autorización de complemento vencida',
        'Autorización vencida'
    ),
    simple(
        'billing.first-charge-declined-cancel',
        'Aviso de cancelación por primer cobro rechazado',
        'Primer cobro rechazado'
    ),
    simple(
        'billing.revocation-cancel',
        'Aviso de cancelación por revocación',
        'Autorización revocada'
    ),
    simple(
        'billing.permanent-grant-cancel',
        'Aviso de cancelación por beneficio permanente',
        'Beneficio permanente'
    ),
    simple(
        'billing.permanent-grant-addon-cancel',
        'Aviso de cancelación de complemento por beneficio permanente',
        'Complemento con beneficio permanente'
    ),
    simple(
        'billing.closed-subscription-authorization-cancel',
        'Aviso de cancelación de autorización sobre suscripción cerrada',
        'Autorización que seguía activa'
    ),
    simple(
        'billing.succession-predecessor-cancel',
        'Aviso de cambio de plan (suscripción anterior)',
        'Suscripción anterior cancelada'
    ),
    simple(
        'billing.successor-cut-cancel',
        'Aviso de corte de la suscripción sucesora',
        'Suscripción sucesora cortada'
    ),
    simple('billing.direct-cancellation', 'Aviso de baja directa', 'Baja directa'),
    defineOutboxEntry({
        template: 'billing.scheduled-cancellation',
        name: 'Aviso de cancelación del cobro automático',
        domain: 'billing',
        audience: 'user',
        scenarios: [
            {
                id: 'with-end-date',
                label: 'Con fecha de fin del servicio',
                input: {
                    payload: {
                        subscriptionId: SUBSCRIPTION_ID,
                        serviceEndsAt: '2026-12-15T15:00:00.000Z'
                    }
                }
            },
            {
                id: 'without-end-date',
                label: 'Sin fecha de fin del servicio',
                input: { payload: { subscriptionId: SUBSCRIPTION_ID } }
            }
        ]
    })
];
