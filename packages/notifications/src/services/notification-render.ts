/**
 * Pure rendering of a notification email: template and subject.
 *
 * Extracted from `NotificationService` (HOS-2519 D6) so the production send
 * and the admin email preview build the same element and the same subject
 * from the same payload. Nothing here sends, logs or touches the database.
 *
 * @module services/notification-render
 */

import type { ReactElement } from 'react';
import type { NotificationPayload, NotificationType } from '../types/notification.types.js';
import {
    findUnresolvedPlaceholders,
    getSubject,
    SAFE_FALLBACK_SUBJECT
} from '../utils/subject-builder.js';
import { buildSubjectData } from '../utils/subject-data.js';
import { NOTIFICATION_TEMPLATE_SELECTORS } from './notification-templates/index.js';

/** Input of {@link renderNotificationEmail}. */
export interface RenderNotificationEmailInput {
    /** Payload of the notification. */
    readonly payload: NotificationPayload;
    /** Site base URL used in email CTA links (e.g. https://hospeda.com.ar). */
    readonly siteUrl: string;
}

/** Output of {@link renderNotificationEmail}. */
export interface RenderedNotificationEmail {
    /**
     * Subject handed to the transport. When a placeholder could not be
     * resolved it is already {@link SAFE_FALLBACK_SUBJECT}.
     */
    readonly subject: string;
    /** React Email element of the body. */
    readonly react: ReactElement;
    /**
     * Placeholders the subject pattern declared but the payload did not
     * resolve. Non-empty means the subject fell back to the generic one, which
     * the caller must report (H-64 / H-75).
     */
    readonly unresolvedPlaceholders: readonly string[];
}

/** Output of {@link resolveNotificationSubject}. */
export interface ResolvedNotificationSubject {
    /** The subject, or {@link SAFE_FALLBACK_SUBJECT} when a placeholder is unresolved. */
    readonly subject: string;
    /** Placeholders left unresolved; empty on success. */
    readonly unresolvedPlaceholders: readonly string[];
}

/**
 * Notification types that have an email template. The other values of
 * `NotificationType` are sent through another path (outbox, newsletter).
 */
export const NOTIFICATION_TYPES_WITH_TEMPLATE: readonly NotificationType[] = Object.freeze(
    Object.keys(NOTIFICATION_TEMPLATE_SELECTORS) as NotificationType[]
);

/**
 * Selects the React Email element of a notification payload.
 *
 * @param input - The payload and the site base URL.
 * @returns The element.
 * @throws {Error} When the notification type has no template.
 */
export function selectNotificationTemplate(input: RenderNotificationEmailInput): ReactElement {
    const { payload, siteUrl } = input;
    const selector = Object.hasOwn(NOTIFICATION_TEMPLATE_SELECTORS, payload.type)
        ? NOTIFICATION_TEMPLATE_SELECTORS[payload.type]
        : undefined;
    if (!selector) {
        throw new Error(`No template found for notification type: ${payload.type}`);
    }
    return selector({ payload, siteUrl });
}

/**
 * Builds the subject line of a notification payload.
 *
 * Variable resolution lives in `buildSubjectData`, which reads the
 * placeholders the pattern declares and pulls them off the payload. This adds
 * the last line of defence: a subject that still carries template syntax is
 * NEVER returned. Eleven live subjects shipped their own `{placeholder}` to
 * real inboxes (H-64 / H-75); when that happens now the subject degrades to the
 * generic one and the unresolved names are returned for the caller to log.
 *
 * @param input - The payload.
 * @returns The subject and any unresolved placeholders.
 */
export function resolveNotificationSubject(input: {
    readonly payload: NotificationPayload;
}): ResolvedNotificationSubject {
    const { payload } = input;
    const { subjectData } = buildSubjectData({ payload });
    const subject = getSubject(payload.type, subjectData);
    const { unresolved } = findUnresolvedPlaceholders({ subject });

    if (unresolved.length > 0) {
        return { subject: SAFE_FALLBACK_SUBJECT, unresolvedPlaceholders: unresolved };
    }
    return { subject, unresolvedPlaceholders: [] };
}

/**
 * Renders a notification email: the body element and the subject, exactly as
 * `NotificationService.send` hands them to the transport.
 *
 * The template is selected first, so an unknown type throws before any
 * subject work, as it always did.
 *
 * @param input - The payload and the site base URL.
 * @returns The subject, the element and any unresolved subject placeholders.
 * @throws {Error} When the notification type has no template.
 *
 * @example
 * ```ts
 * const { subject, react, unresolvedPlaceholders } = renderNotificationEmail({
 *     payload,
 *     siteUrl: 'https://hospeda.com.ar'
 * });
 * ```
 */
export function renderNotificationEmail(
    input: RenderNotificationEmailInput
): RenderedNotificationEmail {
    const react = selectNotificationTemplate(input);
    const { subject, unresolvedPlaceholders } = resolveNotificationSubject({
        payload: input.payload
    });
    return { subject, react, unresolvedPlaceholders };
}
