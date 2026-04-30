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
 * - `'general'` — general inquiry, no accommodation reference required.
 * - `'accommodation'` — inquiry about a specific accommodation;
 *   `accommodationId` is required when this value is selected.
 */
export const ContactTypeEnumSchema = z.enum(['general', 'accommodation']);

/** Inferred TypeScript type for {@link ContactTypeEnumSchema}. */
export type ContactTypeEnum = z.infer<typeof ContactTypeEnumSchema>;

// ============================================================================
// SUBMIT SCHEMA
// ============================================================================

/**
 * Schema for a contact form submission.
 *
 * The `accommodationId` field is conditionally required:
 * it must be present (and a valid UUID) when `type === 'accommodation'`,
 * and must be absent (or undefined) when `type === 'general'`.
 * This invariant is enforced via `.superRefine()`.
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
 * // Valid — accommodation-specific inquiry
 * ContactSubmitSchema.parse({
 *   firstName: 'Carlos',
 *   lastName: 'Ramírez',
 *   email: 'carlos@example.com',
 *   message: 'Me interesa reservar esta cabaña para el fin de semana largo.',
 *   type: 'accommodation',
 *   accommodationId: '550e8400-e29b-41d4-a716-446655440000',
 * });
 *
 * // Invalid — type='accommodation' but accommodationId missing
 * ContactSubmitSchema.parse({
 *   firstName: 'X', lastName: 'Y', email: 'x@y.com',
 *   message: 'Mensaje de prueba con suficiente longitud',
 *   type: 'accommodation',
 * });
 * // → ZodError: accommodationId is required when type is 'accommodation'
 * ```
 */
export const ContactSubmitSchema = z
    .object({
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
         * UUID of the referenced accommodation.
         * Required when `type === 'accommodation'`, forbidden otherwise.
         * Validated by the `.superRefine()` below.
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
    })
    .superRefine((data, ctx) => {
        if (data.type === 'accommodation' && !data.accommodationId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['accommodationId'],
                message: 'zodError.contact.accommodationId.required'
            });
        }
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
