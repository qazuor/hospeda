import type { TiptapNode } from '@repo/utils';
import { z } from 'zod';

const nodeSchema: z.ZodType<TiptapNode> = z.lazy(() =>
    z.object({
        type: z.string(),
        content: z.array(nodeSchema).optional(),
        text: z.string().optional(),
        attrs: z
            .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
            .optional(),
        marks: z
            .array(
                z.object({
                    type: z.enum(['bold', 'italic', 'link', 'code', 'underline', 'strike']),
                    attrs: z.record(z.string(), z.string().nullable()).optional()
                })
            )
            .optional()
    })
);

/** Newsletter editor document; dynamic configuration is validated separately by the resolver. */
export const NewsletterDocumentSchema = z.object({
    type: z.literal('doc'),
    content: z.array(nodeSchema).default([])
});

const cardSchema = z.object({
    name: z.string(),
    summary: z.string(),
    imageUrl: z.string().nullable(),
    url: z.string()
});
const blockSchema = z.object({
    blockKey: z.string().min(1),
    hidden: z.boolean(),
    itemIds: z.array(z.string()),
    cards: z.record(
        z.string(),
        z.object({
            es: cardSchema.optional(),
            en: cardSchema.optional(),
            pt: cardSchema.optional()
        })
    )
});

/** Versioned JSONB snapshot shared by dispatch, rendering and campaign responses. */
export const ResolvedNewsletterContentSchema = z.object({
    version: z.literal(1),
    doc: NewsletterDocumentSchema,
    blocks: z.array(blockSchema)
});

/** Frozen document and localized cards stored at dispatch. */
export type ResolvedNewsletterContent = z.infer<typeof ResolvedNewsletterContentSchema>;
