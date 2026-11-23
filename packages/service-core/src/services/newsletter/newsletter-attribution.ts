/**
 * Newsletter campaign attribution (HOS-2359 §6.B): the campaign's `utm_campaign`
 * slug and its Umami open pixel.
 *
 * Service-core never talks to Umami: the host app injects a
 * {@link CampaignPixelProvisioner} (in `apps/api`, `ensureUmamiPixel`), and every
 * failure of it means "no pixel", never a blocked send (OD-3).
 *
 * @module services/newsletter/newsletter-attribution
 */

import { buildNewsletterCampaignSlug, buildNewsletterPixelSlug } from '@repo/analytics';

/**
 * Attribution of a newsletter email, structurally identical to the `campaign`
 * branch of `@repo/email`'s `EmailAttribution` (service-core does not depend on
 * `@repo/email`).
 */
export interface CampaignEmailAttribution {
    readonly medium: 'campaign';
    /** `utm_campaign` of every own-origin link. */
    readonly campaignSlug: string;
    /** Umami pixel slug, or `null` for no pixel. */
    readonly pixelSlug: string | null;
}

/**
 * Creates (or reuses) the Umami pixel of a campaign. Answers the pixel's slug, or
 * `null` when it could not be provisioned. Implementations should not throw; a
 * rejection is treated as `null` anyway.
 */
export type CampaignPixelProvisioner = (input: {
    readonly slug: string;
    readonly name: string;
}) => Promise<{ readonly slug: string } | null>;

/** Minimal logger the helpers need. */
interface WarnLogger {
    warn: (message: string) => void;
}

/** Campaign fields the slug derives from. */
interface CampaignIdentity {
    readonly id: string;
    readonly title: string;
}

/**
 * Computes a campaign's attribution slug and provisions its pixel. Called by
 * `NewsletterCampaignService.send()` before the dispatch transaction; the result is
 * written in the same UPDATE that sets `SENDING`.
 *
 * @param input - The campaign, the optional provisioner and a logger
 * @returns `attributionSlug` and `umamiPixelSlug` (null when there is no pixel)
 */
export async function provisionCampaignAttribution(input: {
    readonly campaign: CampaignIdentity;
    readonly provisioner: CampaignPixelProvisioner | undefined;
    readonly logger: WarnLogger;
}): Promise<{ readonly attributionSlug: string; readonly umamiPixelSlug: string | null }> {
    const { campaign, provisioner, logger } = input;
    const attributionSlug = buildNewsletterCampaignSlug({ title: campaign.title, id: campaign.id });
    if (!provisioner) {
        return { attributionSlug, umamiPixelSlug: null };
    }
    try {
        const pixel = await provisioner({
            slug: buildNewsletterPixelSlug({ campaignSlug: attributionSlug }),
            name: `Newsletter · ${campaign.title}`
        });
        return { attributionSlug, umamiPixelSlug: pixel?.slug ?? null };
    } catch (error) {
        logger.warn(
            `[newsletterCampaign.send] campaign pixel provisioning failed for ${campaign.id}; sending without a pixel: ${error instanceof Error ? error.message : String(error)}`
        );
        return { attributionSlug, umamiPixelSlug: null };
    }
}

/**
 * Attribution of a batch send, from the slugs stored at dispatch. A campaign
 * without a stored slug (dispatched before HOS-2359) recomputes it and gets no pixel.
 *
 * @param input - The campaign row's identity and stored slugs
 * @returns The campaign email attribution
 */
export function resolveCampaignEmailAttribution(input: {
    readonly campaign: CampaignIdentity & {
        readonly attributionSlug: string | null;
        readonly umamiPixelSlug: string | null;
    };
}): CampaignEmailAttribution {
    const { campaign } = input;
    return {
        medium: 'campaign',
        campaignSlug:
            campaign.attributionSlug ??
            buildNewsletterCampaignSlug({ title: campaign.title, id: campaign.id }),
        pixelSlug: campaign.umamiPixelSlug ?? null
    };
}

/**
 * Attribution of a test send: campaign UTMs, never a pixel (a test send must not
 * count as an open, AC-13).
 *
 * @param input - The campaign identity
 * @returns The campaign email attribution with `pixelSlug: null`
 */
export function buildCampaignTestSendAttribution(input: {
    readonly campaign: CampaignIdentity;
}): CampaignEmailAttribution {
    return {
        medium: 'campaign',
        campaignSlug: buildNewsletterCampaignSlug({
            title: input.campaign.title,
            id: input.campaign.id
        }),
        pixelSlug: null
    };
}
