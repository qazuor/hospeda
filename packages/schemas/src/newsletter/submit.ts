/**
 * Newsletter subscription submission schema.
 *
 * Used by the pre-launch landing (`apps/landing`) to validate the body of
 * POST /api/v1/public/newsletter before forwarding the email to Brevo.
 *
 * **Honeypot field**: The `website` field is hidden from human users via
 * CSS. Any non-empty value indicates an automated submission; the API
 * handler returns a fake-success response without forwarding to Brevo.
 */
import { z } from 'zod';

// ============================================================================
// SUBMIT SCHEMA
// ============================================================================

/**
 * Schema for a newsletter subscription submission.
 *
 * Minimal by design: just the email plus an optional honeypot. We do not
 * collect names, locale, or marketing-consent flags at the pre-launch
 * stage — the only goal is "let me know when you launch".
 *
 * @example
 * ```ts
 * NewsletterSubmitSchema.parse({ email: 'ana@example.com' });
 * // → { email: 'ana@example.com' }
 *
 * NewsletterSubmitSchema.parse({ email: 'bot@x.com', website: 'http://spam' });
 * // → parses OK; the API handler treats non-empty `website` as a bot drop.
 * ```
 */
export const NewsletterSubmitSchema = z.object({
    /**
     * Subscriber email address. Must be a syntactically valid email and
     * at most 254 characters (RFC 5321 hard limit on the full address).
     */
    email: z
        .string()
        .email({ message: 'zodError.newsletter.email.invalid' })
        .max(254, { message: 'zodError.newsletter.email.max' }),

    /**
     * Honeypot field — hidden from human users via CSS.
     * Any non-empty value indicates an automated submission; the API
     * handler should silently discard the request.
     */
    website: z.string().optional()
});

// ============================================================================
// TYPES
// ============================================================================

/**
 * Inferred TypeScript type for {@link NewsletterSubmitSchema}.
 */
export type NewsletterSubmitInput = z.infer<typeof NewsletterSubmitSchema>;
