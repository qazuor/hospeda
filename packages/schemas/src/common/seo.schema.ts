import { z } from 'zod';

/**
 * SEO Schema - Search Engine Optimization information
 */
export const SeoSchema = z.object({
    title: z
        .string({
            message: 'zodError.common.seo.title.required'
        })
        .min(30, { message: 'zodError.common.seo.title.min' })
        .max(60, { message: 'zodError.common.seo.title.max' })
        .optional(),
    description: z
        .string({
            message: 'zodError.common.seo.description.required'
        })
        .min(70, { message: 'zodError.common.seo.description.min' })
        .max(160, { message: 'zodError.common.seo.description.max' })
        .optional(),
    keywords: z
        .array(
            z.string({
                message: 'zodError.common.seo.keywords.required'
            })
        )
        .optional()
});
export type Seo = z.infer<typeof SeoSchema>;

/**
 * Base SEO fields
 */
export const BaseSeoFields = {
    seo: SeoSchema.optional()
} as const;
