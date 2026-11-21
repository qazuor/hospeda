import type { ReactElement } from 'react';
import type { NotificationPayload, NotificationType } from '../../types/notification.types.js';

/**
 * Input of one {@link NotificationTemplateSelector}.
 */
export interface NotificationTemplateSelectorInput {
    /** Payload of the notification being rendered. */
    readonly payload: NotificationPayload;
    /** Site base URL used in email CTA links (e.g. https://hospeda.com.ar). */
    readonly siteUrl: string;
}

/**
 * Maps one notification payload to its React Email element.
 */
export type NotificationTemplateSelector = (
    input: NotificationTemplateSelectorInput
) => ReactElement;

/**
 * Template selectors keyed by notification type. Partial on purpose: each
 * domain module owns a slice, and `notification-render.ts` merges them.
 */
export type NotificationTemplateSelectors = Readonly<
    Partial<Record<NotificationType, NotificationTemplateSelector>>
>;
