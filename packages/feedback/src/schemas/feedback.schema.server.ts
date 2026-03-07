/**
 * Server-side feedback API schema.
 *
 * This file is separated from the main schema to avoid importing Node.js
 * globals (Buffer) in browser environments. Import from `@repo/feedback/schemas/server`.
 */
import { z } from 'zod';

import { feedbackFormSchema } from './feedback.schema.js';

/**
 * Server-side API schema variant.
 *
 * Identical to `feedbackFormSchema` but attachments are typed as `Buffer`
 * (after multipart parsing) rather than `File` instances which only exist
 * in browser environments.
 */
export const feedbackApiSchema = feedbackFormSchema.extend({
    attachments: z.array(z.instanceof(Buffer)).max(5).optional()
});
