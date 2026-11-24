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
export { applyEmailAttribution } from './attribution.js';
export type { CreateEmailClientInput, EmailClient } from './client.js';
// Client
export { createEmailClient } from './client.js';
export type { ButtonProps, ButtonVariant } from './components/button.js';
// Shared components (HOS-2565)
export {
    Button,
    EMAIL_BUTTON_CLASS,
    EMAIL_BUTTON_MEDIA_RULE,
    EMAIL_BUTTON_SECONDARY_CLASS
} from './components/button.js';
export type { CalloutProps, CalloutTone } from './components/callout.js';
export { Callout } from './components/callout.js';
export type { EmailTitleProps, EmailTitleSlot } from './components/email-title.js';
export { EmailTitle } from './components/email-title.js';
export type { OptionCardProps, OptionCardTone } from './components/option-card.js';
export { OptionCard } from './components/option-card.js';
export type { SectionBarProps, SectionBarTone } from './components/section-bar.js';
export { SectionBar } from './components/section-bar.js';
export type { ConfigureEmailAssetsInput, EmailAssetPath } from './email-assets.js';
export {
    configureEmailAssets,
    EMAIL_PUBLIC_FAQ_URL,
    resetEmailAssets,
    resolveEmailAssetUrl,
    resolveEmailIsotipoUrl,
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
export type {
    EmailFooterLink,
    EmailLayoutProps,
    EmailLayoutVariant
} from './templates/email-layout.js';
// Email templates
export {
    EMAIL_ISOTIPO_HEIGHT,
    EMAIL_ISOTIPO_URL,
    EMAIL_ISOTIPO_WIDTH,
    EMAIL_PREFERENCES_URL,
    EMAIL_PUBLIC_SITE_URL,
    EmailLayout
} from './templates/email-layout.js';
export type { EmailLayoutContextValue } from './templates/email-layout-context.js';
// User layout (HOS-2565 PR-4)
export { EmailLayoutContext } from './templates/email-layout-context.js';
export type { ResetPasswordTemplateProps } from './templates/reset-password.js';
export { ResetPasswordTemplate } from './templates/reset-password.js';
export { EMAIL_ACCOUNT_LINK_TARGETS } from './templates/user-layout/account-link.js';
export type { EmailHelpLink } from './templates/user-layout/help-links.js';
export {
    buildEmailHelpArticleUrl,
    EMAIL_DEFAULT_HELP_ARTICLE_IDS,
    EMAIL_MAX_HELP_LINKS,
    resolveEmailHelpLinks
} from './templates/user-layout/help-links.js';
export type { EmailIllustration } from './templates/user-layout/user-assets.js';
export {
    EMAIL_ILLUSTRATION_PATHS,
    EMAIL_ILLUSTRATIONS,
    EMAIL_USER_ASSET_PATHS
} from './templates/user-layout/user-assets.js';
export {
    EMAIL_SOCIAL_PLATFORMS,
    EMAIL_USER_PREFERENCES_LABEL
} from './templates/user-layout/user-footer.js';
export {
    EMAIL_TINTED_BOX_CLASS,
    EMAIL_USER_DARK_STYLE_BLOCK,
    EMAIL_USER_STYLE_BLOCK
} from './templates/user-layout/user-styles.js';
export type { VerifyEmailTemplateProps } from './templates/verify-email.js';
export { VerifyEmailTemplate } from './templates/verify-email.js';
