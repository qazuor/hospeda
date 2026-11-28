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
 * Longest campaign the segment create accepts. A longer one is still listed, but
 * flagged `TOO_LONG` so the panel disables «Crear» instead of answering a 400.
 */
export const QR_CAMPAIGN_SEGMENT_MAX_LENGTH = 500;

/**
 * Why the state is `unavailable`.
 *
 * - `NOT_CONFIGURED` — the Umami URL or the web website id is not set.
 * - `READ_KEY_MISSING` — the view-only `HOSPEDA_UMAMI_API_KEY` is not set. Listing
 *   never falls back to the write key.
 * - `UMAMI_ERROR` — Umami did not answer, or answered something unexpected.
 */
export const QrCampaignUmamiUnavailableReasonSchema = z.enum([
    'NOT_CONFIGURED',
    'READ_KEY_MISSING',
    'UMAMI_ERROR'
]);

/** Why the state is `unavailable`. */
export type QrCampaignUmamiUnavailableReason = z.infer<
    typeof QrCampaignUmamiUnavailableReasonSchema
>;

/**
 * Why Umami cannot be used for this campaign at all.
 *
 * - `COMMA_IN_CAMPAIGN` — Umami 3.5 splits an `eq` value on `,` into a list of
 *   values (measured: `eq.a,b` counts `a`, `b` AND `a,b`), in the URL filter and in
 *   a segment alike. No link and no segment would show the right numbers.
 * - `TOO_LONG` — longer than {@link QR_CAMPAIGN_SEGMENT_MAX_LENGTH}.
 */
export const QrCampaignUmamiUnsupportedReasonSchema = z.enum(['COMMA_IN_CAMPAIGN', 'TOO_LONG']);

/** Why Umami cannot be used for this campaign at all. */
export type QrCampaignUmamiUnsupportedReason = z.infer<
    typeof QrCampaignUmamiUnsupportedReasonSchema
>;

/**
 * Why a campaign cannot be filtered or segmented in Umami, or `undefined`.
 *
 * @param input.campaign - The decoded campaign value.
 * @returns The reason, if any.
 */
export function qrCampaignUmamiUnsupportedReason(input: {
    readonly campaign: string;
}): QrCampaignUmamiUnsupportedReason | undefined {
    if (input.campaign.includes(',')) return 'COMMA_IN_CAMPAIGN';
    if (input.campaign.length > QR_CAMPAIGN_SEGMENT_MAX_LENGTH) return 'TOO_LONG';
    return undefined;
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
    /** Set when `status` is `unavailable`. */
    unavailableReason: QrCampaignUmamiUnavailableReasonSchema.optional(),
    /** Set when the campaign cannot be filtered or segmented (see the schema). */
    unsupportedReason: QrCampaignUmamiUnsupportedReasonSchema.optional(),
    /** Id of the matching segment, when `status` is `segment`. */
    segmentId: z.string().optional(),
    /**
     * The web website filtered by `utmCampaign = <campaign>` (no segment needed).
     * `null` when the Umami URL or website id is not configured, or when the
     * campaign carries a comma (`COMMA_IN_CAMPAIGN`).
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
        campaign: z.string().min(1).max(QR_CAMPAIGN_SEGMENT_MAX_LENGTH)
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
