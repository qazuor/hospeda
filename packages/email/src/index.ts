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

// Palette re-export so @repo/notifications templates need no direct @repo/design-tokens dependency (HOS-2565)
export { emailPalette } from '@repo/design-tokens';
export type {
    ApplyEmailAttributionInput,
    ApplyEmailAttributionResult,
    EmailAttribution
} from './attribution.js';
// Attribution (HOS-2359)
export { applyEmailAttribution, buildEmailPixelUrl, UMAMI_PIXEL_PATH } from './attribution.js';
export type { CreateEmailClientInput, EmailClient } from './client.js';
// Client
export { createEmailClient } from './client.js';
export type { ButtonProps, ButtonVariant } from './components/button.js';
// Shared components (HOS-2565)
export { Button, EMAIL_BUTTON_CLASS, EMAIL_BUTTON_MEDIA_RULE } from './components/button.js';
export type { CalloutProps, CalloutTone } from './components/callout.js';
export { Callout } from './components/callout.js';
export type { ConfigureEmailAssetsInput } from './email-assets.js';
export {
    configureEmailAssets,
    resetEmailAssets,
    resolveEmailIsotipoUrl,
    resolveEmailPixelBaseUrl,
    resolveEmailSiteOrigin
} from './email-assets.js';
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
    EMAIL_ISOTIPO_HEIGHT,
    EMAIL_ISOTIPO_URL,
    EMAIL_ISOTIPO_WIDTH,
    EMAIL_PREFERENCES_URL,
    EMAIL_PUBLIC_SITE_URL,
    EmailLayout
} from './templates/email-layout.js';
export type { ResetPasswordTemplateProps } from './templates/reset-password.js';
export { ResetPasswordTemplate } from './templates/reset-password.js';
export type { VerifyEmailTemplateProps } from './templates/verify-email.js';
export { VerifyEmailTemplate } from './templates/verify-email.js';
