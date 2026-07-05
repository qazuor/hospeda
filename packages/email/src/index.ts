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
export type { SendEmailInput, SendEmailResult } from './send.js';
// Send functionality
export { sendEmail } from './send.js';
export type { BaseLayoutProps } from './templates/base-layout.js';
// Email templates
export { BaseLayout } from './templates/base-layout.js';
export type { ResetPasswordTemplateProps } from './templates/reset-password.js';
export { ResetPasswordTemplate } from './templates/reset-password.js';
export type { VerifyEmailTemplateProps } from './templates/verify-email.js';
export { VerifyEmailTemplate } from './templates/verify-email.js';
