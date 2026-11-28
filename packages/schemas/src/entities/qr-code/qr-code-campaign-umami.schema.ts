import { z } from 'zod';

/**
 * QR campaigns in Umami (HOS-2679).
 *
 * Each distinct `utm_campaign` on the QR targets is a campaign. The admin lists
 * them with their live code count and a «Ver en Umami» deep link to the web
 * website filtered by the campaign. The panel only LINKS to Umami: the API never
 * calls Umami (Umami 3.5 has no role that can create segments without also being
 * able to reset or delete the website, so there is no create button).
 *
 * Contract of `GET /api/v1/admin/qr-codes/campaigns/umami`.
 */

/**
 * Why Umami cannot be linked for this campaign.
 *
 * - `COMMA_IN_CAMPAIGN` — Umami 3.5 splits an `eq` value on `,` into a list of
 *   values (measured: `eq.a,b` counts `a`, `b` AND `a,b`). No link would show the
 *   right numbers, so the campaign gets none.
 */
export const QrCampaignUmamiUnsupportedReasonSchema = z.enum(['COMMA_IN_CAMPAIGN']);

/** Why Umami cannot be linked for this campaign. */
export type QrCampaignUmamiUnsupportedReason = z.infer<
    typeof QrCampaignUmamiUnsupportedReasonSchema
>;

/**
 * Why a campaign cannot be linked in Umami, or `undefined`.
 *
 * @param input.campaign - The decoded campaign value.
 * @returns The reason, if any.
 */
export function qrCampaignUmamiUnsupportedReason(input: {
    readonly campaign: string;
}): QrCampaignUmamiUnsupportedReason | undefined {
    return input.campaign.includes(',') ? 'COMMA_IN_CAMPAIGN' : undefined;
}

/** One campaign of the panel. */
export const QrCampaignUmamiItemSchema = z.object({
    campaign: z.string(),
    /** Live QR codes whose target carries this campaign. */
    qrCount: z.number().int().nonnegative(),
    /** Set when the campaign cannot be linked (see the schema). */
    unsupportedReason: QrCampaignUmamiUnsupportedReasonSchema.optional(),
    /**
     * The web website filtered by `utmCampaign = <campaign>`. `null` when the Umami
     * URL or the web website id is not configured on the API, or when the campaign
     * carries a comma (`unsupportedReason`).
     */
    viewUrl: z.string().url().nullable()
});

/** One campaign of the panel. */
export type QrCampaignUmamiItem = z.infer<typeof QrCampaignUmamiItemSchema>;

/** Response of `GET /api/v1/admin/qr-codes/campaigns/umami`. */
export const QrCampaignsUmamiResponseSchema = z.object({
    items: z.array(QrCampaignUmamiItemSchema)
});

/** Response of `GET /api/v1/admin/qr-codes/campaigns/umami`. */
export type QrCampaignsUmamiResponse = z.infer<typeof QrCampaignsUmamiResponseSchema>;
