/**
 * QR campaigns with a «Ver en Umami» link (HOS-2679).
 *
 * Each distinct `utm_campaign` on the QR targets is a campaign. This module adds
 * the Umami side to the campaign list the QR service already computes: a deep
 * link to the web website filtered by the campaign
 * (`/websites/<websiteId>?utmCampaign=eq.<campaign>`).
 *
 * ## No Umami calls
 *
 * The link is built from `HOSPEDA_UMAMI_URL` and `HOSPEDA_UMAMI_WEBSITE_ID_WEB`,
 * which the api already has. Nothing here talks to Umami over HTTP, reads an API
 * key or creates anything. There is no «create segment»: Umami 3.5 has no role that
 * can create segments without also being able to reset or delete the website, so the
 * owner chose to only link (decision recorded on HOS-2679). The api never writes to
 * Umami's API (`no-umami-write-credential.guard.test.ts`).
 *
 * ## Campaigns Umami cannot filter
 *
 * Umami 3.5 splits an `eq` value on `,`, so a campaign with a comma gets no link
 * (`unsupportedReason: 'COMMA_IN_CAMPAIGN'`). A dot is fine: Umami splits the
 * operator on the first dot only.
 *
 * @module services/qr-campaign-umami
 */

import {
    type QrCampaignsUmamiResponse,
    type QrCampaignUmamiItem,
    qrCampaignUmamiUnsupportedReason
} from '@repo/schemas';
import { env } from '../utils/env';

/** The Umami settings this module needs; every field is optional. */
export interface QrCampaignUmamiConfig {
    readonly baseUrl?: string;
    readonly websiteId?: string;
}

/** A campaign with its live code count, as the QR service returns it. */
export interface QrCampaignCount {
    readonly campaign: string;
    readonly qrCount: number;
}

/**
 * Deep link to the web website filtered by one campaign. The `eq.` operator and the
 * campaign travel in ONE encoded value, as Umami's URL filters expect.
 *
 * @param input.baseUrl - Umami base URL
 * @param input.websiteId - Web website id
 * @param input.campaign - Decoded campaign value (without a comma)
 * @returns The URL
 */
export function buildUmamiCampaignViewUrl(input: {
    readonly baseUrl: string;
    readonly websiteId: string;
    readonly campaign: string;
}): string {
    const base = input.baseUrl.replace(/\/+$/, '');
    return `${base}/websites/${encodeURIComponent(input.websiteId)}?utmCampaign=${encodeURIComponent(`eq.${input.campaign}`)}`;
}

/**
 * Adds the Umami link to every campaign. Pure: no I/O.
 *
 * @param input.campaigns - Campaigns with their counts (from the QR service)
 * @param input.config - Test-only override; production reads the api env
 * @returns The panel rows
 */
export function resolveQrCampaignsUmami(input: {
    readonly campaigns: readonly QrCampaignCount[];
    readonly config?: QrCampaignUmamiConfig;
}): QrCampaignsUmamiResponse {
    const config: QrCampaignUmamiConfig = input.config ?? {
        baseUrl: env.HOSPEDA_UMAMI_URL,
        websiteId: env.HOSPEDA_UMAMI_WEBSITE_ID_WEB
    };
    const items = input.campaigns.map((entry): QrCampaignUmamiItem => {
        const unsupportedReason = qrCampaignUmamiUnsupportedReason({ campaign: entry.campaign });
        const viewUrl =
            unsupportedReason || !config.baseUrl || !config.websiteId
                ? null
                : buildUmamiCampaignViewUrl({
                      baseUrl: config.baseUrl,
                      websiteId: config.websiteId,
                      campaign: entry.campaign
                  });
        return {
            campaign: entry.campaign,
            qrCount: entry.qrCount,
            ...(unsupportedReason ? { unsupportedReason } : {}),
            viewUrl
        };
    });
    return { items };
}
