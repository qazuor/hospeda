/**
 * Email transport implementations
 *
 * Provides interfaces and implementations for sending emails
 * through various providers (Resend) and testing utilities.
 */

export {
    buildEmailTemplateTag,
    EMAIL_TEMPLATE_TAG_PREFIX,
    parseEmailTemplateTag
} from '@repo/email';
export * from './brevo-batch.js';
export * from './email-transport.interface.js';
export * from './mock-transport.js';
export * from './resend-transport.js';
