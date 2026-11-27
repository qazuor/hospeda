import { ServiceErrorCode } from '@repo/schemas';
import type { TiptapDocument } from '@repo/utils';
import { ServiceError } from '../../../types/index.js';
import {
    hasDynamicBlocks,
    NewsletterDocumentSchema,
    type ResolvedNewsletterContent,
    ResolvedNewsletterContentSchema
} from './campaign-content.js';

/** Structurally compatible with notifications' renderNewsletterEmail; no circular import. */
export type RenderNewsletterEmailFn = (input: {
    readonly doc: TiptapDocument | null | undefined;
    readonly resolvedBlocks?: readonly ResolvedNewsletterContent['blocks'][number][];
    readonly locale: 'es' | 'en' | 'pt';
}) => Promise<NewsletterRenderedContent>;

/** Trusted renderer output, including mandatory unresolved-block diagnostics. */
export interface NewsletterRenderedContent {
    readonly bodyHtml: string;
    readonly segments: readonly string[];
    readonly unresolvedBlockKeys: readonly string[];
}

/** Stable failure used by workers to mark deliveries failed before transport. */
export function unresolvedContentError(): ServiceError {
    return new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        'Dynamic newsletter content is unresolved',
        undefined,
        'DYNAMIC_BLOCK_UNRESOLVED'
    );
}

/** Validate frozen content and render only; this module never accesses a source port. */
export async function renderCampaignContent(input: {
    readonly bodyJson: unknown;
    readonly resolvedBodyJson?: unknown;
    readonly locale: 'es' | 'en' | 'pt';
    readonly renderNewsletterEmailFn?: RenderNewsletterEmailFn;
    readonly renderTiptapEmailFn: (input: { content: unknown }) => string;
}): Promise<{ readonly bodyHtml: string; readonly segments?: readonly string[] }> {
    const dynamic = hasDynamicBlocks({ doc: input.bodyJson });
    const parsed =
        input.resolvedBodyJson == null
            ? null
            : ResolvedNewsletterContentSchema.safeParse(input.resolvedBodyJson);
    if ((parsed && !parsed.success) || (dynamic && !parsed)) throw unresolvedContentError();
    const frozen = parsed?.success ? parsed.data : null;
    // Static campaigns keep the pre-F1 path verbatim (AC-F1-16): no re-parse that could reject them.
    if (!dynamic && !frozen) {
        return { bodyHtml: input.renderTiptapEmailFn({ content: input.bodyJson }) };
    }
    if (!input.renderNewsletterEmailFn) throw unresolvedContentError();
    const doc = frozen?.doc ?? NewsletterDocumentSchema.parse(input.bodyJson);
    // The renderer only splits root blocks; nested blocks must never disappear silently.
    if (
        doc.content.some((node) => node.type !== 'dynamicBlock' && hasDynamicBlocks({ doc: node }))
    ) {
        throw unresolvedContentError();
    }
    const result = await input.renderNewsletterEmailFn({
        doc,
        resolvedBlocks: frozen?.blocks,
        locale: input.locale
    });
    if (result.unresolvedBlockKeys.length > 0) throw unresolvedContentError();
    return { bodyHtml: result.bodyHtml, ...(frozen ? { segments: result.segments } : {}) };
}
