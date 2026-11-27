import type { NewsletterPreviewSelection, ResolvedNewsletterContent } from '@repo/schemas';
import {
    DynamicBlockConfigSchema,
    NewsletterDocumentSchema,
    ResolvedNewsletterContentSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types/index.js';
import { DynamicResolutionError } from './dynamic-resolution.error.js';
import type { DynamicSourcePort } from './dynamic-source.port.js';
import { buildCurrentFromPreviewSelection } from './preview-selection.js';
import type { ResolutionReport } from './resolution.types.js';
import { resolveBlocks } from './resolve-blocks.js';

export type { ResolvedNewsletterContent } from '@repo/schemas';
export { NewsletterDocumentSchema, ResolvedNewsletterContentSchema } from '@repo/schemas';

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
    readonly previewSelection?: NewsletterPreviewSelection;
}): Promise<ResolvedNewsletterContent | null> {
    return (await resolveCampaignContentWithReport(input)).content;
}

/** Resolve through the send path while retaining diagnostics for a write-free preview. */
export async function resolveCampaignContentWithReport(input: {
    readonly doc: unknown;
    readonly port?: DynamicSourcePort;
    readonly now: Date;
    readonly previewSelection?: NewsletterPreviewSelection;
}): Promise<{
    readonly content: ResolvedNewsletterContent | null;
    readonly report: ResolutionReport;
}> {
    if (!hasDynamicBlocks({ doc: input.doc })) return { content: null, report: { blocks: [] } };
    try {
        return await resolveDynamicContent(input);
    } catch (error) {
        if (
            error instanceof z.ZodError ||
            error instanceof SyntaxError ||
            (error instanceof DynamicResolutionError &&
                error.code === 'DUPLICATE_DYNAMIC_BLOCK_KEY')
        ) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Invalid dynamic block configuration',
                undefined,
                'INVALID_DYNAMIC_BLOCK'
            );
        }
        throw error;
    }
}

async function resolveDynamicContent(input: {
    readonly doc: unknown;
    readonly port?: DynamicSourcePort;
    readonly now: Date;
    readonly previewSelection?: NewsletterPreviewSelection;
}): Promise<{ readonly content: ResolvedNewsletterContent; readonly report: ResolutionReport }> {
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
        current: buildCurrentFromPreviewSelection({
            previewSelection: input.previewSelection,
            blockKeys: blocks.map((block) => block.blockKey)
        }),
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
    const content = ResolvedNewsletterContentSchema.parse({
        version: 1,
        doc,
        blocks: result.blocks.map(({ blockKey, hidden, itemIds, cards }) => ({
            blockKey,
            hidden,
            itemIds: [...itemIds],
            cards: Object.fromEntries(cards)
        }))
    });
    return { content, report: result.report };
}
