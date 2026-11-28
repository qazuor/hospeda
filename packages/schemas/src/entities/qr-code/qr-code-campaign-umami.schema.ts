import { z } from 'zod';

/**
 * QR campaigns in Umami (HOS-2679 PR 2).
 *
 * Each distinct `utm_campaign` on the QR targets is a campaign. The admin lists
 * them with their code count and their state in Umami: whether a segment named
 * `QR · <campaign>` exists on the web website. A missing segment can be created
 * on demand. These schemas are the contract of the two admin endpoints:
 *
 * - `GET  /api/v1/admin/qr-codes/campaigns/umami`
 * - `POST /api/v1/admin/qr-codes/campaigns/umami-segment`
 */

/** Prefix of every QR campaign segment name in Umami. */
export const QR_CAMPAIGN_SEGMENT_NAME_PREFIX = 'QR · ' as const;

/**
 * The Umami segment name of a QR campaign.
 *
 * @param input.campaign - The decoded campaign value.
 * @returns `QR · <campaign>`.
 */
export function qrCampaignSegmentName(input: { readonly campaign: string }): string {
    return `${QR_CAMPAIGN_SEGMENT_NAME_PREFIX}${input.campaign}`;
}

/**
 * State of a campaign in Umami.
 *
 * - `segment` — a segment with the exact name exists.
 * - `missing` — Umami answered and holds no such segment.
 * - `unavailable` — Umami is not configured or did not answer; the state is unknown.
 */
export const QrCampaignUmamiStatusSchema = z.enum(['segment', 'missing', 'unavailable']);

/** State of a campaign in Umami. */
export type QrCampaignUmamiStatus = z.infer<typeof QrCampaignUmamiStatusSchema>;

/** Umami side of one campaign row. */
export const QrCampaignUmamiInfoSchema = z.object({
    status: QrCampaignUmamiStatusSchema,
    /** Id of the matching segment, when `status` is `segment`. */
    segmentId: z.string().optional(),
    /**
     * The web website filtered by `utmCampaign = <campaign>` (no segment needed).
     * `null` when the Umami URL or website id is not configured.
     */
    viewUrl: z.string().url().nullable(),
    /** The web website with the segment applied, when `status` is `segment`. */
    segmentUrl: z.string().url().optional()
});

/** Umami side of one campaign row. */
export type QrCampaignUmamiInfo = z.infer<typeof QrCampaignUmamiInfoSchema>;

/** One campaign of the panel. */
export const QrCampaignUmamiItemSchema = z.object({
    campaign: z.string(),
    /** Live QR codes whose target carries this campaign. */
    qrCount: z.number().int().nonnegative(),
    umami: QrCampaignUmamiInfoSchema
});

/** One campaign of the panel. */
export type QrCampaignUmamiItem = z.infer<typeof QrCampaignUmamiItemSchema>;

/** Response of `GET /api/v1/admin/qr-codes/campaigns/umami`. */
export const QrCampaignsUmamiResponseSchema = z.object({
    items: z.array(QrCampaignUmamiItemSchema),
    /**
     * Whether the API can create segments: the Umami URL, the web website id and
     * the write key are all configured. Says nothing about whether Umami is up.
     */
    canCreateSegments: z.boolean()
});

/** Response of `GET /api/v1/admin/qr-codes/campaigns/umami`. */
export type QrCampaignsUmamiResponse = z.infer<typeof QrCampaignsUmamiResponseSchema>;

/** Body of `POST /api/v1/admin/qr-codes/campaigns/umami-segment`. */
export const QrCampaignUmamiSegmentCreateSchema = z
    .object({
        campaign: z.string().min(1).max(500)
    })
    .strict();

/** Body of `POST /api/v1/admin/qr-codes/campaigns/umami-segment`. */
export type QrCampaignUmamiSegmentCreate = z.infer<typeof QrCampaignUmamiSegmentCreateSchema>;

/** Response of `POST /api/v1/admin/qr-codes/campaigns/umami-segment`. */
export const QrCampaignUmamiSegmentResponseSchema = z.object({
    item: QrCampaignUmamiItemSchema,
    /** `true` when this call created the segment, `false` when it already existed. */
    created: z.boolean()
});

/** Response of `POST /api/v1/admin/qr-codes/campaigns/umami-segment`. */
export type QrCampaignUmamiSegmentResponse = z.infer<typeof QrCampaignUmamiSegmentResponseSchema>;
