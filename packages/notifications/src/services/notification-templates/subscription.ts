/**
 * Template selectors of the subscription notification types.
 *
 * Covers: Subscription lifecycle (cancel, pause, reactivate, access ending).
 *
 * Moved verbatim out of `NotificationService.selectTemplate` (HOS-2519 D6), so
 * the production send and the admin email preview map a payload to the same
 * component with the same props. A type with a template but no selector here
 * renders nothing and the email is silently never sent.
 *
 * @module services/notification-templates/subscription
 */

import {
    SubscriptionAccessEndingSoon,
    SubscriptionCancelConfirmed,
    SubscriptionCancelled,
    SubscriptionPaused,
    SubscriptionReactivated
} from '../../templates/index.js';
import type {
    SubscriptionAccessEndingSoonPayload,
    SubscriptionCancelConfirmedPayload,
    SubscriptionLifecyclePayload
} from '../../types/notification.types.js';
import type { NotificationTemplateSelectors } from './types.js';

/** Selectors of the subscription notification types. */
export const SUBSCRIPTION_NOTIFICATION_TEMPLATES: NotificationTemplateSelectors = {
    subscription_cancelled: ({ payload, siteUrl }) => {
        const lifecyclePayload = payload as SubscriptionLifecyclePayload;
        return SubscriptionCancelled({
            recipientName: payload.recipientName,
            planName: lifecyclePayload.planName,
            currentPeriodEnd: lifecyclePayload.currentPeriodEnd,
            baseUrl: siteUrl
        });
    },
    subscription_paused: ({ payload, siteUrl }) => {
        const lifecyclePayload = payload as SubscriptionLifecyclePayload;
        return SubscriptionPaused({
            recipientName: payload.recipientName,
            planName: lifecyclePayload.planName,
            baseUrl: siteUrl
        });
    },
    subscription_reactivated: ({ payload, siteUrl }) => {
        const lifecyclePayload = payload as SubscriptionLifecyclePayload;
        return SubscriptionReactivated({
            recipientName: payload.recipientName,
            planName: lifecyclePayload.planName,
            nextBillingDate: lifecyclePayload.nextBillingDate,
            baseUrl: siteUrl
        });
    },
    subscription_cancel_confirmed: ({ payload, siteUrl }) => {
        const { recipientName } = payload;
        const p = payload as SubscriptionCancelConfirmedPayload;
        return SubscriptionCancelConfirmed({
            recipientName,
            planName: p.planName,
            accessUntil: p.accessUntil,
            baseUrl: siteUrl
        });
    },
    subscription_access_ending_soon: ({ payload, siteUrl }) => {
        const { recipientName } = payload;
        const p = payload as SubscriptionAccessEndingSoonPayload;
        return SubscriptionAccessEndingSoon({
            recipientName,
            planName: p.planName,
            accessUntil: p.accessUntil,
            daysRemaining: p.daysRemaining,
            baseUrl: siteUrl
        });
    }
};
