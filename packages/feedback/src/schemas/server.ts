/**
 * @repo/feedback/schemas/server - Server-only schema exports.
 *
 * Contains schemas that depend on Node.js globals (Buffer) and must NOT
 * be imported in browser environments.
 *
 * @example
 * ```ts
 * import { feedbackApiSchema } from '@repo/feedback/schemas/server';
 * ```
 */
export { feedbackApiSchema } from './feedback.schema.server.js';
