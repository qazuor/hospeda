/**
 * Email service module for centralized email functionality.
 *
 * Provider-agnostic at the API surface: callers receive an opaque
 * {@link EmailClient} from {@link createEmailClient} and pass it to
 * {@link sendEmail}. The current implementation uses Brevo as the underlying
 * transactional email provider.
 *
 * @module email
 */

export type { CreateEmailClientInput, EmailClient } from './client.js';
// Client
export { createEmailClient } from './client.js';
export type { RenderEmailBodiesInput, RenderedEmailBodies } from './render.js';
// Rendering
export { renderEmailBodies } from './render.js';
export type { SendEmailInput, SendEmailResult } from './send.js';
// Send functionality
export { sendEmail } from './send.js';
// Subjects
export { RESET_PASSWORD_EMAIL_SUBJECT, VERIFY_EMAIL_SUBJECT } from './subjects.js';
export type { EmailFooterLink, EmailLayoutProps } from './templates/email-layout.js';
// Email templates
export {
    EMAIL_LOGO_HEIGHT,
    EMAIL_LOGO_URL,
    EMAIL_LOGO_WIDTH,
    EMAIL_PREFERENCES_URL,
    EMAIL_PUBLIC_SITE_URL,
    EmailLayout
} from './templates/email-layout.js';
export type { ResetPasswordTemplateProps } from './templates/reset-password.js';
export { ResetPasswordTemplate } from './templates/reset-password.js';
export type { VerifyEmailTemplateProps } from './templates/verify-email.js';
export { VerifyEmailTemplate } from './templates/verify-email.js';
