/**
 * @repo/feedback/schemas/server - Server-only schema exports.
 *
 * Contains schemas that depend on Node.js globals (Buffer) and must NOT
 * be imported in browser environments. Re-exports from @repo/schemas
 * (the canonical definitions since SPEC-189).
 *
 * @example
 * ```ts
 * import { feedbackApiSchema } from '@repo/feedback/schemas/server';
 * ```
 */
export { feedbackApiSchema } from '@repo/schemas/feedback.server';
