import { z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute } from '../../utils/route-factory';

/**
 * Contact form request schema
 */
const ContactRequestSchema = z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email().max(255),
    message: z.string().min(10).max(2000),
    accommodationId: z.string().optional(),
    type: z.enum(['general', 'accommodation']).default('general')
});

/**
 * Contact form response schema
 */
const ContactResponseSchema = z.object({
    success: z.boolean(),
    message: z.string()
});

/**
 * POST /api/v1/public/contact
 * Public endpoint for submitting contact form messages.
 * Logs the contact to structured logging for later processing.
 */
export const submitContactRoute = createSimpleRoute({
    method: 'post',
    path: '/contact',
    summary: 'Submit contact form',
    description: 'Receives and logs a contact form submission',
    tags: ['Contact'],
    responseSchema: ContactResponseSchema,
    handler: async (ctx: Context) => {
        const body = await ctx.req.json();
        const validated = ContactRequestSchema.parse(body);

        apiLogger.info(
            {
                contactType: validated.type,
                accommodationId: validated.accommodationId,
                messageLength: validated.message.length,
                emailDomain: validated.email.split('@')[1]
            },
            'Contact form submission received'
        );

        return {
            success: true,
            message: 'Mensaje enviado correctamente'
        };
    },
    options: {
        skipAuth: true,
        customRateLimit: { requests: 5, windowMs: 60000 }
    }
});
