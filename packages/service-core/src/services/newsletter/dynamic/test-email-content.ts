import { ServiceErrorCode } from '@repo/schemas';
import { buildNewsletterUnsubscribePageUrl } from '@repo/utils';
import { z } from 'zod';
import type { ServiceOutput } from '../../../types/index.js';
import { ServiceError } from '../../../types/index.js';
import { buildCampaignTestSendAttribution } from '../newsletter-attribution.js';
import type { INewsletterDeliveryService } from '../newsletter-campaign.service.js';
import type {
    BuildCampaignReactElementFn,
    SingleEmailTransport
} from '../newsletter-delivery.service.js';
import { resolveCampaignContent } from './campaign-content.js';
import type { DynamicSourcePort } from './dynamic-source.port.js';
import { type RenderNewsletterEmailFn, renderCampaignContent } from './render-campaign-content.js';

/** Input boundary for a write-free preview using supplied campaign content. */
export const SendTestEmailFromContentSchema = z.object({
    campaign: z.object({
        id: z.string().uuid(),
        title: z.string(),
        subject: z.string(),
        bodyJson: z.unknown()
    }),
    toEmail: z.string().email(),
    resolvedBodyJson: z.unknown().optional(),
    locale: z.enum(['es', 'en', 'pt']).default('es')
});

/** Content-based preview input; never requires a database lookup. */
export type SendTestEmailFromContentInput = z.input<typeof SendTestEmailFromContentSchema>;

/** Resolve a campaign's current draft for preview, preserving the legacy static path. */
export async function resolveAndSendCampaignTest(input: {
    readonly campaign: SendTestEmailFromContentInput['campaign'] & {
        readonly localeFilter: string;
    };
    readonly toEmail: string;
    readonly port?: DynamicSourcePort;
    readonly deliveryService: INewsletterDeliveryService;
}): Promise<ServiceOutput<{ sentTo: string }>> {
    const { campaign, toEmail, port, deliveryService } = input;
    const resolvedBodyJson = await resolveCampaignContent({
        doc: campaign.bodyJson,
        port,
        now: new Date()
    });
    if (!resolvedBodyJson)
        return deliveryService.sendTestEmail({ campaignId: campaign.id, toEmail });
    return deliveryService.sendTestEmailFromContent({
        campaign,
        resolvedBodyJson,
        toEmail,
        locale:
            campaign.localeFilter === 'en' || campaign.localeFilter === 'pt'
                ? campaign.localeFilter
                : 'es'
    });
}

/** Render supplied content and send one preview, without any database access. */
export async function sendContentTestEmail(input: {
    readonly content: z.output<typeof SendTestEmailFromContentSchema>;
    readonly siteUrl: string;
    readonly emailTransport?: SingleEmailTransport;
    readonly buildCampaignReactElementFn?: BuildCampaignReactElementFn;
    readonly renderNewsletterEmailFn?: RenderNewsletterEmailFn;
    readonly renderTiptapEmailFn: (input: { content: unknown }) => string;
}): Promise<{ sentTo: string }> {
    if (!input.emailTransport || !input.buildCampaignReactElementFn) {
        throw new ServiceError(
            ServiceErrorCode.SERVICE_UNAVAILABLE,
            'Preview transport and template builder must be configured',
            undefined,
            input.emailTransport
                ? 'CAMPAIGN_REACT_BUILDER_NOT_CONFIGURED'
                : 'EMAIL_TRANSPORT_NOT_CONFIGURED'
        );
    }
    const { campaign, toEmail, locale, resolvedBodyJson } = input.content;
    const rendered = await renderCampaignContent({
        bodyJson: campaign.bodyJson,
        resolvedBodyJson,
        locale,
        renderNewsletterEmailFn: input.renderNewsletterEmailFn,
        renderTiptapEmailFn: input.renderTiptapEmailFn
    });
    const react = input.buildCampaignReactElementFn({
        subject: campaign.subject,
        ...rendered,
        unsubscribeUrl: buildNewsletterUnsubscribePageUrl({ siteUrl: input.siteUrl, locale }),
        isTest: true
    });
    await input.emailTransport.send({
        to: toEmail,
        subject: `[PRUEBA] ${campaign.subject}`,
        react,
        attribution: buildCampaignTestSendAttribution({ campaign })
    });
    return { sentTo: toEmail };
}
