/**
 * Contact form submission schema (SPEC-096 / REQ-096-07).
 *
 * Used by the `/contacto/` page to validate the body of
 * POST /api/v1/public/contact/submit before forwarding to the service layer.
 *
 * **Honeypot field**: The `website` field is a hidden field that legitimate
 * users will leave empty. If the API receives a non-empty `website` value, it
 * should silently return a fake-success response without persisting the record.
 * The honeypot check is the API handler's responsibility, not this schema's.
 */
import { z } from 'zod';

// ============================================================================
// CONTACT TYPE ENUM
// ============================================================================

/**
 * Discriminator for the contact form type.
 *
 * - `'general'` — general inquiry, no specific category.
 * - `'support'` — technical support (bugs, login issues, broken features).
 * - `'publish_accommodation'` — host onboarding lead (wants to list a place).
 * - `'subscriptions'` — billing, plans, payments, MercadoPago issues.
 * - `'suggestions'` — product feedback, ideas, improvements.
 * - `'report'` — report wrong/abusive content, fake reviews, etc.
 * - `'press'` — press, media, editorial collaborations.
 * - `'partnerships'` — B2B deals, agencies, local governments.
 * - `'event_submission'` — operators wanting to publish events.
 * - `'accommodation'` — DEPRECATED legacy value kept for schema compatibility
 *   (additive-only policy). Not exposed by the public form anymore.
 * - `'report_destination_info'` — content-error report from a destination page
 *   (SPEC-191, /colaborar/reportar).
 * - `'photo_submission'` — destination photo contribution
 *   (SPEC-191, /colaborar/fotos).
 * - `'editor_application'` — blog/events volunteer editor application
 *   (SPEC-191, /colaborar/editores).
 */
export const ContactTypeEnumSchema = z.enum([
    'general',
    'support',
    'publish_accommodation',
    'subscriptions',
    'suggestions',
    'report',
    'press',
    'partnerships',
    'event_submission',
    'accommodation',
    'report_destination_info',
    'photo_submission',
    'editor_application'
]);

/** Inferred TypeScript type for {@link ContactTypeEnumSchema}. */
export type ContactTypeEnum = z.infer<typeof ContactTypeEnumSchema>;

// ============================================================================
// SUBMIT SCHEMA
// ============================================================================

/**
 * Schema for a contact form submission.
 *
 * `accommodationId` is fully optional and not tied to any specific `type`.
 * Older versions enforced `type === 'accommodation' → accommodationId required`,
 * but the form no longer surfaces that flow. The field is kept in the schema
 * for backward compatibility (additive-only policy) so historical fixtures
 * continue to parse.
 *
 * @example
 * ```ts
 * // Valid — general inquiry
 * ContactSubmitSchema.parse({
 *   firstName: 'Ana',
 *   lastName: 'López',
 *   email: 'ana@example.com',
 *   message: 'Quería consultar sobre disponibilidad general.',
 *   type: 'general',
 * });
 *
 * // Valid — typed category (e.g., support, suggestions, press, etc.)
 * ContactSubmitSchema.parse({
 *   firstName: 'Carlos',
 *   lastName: 'Ramírez',
 *   email: 'carlos@example.com',
 *   message: 'No puedo iniciar sesión desde el lunes pasado.',
 *   type: 'support',
 * });
 * ```
 */
export const ContactSubmitSchema = z.object({
    /** Sender's first name. Between 1 and 100 characters. */
    firstName: z
        .string()
        .min(1, { message: 'zodError.contact.firstName.min' })
        .max(100, { message: 'zodError.contact.firstName.max' }),

    /** Sender's last name. Between 1 and 100 characters. */
    lastName: z
        .string()
        .min(1, { message: 'zodError.contact.lastName.min' })
        .max(100, { message: 'zodError.contact.lastName.max' }),

    /** Sender's email address. Must be a syntactically valid email. */
    email: z.string().email({ message: 'zodError.contact.email.invalid' }),

    /**
     * Message body. Between 10 and 2000 characters.
     * The lower bound ensures the message contains at least minimal content.
     */
    message: z
        .string()
        .min(10, { message: 'zodError.contact.message.min' })
        .max(2000, { message: 'zodError.contact.message.max' }),

    /** Contact type discriminator. See {@link ContactTypeEnumSchema}. */
    type: ContactTypeEnumSchema,

    /**
     * UUID of the referenced accommodation. Optional and decoupled from
     * `type`. Kept for backward compatibility with submissions that still
     * carry it; the current form does not surface this field.
     */
    accommodationId: z.string().uuid().optional(),

    /**
     * Honeypot field — hidden from human users via CSS.
     * Any non-empty value indicates an automated submission; the API
     * handler should silently discard the request.
     * This field is not validated further; it is simply forwarded so the
     * handler can inspect it without schema modification.
     */
    website: z.string().optional()
});

// ============================================================================
// TYPES
// ============================================================================

/**
 * Inferred TypeScript type for {@link ContactSubmitSchema}.
 *
 * @example
 * ```ts
 * import type { ContactSubmitInput } from '@repo/schemas';
 *
 * async function handleContactSubmit(input: ContactSubmitInput): Promise<void> { ... }
 * ```
 */
export type ContactSubmitInput = z.infer<typeof ContactSubmitSchema>;
