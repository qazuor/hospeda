import { DynamicBlockConfigSchema, ServiceErrorCode } from '@repo/schemas';
import type { TiptapNode } from '@repo/utils';
import { z } from 'zod';
import { ServiceError } from '../../../types/index.js';
import type { DynamicSourcePort } from './dynamic-source.port.js';
import { resolveBlocks } from './resolve-blocks.js';

const nodeSchema: z.ZodType<TiptapNode> = z.lazy(() =>
    z.object({
        type: z.string(),
        content: z.array(nodeSchema).optional(),
        text: z.string().optional(),
        attrs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
        marks: z
            .array(
                z.object({
                    type: z.enum(['bold', 'italic', 'link', 'code', 'underline']),
                    attrs: z.record(z.string(), z.string()).optional()
                })
            )
            .optional()
    })
);

/** Validated TipTap content used by the injected newsletter renderer. */
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

/** Versioned JSONB contract; maps are deliberately projected to plain records. */
export const ResolvedNewsletterContentSchema = z.object({
    version: z.literal(1),
    doc: NewsletterDocumentSchema,
    blocks: z.array(blockSchema)
});

/** Frozen document and localized card data, independent of the notifications package. */
export type ResolvedNewsletterContent = z.infer<typeof ResolvedNewsletterContentSchema>;

/** Detect dynamic nodes recursively so malformed nested blocks also fail closed. */
export function hasDynamicBlocks({ doc }: { readonly doc: unknown }): boolean {
    if (!doc || typeof doc !== 'object') return false;
    if ('type' in doc && doc.type === 'dynamicBlock') return true;
    return (
        'content' in doc &&
        Array.isArray(doc.content) &&
        doc.content.some((node: unknown) => hasDynamicBlocks({ doc: node }))
    );
}

/** Resolve a manual campaign without writes; callers own the persistence transaction. */
export async function resolveCampaignContent(input: {
    readonly doc: unknown;
    readonly port?: DynamicSourcePort;
    readonly now: Date;
}): Promise<ResolvedNewsletterContent | null> {
    if (!hasDynamicBlocks({ doc: input.doc })) return null;
    const doc = NewsletterDocumentSchema.parse(input.doc);
    const blocks = doc.content
        .filter((node) => node.type === 'dynamicBlock')
        .map((node) => {
            const config = DynamicBlockConfigSchema.parse(
                JSON.parse(String(node.attrs?.config ?? 'null'))
            );
            if (config.blockKey !== node.attrs?.blockKey) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Dynamic block key does not match its configuration',
                    undefined,
                    'INVALID_DYNAMIC_BLOCK'
                );
            }
            return config;
        });
    if (
        doc.content.some((node) => node.type !== 'dynamicBlock' && hasDynamicBlocks({ doc: node }))
    ) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Dynamic blocks must be root nodes',
            undefined,
            'INVALID_DYNAMIC_BLOCK'
        );
    }
    if (!input.port) {
        throw new ServiceError(
            ServiceErrorCode.SERVICE_UNAVAILABLE,
            'Dynamic source port is not configured',
            undefined,
            'DYNAMIC_SOURCE_NOT_CONFIGURED'
        );
    }
    const result = await resolveBlocks({
        blocks,
        phase: 'send',
        now: input.now,
        history: [],
        locales: ['es', 'en', 'pt'],
        port: input.port
    });
    if (result.decision === 'skip_run') {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Dynamic block has fewer eligible items than its minimum',
            { statusCode: 422, report: result.report },
            'DYNAMIC_BLOCK_BELOW_MIN'
        );
    }
    return ResolvedNewsletterContentSchema.parse({
        version: 1,
        doc,
        blocks: result.blocks.map(({ blockKey, hidden, itemIds, cards }) => ({
            blockKey,
            hidden,
            itemIds: [...itemIds],
            cards: Object.fromEntries(cards)
        }))
    });
}
