/**
 * ConversationMailer factory for the Hospeda API.
 *
 * Implements `ConversationMailer` from `@repo/service-core`, bridging the
 * backend-pure service layer with the React email templates in
 * `@repo/notifications`. The actual `sendEmail` call (which depends on React
 * JSX compilation) lives here in `apps/api` to preserve the architectural
 * boundary: `@repo/service-core` contains no JSX, no React, no templates.
 *
 * Usage:
 * ```ts
 * const service = new ConversationService(
 *   { logger: apiLogger },
 *   {
 *     authSecret: env.HOSPEDA_BETTER_AUTH_SECRET,
 *     siteUrl:    env.HOSPEDA_SITE_URL,
 *     mailer:     createConversationMailer(),
 *   }
 * );
 * ```
 *
 * When `HOSPEDA_RESEND_API_KEY` is absent this factory returns `undefined`.
 * `ConversationService` handles a missing mailer by logging a warning and
 * skipping email dispatch, so no routes break in local-dev or test environments.
 *
 * @module lib/conversation-mailer
 */

import { createEmailClient, sendEmail } from '@repo/email';
import { ConversationVerify } from '@repo/notifications';
import type {
    AccessLinkEmailPayload,
    ConversationMailer,
    VerificationEmailPayload
} from '@repo/service-core';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger.js';

/**
 * Creates a `ConversationMailer` implementation backed by Resend.
 *
 * Returns `undefined` when `HOSPEDA_RESEND_API_KEY` is not configured so the
 * caller can safely forward it to `ConversationService` as-is — the service
 * already handles `undefined` with a graceful warning log.
 *
 * @returns A `ConversationMailer` instance, or `undefined` when Resend is not
 *   configured.
 *
 * @example
 * ```ts
 * import { createConversationMailer } from '../lib/conversation-mailer';
 *
 * const mailer = createConversationMailer();
 * // Pass to ConversationService via deps.mailer
 * ```
 */
export function createConversationMailer(): ConversationMailer | undefined {
    const apiKey = env.HOSPEDA_RESEND_API_KEY;
    if (!apiKey) {
        return undefined;
    }

    const client = createEmailClient({ apiKey });

    return {
        /**
         * Sends a verification email to an anonymous guest.
         *
         * On Resend failure the error is logged at `error` level but is NOT
         * re-thrown. `ConversationService` already tolerates a no-op mailer, so
         * callers do not need to wrap this in a try/catch.
         *
         * @param payload - Verification context provided by `ConversationService`
         */
        async sendVerificationEmail(payload: VerificationEmailPayload): Promise<void> {
            const result = await sendEmail({
                client,
                to: payload.recipientEmail,
                subject: 'Verificá tu email para continuar la conversación — Hospeda',
                react: ConversationVerify({
                    accommodationName: payload.accommodationName,
                    verificationUrl: payload.verificationUrl,
                    guestName: payload.guestName,
                    locale: payload.locale
                })
            });

            if (!result.success) {
                apiLogger.error(
                    {
                        conversationId: payload.conversationId,
                        recipientEmail: payload.recipientEmail,
                        error: result.error
                    },
                    'Failed to dispatch conversation verification email'
                );
            }
        },

        /**
         * Sends a magic-link access email to an anonymous guest who requests
         * re-access to an existing verified conversation (AC-004-04).
         *
         * Reuses ConversationVerify template with the `accessUrl` mapped to
         * `verificationUrl`. A dedicated template can be introduced as a future
         * improvement; the service interface already models it as distinct.
         */
        async sendAccessLinkEmail(payload: AccessLinkEmailPayload): Promise<void> {
            const result = await sendEmail({
                client,
                to: payload.recipientEmail,
                subject: 'Tu enlace de acceso a la conversación — Hospeda',
                react: ConversationVerify({
                    accommodationName: payload.accommodationName,
                    verificationUrl: payload.accessUrl,
                    guestName: payload.guestName,
                    locale: payload.locale
                })
            });

            if (!result.success) {
                apiLogger.error(
                    {
                        conversationId: payload.conversationId,
                        recipientEmail: payload.recipientEmail,
                        error: result.error
                    },
                    'Failed to dispatch conversation access-link email'
                );
            }
        }
    };
}
