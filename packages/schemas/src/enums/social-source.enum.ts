/**
 * Content origin source for social posts in the Hospeda social automation system (SPEC-254).
 *
 * Identifies where a social post draft originated from, enabling audit trails
 * and workflow differentiation between AI-generated, human-authored, imported,
 * and system-generated content.
 *
 * @module social-source.enum
 */

/**
 * All possible content origin sources for a social post.
 *
 * @example
 * ```ts
 * import { SocialSourceEnum } from '@repo/schemas';
 *
 * const source: SocialSourceEnum = SocialSourceEnum.CHATGPT;
 * ```
 */
export enum SocialSourceEnum {
    /** Post draft was submitted by the Custom GPT integration via the AI ingestion endpoint. */
    CHATGPT = 'CHATGPT',

    /** Post was created manually by an admin user through the admin dashboard. */
    ADMIN = 'ADMIN',

    /** Post was imported from an external source (e.g., legacy Airtable migration). */
    IMPORT = 'IMPORT',

    /** Post was generated automatically by the system (e.g., cron-based automation). */
    SYSTEM = 'SYSTEM'
}
