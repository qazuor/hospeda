import { z } from 'zod';

export const SeoSchema = z.object({
    seoTitle: z
        .string({
            required_error: 'zodError.common.seo.seoTitle.required',
            invalid_type_error: 'zodError.common.seo.seoTitle.invalidType'
        })
        .min(30, { message: 'zodError.common.seo.seoTitle.min' })
        .max(60, { message: 'zodError.common.seo.seoTitle.max' })
        .optional(),
    seoDescription: z
        .string({
            required_error: 'zodError.common.seo.seoDescription.required',
            invalid_type_error: 'zodError.common.seo.seoDescription.invalidType'
        })
        .min(70, { message: 'zodError.common.seo.seoDescription.min' })
        .max(160, { message: 'zodError.common.seo.seoDescription.max' })
        .optional(),
    seoKeywords: z
        .array(
            z.string({
                required_error: 'zodError.common.seo.seoKeywords.required',
                invalid_type_error: 'zodError.common.seo.seoKeywords.invalidType'
            })
        )
        .optional()
});
