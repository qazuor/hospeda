import { z } from 'zod';

/**
 * SocialSetting entity schema.
 * Key-value configuration store for the social automation pipeline
 * (e.g. make_webhook_url, default_timezone, max_hashtags_per_platform).
 *
 * No soft-delete columns and no audit FKs by design. The semantic
 * audit trail for settings changes lives in social_audit_log
 * (event SETTING_UPDATED).
 */
export const SocialSettingSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialSetting.id.uuid' }),
    /** Unique setting key, e.g. "make_webhook_url" */
    key: z.string().min(1, { message: 'zodError.socialSetting.key.required' }),
    /**
     * Setting value — always stored as text; coercion happens in the service.
     * May be an empty string for settings that are intentionally unset (e.g.
     * `make_webhook_url` before the Make.com integration is configured).
     */
    value: z.string(),
    /**
     * Value type hint for the admin UI:
     * "string" | "number" | "boolean" | "json" | "secret"
     */
    type: z
        .enum(['string', 'number', 'boolean', 'json', 'secret'], {
            error: () => ({ message: 'zodError.socialSetting.type.invalid' })
        })
        .default('string'),
    active: z.boolean().default(true),
    description: z.string().nullable().optional(),
    createdAt: z.coerce.date({ message: 'zodError.common.createdAt.required' }),
    updatedAt: z.coerce.date({ message: 'zodError.common.updatedAt.required' })
});

/** TypeScript type inferred from {@link SocialSettingSchema}. */
export type SocialSetting = z.infer<typeof SocialSettingSchema>;
