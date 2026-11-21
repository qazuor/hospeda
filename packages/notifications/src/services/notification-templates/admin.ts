/**
 * Template selectors of the admin notification types.
 *
 * Covers: Ops mailbox, feedback, contact and AI notifications.
 *
 * Moved verbatim out of `NotificationService.selectTemplate` (HOS-2519 D6), so
 * the production send and the admin email preview map a payload to the same
 * component with the same props. A type with a template but no selector here
 * renders nothing and the email is silently never sent.
 *
 * @module services/notification-templates/admin
 */

import {
    AdminLeadReceived,
    AdminPaymentFailure,
    AdminSystemEvent,
    AiCostThresholdAlert,
    AiQuestionsWeeklyDigest,
    ContactSubmissionEmail,
    FeedbackReportEmail
} from '../../templates/index.js';
import type {
    AdminLeadReceivedPayload,
    AdminNotificationPayload,
    AiCostThresholdAlertPayload,
    AiQuestionsWeeklyDigestPayload,
    ContactSubmissionPayload,
    FeedbackReportPayload
} from '../../types/notification.types.js';
import type { NotificationTemplateSelectors } from './types.js';

/** Selectors of the admin notification types. */
export const ADMIN_NOTIFICATION_TEMPLATES: NotificationTemplateSelectors = {
    admin_payment_failure: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as AdminNotificationPayload;
        return AdminPaymentFailure({
            recipientName,
            affectedUserEmail: p.affectedUserEmail,
            affectedUserId: p.affectedUserId,
            severity: p.severity,
            eventDetails: p.eventDetails
        });
    },
    admin_system_event: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as AdminNotificationPayload;
        return AdminSystemEvent({
            recipientName,
            severity: p.severity,
            eventDetails: p.eventDetails
        });
    },
    admin_lead_received: ({ payload }) => {
        const p = payload as AdminLeadReceivedPayload;
        return AdminLeadReceived({
            funnelLabel: p.funnelLabel,
            programLabel: p.programLabel,
            contactName: p.contactName,
            contactEmail: p.contactEmail,
            contactPhone: p.contactPhone,
            businessName: p.businessName,
            message: p.message,
            adminUrl: p.adminUrl,
            submittedAtLabel: p.submittedAtLabel
        });
    },
    feedback_report: ({ payload }) => {
        const p = payload as FeedbackReportPayload;
        return FeedbackReportEmail({
            reportType: p.reportType,
            title: p.reportTitle,
            description: p.reportDescription,
            reporterName: p.recipientName,
            reporterEmail: p.recipientEmail,
            severity: p.severity,
            stepsToReproduce: p.stepsToReproduce,
            expectedResult: p.expectedResult,
            actualResult: p.actualResult,
            attachmentUrls: p.attachmentUrls,
            environment: p.feedbackEnvironment
        });
    },
    contact_submission: ({ payload }) => {
        const p = payload as ContactSubmissionPayload;
        return ContactSubmissionEmail({
            senderFirstName: p.senderFirstName,
            senderLastName: p.senderLastName,
            senderEmail: p.senderEmail,
            message: p.message,
            contactType: p.contactType,
            accommodationId: p.accommodationId,
            submittedAt: p.submittedAt
        });
    },
    ai_cost_threshold_alert: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as AiCostThresholdAlertPayload;
        return AiCostThresholdAlert({
            recipientName,
            scope: p.scope,
            feature: p.feature,
            thresholdPct: p.thresholdPct,
            spentMicroUsd: p.spentMicroUsd,
            ceilingMicroUsd: p.ceilingMicroUsd,
            period: p.period
        });
    },
    ai_questions_weekly_digest: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as AiQuestionsWeeklyDigestPayload;
        return AiQuestionsWeeklyDigest({
            recipientName,
            locale: p.locale,
            listings: p.listings,
            preferencesUrl: p.preferencesUrl
        });
    }
};
