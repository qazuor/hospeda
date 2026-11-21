/**
 * Template selectors of the billing notification types.
 *
 * Covers: Purchases, payments, renewals, plan changes, courtesy and comp grants.
 *
 * Moved verbatim out of `NotificationService.selectTemplate` (HOS-2519 D6), so
 * the production send and the admin email preview map a payload to the same
 * component with the same props. A type with a template but no selector here
 * renders nothing and the email is silently never sent.
 *
 * @module services/notification-templates/billing
 */

import {
    CompGranted,
    CourtesyEnded,
    CourtesyGranted,
    CourtesyStarted,
    PaymentFailure,
    PaymentRetryWarning,
    PaymentSuccess,
    PlanBeingRetired,
    PlanChangeConfirmation,
    PlanDowngradeLimitWarning,
    PlanPriceChangeNotice,
    PurchaseConfirmation,
    RenewalReminder
} from '../../templates/index.js';
import { asMajor } from '../../types/money.js';
import type {
    CompGrantedPayload,
    CourtesyPayload,
    PaymentNotificationPayload,
    PaymentRetryWarningPayload,
    PlanBeingRetiredPayload,
    PlanDowngradeLimitWarningPayload,
    PlanPriceChangeNoticePayload,
    PurchaseConfirmationPayload,
    SubscriptionEventPayload
} from '../../types/notification.types.js';
import type { NotificationTemplateSelectors } from './types.js';

/** Selectors of the billing notification types. */
export const BILLING_NOTIFICATION_TEMPLATES: NotificationTemplateSelectors = {
    subscription_purchase: ({ payload, siteUrl }) => {
        const { recipientName } = payload;
        const p = payload as PurchaseConfirmationPayload;
        return PurchaseConfirmation({
            recipientName,
            planName: p.planName,
            amount: p.amount,
            currency: p.currency,
            baseUrl: siteUrl,
            billingPeriod: p.billingPeriod,
            nextBillingDate: p.nextBillingDate
        });
    },
    payment_success: ({ payload, siteUrl }) => {
        const { recipientName } = payload;
        const p = payload as PaymentNotificationPayload;
        return PaymentSuccess({
            recipientName,
            // `PaymentNotificationPayload.amount` is untyped `number`
            // (it is shared by the whole notification union), but its
            // only producer (`sendPaymentSuccessNotification`) already
            // asserts it MAJOR (pesos) at the source. Re-asserting the
            // brand here is what lets `PaymentSuccess` require `Major`
            // instead of silently accepting centavos (HOS-839).
            amount: asMajor(p.amount),
            currency: p.currency,
            planName: p.planName,
            baseUrl: siteUrl,
            paymentMethod: p.paymentMethod
        });
    },
    payment_failure: ({ payload, siteUrl }) => {
        const { recipientName } = payload;
        const p = payload as PaymentNotificationPayload;
        return PaymentFailure({
            recipientName,
            // See the HOS-839 note in the 'payment_success' case above.
            amount: asMajor(p.amount),
            currency: p.currency,
            baseUrl: siteUrl,
            failureReason: p.failureReason,
            retryUrl: p.retryUrl
        });
    },
    renewal_reminder: ({ payload, siteUrl }) => {
        const { recipientName } = payload;
        const p = payload as SubscriptionEventPayload;
        return RenewalReminder({
            recipientName,
            planName: p.planName,
            baseUrl: siteUrl,
            amount: p.amount,
            currency: p.currency,
            renewalDate: p.renewalDate || '',
            productDomain: p.productDomain
        });
    },
    plan_change_confirmation: ({ payload, siteUrl }) => {
        const { recipientName } = payload;
        const p = payload as SubscriptionEventPayload;
        return PlanChangeConfirmation({
            recipientName,
            baseUrl: siteUrl,
            oldPlanName: p.oldPlanName || '',
            newPlanName: p.newPlanName || '',
            amount: p.amount,
            currency: p.currency
        });
    },
    // HOS-180. Registering a template and a type is NOT enough — this
    // switch is what routes a type to a template, and a case missing
    // here means the email is silently never sent.
    courtesy_granted: ({ payload, siteUrl }) => {
        const p = payload as CourtesyPayload;
        return CourtesyGranted({
            recipientName: payload.recipientName,
            planName: p.planName,
            cycles: p.cycles ?? 1,
            startsAt: p.startsAt ?? '',
            endsAt: p.endsAt ?? '',
            baseUrl: siteUrl
        });
    },
    courtesy_started: ({ payload, siteUrl }) => {
        const p = payload as CourtesyPayload;
        return CourtesyStarted({
            recipientName: payload.recipientName,
            planName: p.planName,
            endsAt: p.endsAt ?? '',
            baseUrl: siteUrl
        });
    },
    // HOS-1171. Same warning as the courtesy block above: a type with a
    // template but no case here renders nothing and the email is
    // silently never sent.
    comp_granted: ({ payload, siteUrl }) => {
        const p = payload as CompGrantedPayload;
        return CompGranted({
            recipientName: payload.recipientName,
            planName: p.planName,
            hadActiveBilling: p.hadActiveBilling,
            baseUrl: siteUrl
        });
    },
    courtesy_ended: ({ payload, siteUrl }) => {
        const p = payload as CourtesyPayload;
        return CourtesyEnded({
            recipientName: payload.recipientName,
            planName: p.planName,
            nextBillingDate: p.nextBillingDate ?? '',
            baseUrl: siteUrl
        });
    },
    plan_downgrade_limit_warning: ({ payload, siteUrl }) => {
        const p = payload as PlanDowngradeLimitWarningPayload;
        return PlanDowngradeLimitWarning({
            customerName: p.recipientName,
            planName: p.planName,
            limitKey: p.limitKey,
            oldLimit: p.oldLimit,
            newLimit: p.newLimit,
            currentUsage: p.currentUsage,
            baseUrl: siteUrl
        });
    },
    payment_retry_warning: ({ payload, siteUrl }) => {
        const { recipientName } = payload;
        const p = payload as PaymentRetryWarningPayload;
        return PaymentRetryWarning({
            recipientName,
            failureCount: p.failureCount,
            maxRetries: p.maxRetries,
            paymentMethodHint: p.paymentMethodHint,
            baseUrl: siteUrl
        });
    },
    plan_being_retired: ({ payload, siteUrl }) => {
        const { recipientName } = payload;
        const p = payload as PlanBeingRetiredPayload;
        return PlanBeingRetired({
            recipientName,
            planName: p.planName,
            accessUntil: p.accessUntil,
            migrationHint: p.migrationHint,
            baseUrl: siteUrl
        });
    },
    plan_price_change_notice: ({ payload, siteUrl }) => {
        const { recipientName } = payload;
        const p = payload as PlanPriceChangeNoticePayload;
        return PlanPriceChangeNotice({
            recipientName,
            baseUrl: siteUrl,
            planName: p.planName,
            oldPriceArs: p.oldPriceArs,
            newPriceArs: p.newPriceArs,
            effectiveDate: p.effectiveDate,
            billingInterval: p.billingInterval
        });
    }
};
