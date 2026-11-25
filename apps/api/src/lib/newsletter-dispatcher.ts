/**
 * Notification dispatcher of the newsletter double opt-in emails (HOS-2603).
 *
 * Implements `NewsletterNotificationDispatcher` from `@repo/service-core`, bridging the
 * template-free service layer with the React email templates in `@repo/notifications`,
 * the same split `conversation-mailer` uses. Without it `NewsletterSubscriberService`
 * falls back to a no-op dispatcher and the verification email is never sent.
 *
 * Delivery failures are logged and never thrown: the subscriber row is already written
 * and the service swallows dispatcher errors anyway.
 *
 * @module lib/newsletter-dispatcher
 */

import { createEmailClient } from '@repo/email';
import {
    getSubject,
    NewsletterVerifyEmail,
    NewsletterWelcomeEmail,
    NotificationType
} from '@repo/notifications';
import type { NewsletterNotificationDispatcher } from '@repo/service-core';
import {
    buildAppEmailLayout,
    buildTransactionalAttribution,
    NEWSLETTER_EMAIL_KEYS
} from '../utils/email-attribution';
import { sendAppEmail } from '../utils/email-sender';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';

/**
 * Builds the dispatcher the newsletter subscriber service sends its emails through.
 *
 * When `HOSPEDA_EMAIL_API_KEY` is unset (local dev, tests) every send is skipped with a
 * warning instead of failing the subscribe request.
 *
 * @returns A dispatcher for the verification and welcome emails.
 */
export function createNewsletterNotificationDispatcher(): NewsletterNotificationDispatcher {
    const apiKey = env.HOSPEDA_EMAIL_API_KEY;
    const client = apiKey ? createEmailClient({ apiKey }) : undefined;

    return {
        async sendVerification({ subscriberId, email, locale, token }) {
            if (!client) {
                apiLogger.warn(
                    { subscriberId },
                    'HOSPEDA_EMAIL_API_KEY not set - newsletter verification email skipped'
                );
                return;
            }
            const verifyUrl = `${env.HOSPEDA_API_URL.replace(/\/$/, '')}/api/v1/public/newsletter/verify?token=${encodeURIComponent(token)}&locale=${encodeURIComponent(locale)}`;
            const result = await sendAppEmail({
                client,
                to: email,
                subject: getSubject(NotificationType.NEWSLETTER_VERIFICATION, {}),
                react: NewsletterVerifyEmail({ verifyUrl }),
                attribution: buildTransactionalAttribution({
                    templateKey: NEWSLETTER_EMAIL_KEYS.verify
                }),
                layout: buildAppEmailLayout({ templateKey: NEWSLETTER_EMAIL_KEYS.verify })
            });
            if (!result.success) {
                apiLogger.error(
                    { subscriberId, error: result.error },
                    'Failed to dispatch newsletter verification email'
                );
            }
        },

        async sendWelcome({ subscriberId, email }) {
            if (!client) {
                apiLogger.warn(
                    { subscriberId },
                    'HOSPEDA_EMAIL_API_KEY not set - newsletter welcome email skipped'
                );
                return;
            }
            const result = await sendAppEmail({
                client,
                to: email,
                subject: getSubject(NotificationType.NEWSLETTER_WELCOME, {}),
                react: NewsletterWelcomeEmail({
                    baseUrl: (env.HOSPEDA_SITE_URL ?? 'https://hospeda.com.ar').replace(/\/$/, '')
                }),
                attribution: buildTransactionalAttribution({
                    templateKey: NEWSLETTER_EMAIL_KEYS.welcome
                }),
                layout: buildAppEmailLayout({ templateKey: NEWSLETTER_EMAIL_KEYS.welcome })
            });
            if (!result.success) {
                apiLogger.error(
                    { subscriberId, error: result.error },
                    'Failed to dispatch newsletter welcome email'
                );
            }
        }
    };
}
