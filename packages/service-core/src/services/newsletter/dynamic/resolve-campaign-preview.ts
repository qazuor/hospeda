import { getDb, newsletterCampaigns } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Actor } from '../../../types/index.js';
import { ServiceError } from '../../../types/index.js';
import { checkCanSendCampaign } from '../newsletter-campaign.permissions.js';
import { resolveCampaignContentWithReport } from './campaign-content.js';
import type { DynamicSourcePort } from './dynamic-source.port.js';
import { type RenderNewsletterEmailFn, renderCampaignContent } from './render-campaign-content.js';
import type { ResolutionReport } from './resolution.types.js';

/** Resolve and render a saved campaign without updating it or creating deliveries. */
export async function resolveCampaignPreview(input: {
    readonly actor: Actor;
    readonly id: string;
    readonly port: DynamicSourcePort;
    readonly renderNewsletterEmailFn: RenderNewsletterEmailFn;
    readonly renderTiptapEmailFn: (input: { content: unknown }) => string;
    readonly now?: Date;
}): Promise<{
    readonly html: string;
    readonly segments?: readonly string[];
    readonly report: ResolutionReport;
}> {
    checkCanSendCampaign(input.actor);
    const id = z.string().uuid().parse(input.id);
    const [campaign] = await getDb()
        .select()
        .from(newsletterCampaigns)
        .where(and(eq(newsletterCampaigns.id, id), isNull(newsletterCampaigns.deletedAt)))
        .limit(1);
    if (!campaign) {
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'Campaign not found',
            undefined,
            'CAMPAIGN_NOT_FOUND'
        );
    }
    const { content, report } = await resolveCampaignContentWithReport({
        doc: campaign.bodyJson,
        port: input.port,
        now: input.now ?? new Date()
    });
    const rendered = await renderCampaignContent({
        bodyJson: campaign.bodyJson,
        resolvedBodyJson: content,
        locale: z
            .enum(['es', 'en', 'pt'])
            .parse(campaign.localeFilter === 'all' ? 'es' : campaign.localeFilter),
        renderNewsletterEmailFn: input.renderNewsletterEmailFn,
        renderTiptapEmailFn: input.renderTiptapEmailFn
    });
    return { html: rendered.bodyHtml, segments: rendered.segments, report };
}
