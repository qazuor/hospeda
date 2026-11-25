/**
 * Newsletter campaign attribution (HOS-2359 §6.B): the campaign's `utm_campaign` slug.
 *
 * Opens carry no image pixel (HOS-2583): they are recorded from Brevo's `opened`
 * webhook, so there is nothing to provision at dispatch.
 *
 * @module services/newsletter/newsletter-attribution
 */

import { buildNewsletterCampaignSlug } from '@repo/analytics';

/**
 * Attribution of a newsletter email, structurally identical to the `campaign`
 * branch of `@repo/email`'s `EmailAttribution` (service-core does not depend on
 * `@repo/email`).
 */
export interface CampaignEmailAttribution {
    readonly medium: 'campaign';
    /** `utm_campaign` of every own-origin link. */
    readonly campaignSlug: string;
}

/** Campaign fields the slug derives from. */
interface CampaignIdentity {
    readonly id: string;
    readonly title: string;
}

/**
 * Computes a campaign's attribution slug. Called by `NewsletterCampaignService.send()`
 * before the dispatch transaction; the result is written in the same UPDATE that sets
 * `SENDING`.
 *
 * @param input - The campaign identity
 * @returns The `attributionSlug` (`utm_campaign` of every own-origin link)
 */
export function computeCampaignAttributionSlug(input: {
    readonly campaign: CampaignIdentity;
}): string {
    return buildNewsletterCampaignSlug({ title: input.campaign.title, id: input.campaign.id });
}

/**
 * Attribution of a batch send, from the slugs stored at dispatch. A campaign
 * without a stored slug (dispatched before HOS-2359) recomputes it.
 *
 * @param input - The campaign row's identity and stored slugs
 * @returns The campaign email attribution
 */
export function resolveCampaignEmailAttribution(input: {
    readonly campaign: CampaignIdentity & {
        readonly attributionSlug: string | null;
    };
}): CampaignEmailAttribution {
    const { campaign } = input;
    return {
        medium: 'campaign',
        campaignSlug:
            campaign.attributionSlug ??
            buildNewsletterCampaignSlug({ title: campaign.title, id: campaign.id })
    };
}

/**
 * Attribution of a test send: campaign UTMs.
 *
 * @param input - The campaign identity
 * @returns The campaign email attribution
 */
export function buildCampaignTestSendAttribution(input: {
    readonly campaign: CampaignIdentity;
}): CampaignEmailAttribution {
    return {
        medium: 'campaign',
        campaignSlug: buildNewsletterCampaignSlug({
            title: input.campaign.title,
            id: input.campaign.id
        })
    };
}
