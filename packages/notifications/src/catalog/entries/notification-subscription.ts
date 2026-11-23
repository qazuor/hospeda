/**
 * Catalog entries of the subscription lifecycle notifications
 * (`services/notification-templates/subscription.ts`).
 *
 * @module catalog/entries/notification-subscription
 */

import {
    NotificationType,
    type SubscriptionAccessEndingSoonPayload,
    type SubscriptionCancelConfirmedPayload,
    type SubscriptionLifecyclePayload
} from '../../types/notification.types.js';
import { defineNotificationEntry } from '../define-entry.js';
import { SAMPLE_RECIPIENT } from '../sample-data.js';
import type { EmailCatalogEntry } from '../types.js';

/** The subscription lifecycle notifications. */
export const NOTIFICATION_SUBSCRIPTION_ENTRIES: readonly EmailCatalogEntry[] = [
    defineNotificationEntry<SubscriptionLifecyclePayload>({
        type: NotificationType.SUBSCRIPTION_CANCELLED,
        name: 'Suscripción cancelada',
        domain: 'subscription',
        audience: 'user',
        scenarios: [
            {
                id: 'with-period-end',
                label: 'Con fin del período',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.SUBSCRIPTION_CANCELLED,
                    planName: 'Plan Profesional',
                    currentPeriodEnd: '2026-02-15'
                }
            },
            {
                id: 'without-period-end',
                label: 'Sin fin del período',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.SUBSCRIPTION_CANCELLED,
                    planName: 'Plan Profesional'
                }
            }
        ]
    }),
    defineNotificationEntry<SubscriptionLifecyclePayload>({
        type: NotificationType.SUBSCRIPTION_PAUSED,
        name: 'Suscripción pausada',
        domain: 'subscription',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Pausada',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.SUBSCRIPTION_PAUSED,
                    planName: 'Plan Profesional'
                }
            }
        ]
    }),
    defineNotificationEntry<SubscriptionLifecyclePayload>({
        type: NotificationType.SUBSCRIPTION_REACTIVATED,
        name: 'Suscripción reactivada',
        domain: 'subscription',
        audience: 'user',
        scenarios: [
            {
                id: 'with-next-billing',
                label: 'Con próxima facturación',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.SUBSCRIPTION_REACTIVATED,
                    planName: 'Plan Profesional',
                    nextBillingDate: '2026-02-15'
                }
            },
            {
                id: 'without-next-billing',
                label: 'Sin próxima facturación',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.SUBSCRIPTION_REACTIVATED,
                    planName: 'Plan Profesional'
                }
            }
        ]
    }),
    defineNotificationEntry<SubscriptionCancelConfirmedPayload>({
        type: NotificationType.SUBSCRIPTION_CANCEL_CONFIRMED,
        name: 'Cancelación confirmada',
        domain: 'subscription',
        audience: 'user',
        scenarios: [
            {
                id: 'default',
                label: 'Acceso hasta fin del período',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.SUBSCRIPTION_CANCEL_CONFIRMED,
                    planName: 'Plan Profesional',
                    accessUntil: '2026-02-15'
                }
            }
        ]
    }),
    defineNotificationEntry<SubscriptionAccessEndingSoonPayload>({
        type: NotificationType.SUBSCRIPTION_ACCESS_ENDING_SOON,
        name: 'El acceso termina pronto',
        domain: 'subscription',
        audience: 'user',
        scenarios: [
            {
                id: 'three-days',
                label: 'Faltan 3 días',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.SUBSCRIPTION_ACCESS_ENDING_SOON,
                    planName: 'Plan Profesional',
                    accessUntil: '2026-02-15',
                    daysRemaining: 3
                }
            }
        ]
    })
];
