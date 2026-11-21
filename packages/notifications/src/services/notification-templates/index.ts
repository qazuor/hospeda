/**
 * Template selectors of every notification type that has an email template.
 *
 * @module services/notification-templates
 */

import { ADMIN_NOTIFICATION_TEMPLATES } from './admin.js';
import { BILLING_NOTIFICATION_TEMPLATES } from './billing.js';
import { COMMUNITY_NOTIFICATION_TEMPLATES } from './community.js';
import { SUBSCRIPTION_NOTIFICATION_TEMPLATES } from './subscription.js';
import { TRIAL_NOTIFICATION_TEMPLATES } from './trial.js';
import type { NotificationTemplateSelectors } from './types.js';

export type {
    NotificationTemplateSelector,
    NotificationTemplateSelectorInput,
    NotificationTemplateSelectors
} from './types.js';

/** Every notification template selector, keyed by notification type. */
export const NOTIFICATION_TEMPLATE_SELECTORS: NotificationTemplateSelectors = {
    ...BILLING_NOTIFICATION_TEMPLATES,
    ...SUBSCRIPTION_NOTIFICATION_TEMPLATES,
    ...TRIAL_NOTIFICATION_TEMPLATES,
    ...ADMIN_NOTIFICATION_TEMPLATES,
    ...COMMUNITY_NOTIFICATION_TEMPLATES
};
