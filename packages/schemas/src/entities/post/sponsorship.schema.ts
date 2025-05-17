// export interface PostSponsorshipType extends BaseEntityType {

import { z } from 'zod';
import { BasePriceSchema } from '../../common.schema.js';

// }

/**
 * Zod schema for post sponsorship info.
 */
export const PostSponsorshipSchema = z
    .object({
        message: z
            .string()
            .min(3, 'error:post.sponsorship.message.min_lenght')
            .max(100, 'error:post.sponsorship.message.max_lenght'),
        description: z
            .string()
            .min(3, 'error:post.sponsorship.description.min_lenght')
            .max(100, 'error:post.sponsorship.description.max_lenght'),
        paid: BasePriceSchema,
        paidAt: z.coerce
            .date({ required_error: 'error:post.sponsorship.paidAt.required' })
            .refine(
                (date) => {
                    const min = new Date();
                    return date < min;
                },
                {
                    message: 'error:post.sponsorship.paidAt.min_value'
                }
            )
            .optional(),
        fromDate: z.coerce
            .date({ required_error: 'error:post.sponsorship.fromDate.required' })
            .refine(
                (date) => {
                    const min = new Date();
                    return date < min;
                },
                {
                    message: 'error:post.sponsorship.fromDate.min_value'
                }
            )
            .optional(),
        toDate: z.coerce
            .date({ required_error: 'error:post.sponsorship.toDate.required' })
            .refine(
                (date) => {
                    const min = new Date();
                    return date < min;
                },
                {
                    message: 'error:post.sponsorship.toDate.min_value'
                }
            )
            .refine(
                (date) => {
                    const max = new Date();
                    max.setFullYear(max.getFullYear() + 1);
                    return date >= max;
                },
                {
                    message: 'error:post.sponsorship.toDate.max_value'
                }
            )
            .optional(),
        isHighlighted: z.boolean({
            required_error: 'error:post.sponsorship.isHighlighted.required',
            invalid_type_error: 'error:post.sponsorship.isHighlighted.invalid_type'
        })
    })
    .superRefine((data, ctx) => {
        if (data.fromDate && data.toDate && data.toDate < data.fromDate) {
            ctx.addIssue({
                path: ['end'],
                code: z.ZodIssueCode.custom,
                message: 'error:post.sponsorship.toDate.toBeforefrom'
            });
        }
        if (data.paidAt && data.fromDate && data.paidAt > data.fromDate) {
            ctx.addIssue({
                path: ['paidAt'],
                code: z.ZodIssueCode.custom,
                message: 'error:post.sponsorship.paidAt.paidAtBeforeFrom'
            });
        }
    });

export type PostSponsorshipInput = z.infer<typeof PostSponsorshipSchema>;
