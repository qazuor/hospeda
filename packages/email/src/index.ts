/**
 * Email service module for centralized email functionality.
 * Provides email sending via Resend with React Email templates.
 *
 * @module email
 */

// Client
export { createEmailClient } from './client.js';
export type { CreateEmailClientInput } from './client.js';

// Send functionality
export { sendEmail } from './send.js';
export type { SendEmailInput, SendEmailResult } from './send.js';

// Email templates
export { BaseLayout } from './templates/base-layout.js';
export type { BaseLayoutProps } from './templates/base-layout.js';

export { VerifyEmailTemplate } from './templates/verify-email.js';
export type { VerifyEmailTemplateProps } from './templates/verify-email.js';

export { ResetPasswordTemplate } from './templates/reset-password.js';
export type { ResetPasswordTemplateProps } from './templates/reset-password.js';
