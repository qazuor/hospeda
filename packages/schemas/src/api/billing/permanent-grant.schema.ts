import { z } from 'zod';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';

/** One permanent-grant anchor selected when granting or extending a grant. */
export const PermanentGrantAnchorBodySchema = z.strictObject({
    vertical: VerticalEnumSchema,
    planId: z.uuid(),
    floorPlanVersionId: z.uuid()
});

/** Request to create a permanent grant with at least one unique vertical anchor. */
export const PermanentGrantCreateRequestSchema = z
    .strictObject({
        beneficiaryUserId: z.uuid(),
        reason: z.string().trim().min(1).max(2000),
        includesAddons: z.boolean(),
        anchors: z.array(PermanentGrantAnchorBodySchema).min(1)
    })
    .refine(
        (body) =>
            new Set(body.anchors.map(({ vertical }) => vertical)).size === body.anchors.length,
        {
            message: 'Verticals must be unique',
            path: ['anchors']
        }
    );

/** Path parameters identifying the permanent grant to anchor. */
export const PermanentGrantAnchorParamsSchema = z.object({ permanentGrantId: z.uuid() });

/** Provider cancellation disposition shared by principal and complement calls. */
export const PermanentGrantProviderCancelCallSchema = z.enum([
    'SENT',
    'NOT_NEEDED',
    'NOTICE_PENDING',
    'FAILED',
    'NOT_APPLICABLE'
]);

/** Cancellation attempt recorded for a principal subscription. */
const providerCallSchema = z.object({
    subscriptionId: z.uuid(),
    cancelCall: PermanentGrantProviderCancelCallSchema,
    escalated: z.enum(['NO_RECIPIENT', 'DELIVERY_EXHAUSTED']).optional()
});

/** Cancellation attempt recorded for an addon complement subscription (S20). */
const addonProviderCallSchema = z.object({
    subscriptionId: z.uuid(),
    cancelCall: PermanentGrantProviderCancelCallSchema,
    escalated: z.enum(['NO_RECIPIENT', 'DELIVERY_EXHAUSTED']).optional()
});

/** Result of creating a permanent grant and applying S13/S20. */
export const PermanentGrantCreateResponseSchema = z.object({
    permanentGrantId: z.uuid(),
    anchorIds: z.array(z.uuid()),
    cancelledSubscriptionIds: z.array(z.uuid()),
    releasedRetentionIds: z.array(z.uuid()),
    closedCourtesyIds: z.array(z.uuid()),
    providerCalls: z.array(providerCallSchema),
    anchoredAddonInstanceIds: z.array(z.uuid()),
    addonProviderCalls: z.array(addonProviderCallSchema)
});

/** Result of anchoring a new vertical and applying S13/S20. */
export const PermanentGrantAnchorResponseSchema = z.object({
    anchorId: z.uuid(),
    cancelledSubscriptionIds: z.array(z.uuid()),
    releasedRetentionIds: z.array(z.uuid()),
    closedCourtesyIds: z.array(z.uuid()),
    providerCalls: z.array(providerCallSchema),
    anchoredAddonInstanceIds: z.array(z.uuid()),
    addonProviderCalls: z.array(addonProviderCallSchema)
});

/** Parsed request to create a permanent grant. */
export type PermanentGrantCreateRequest = z.infer<typeof PermanentGrantCreateRequestSchema>;

/** Parsed permanent-grant anchor body. */
export type PermanentGrantAnchorBody = z.infer<typeof PermanentGrantAnchorBodySchema>;

/** Parsed permanent-grant anchor route parameters. */
export type PermanentGrantAnchorParams = z.infer<typeof PermanentGrantAnchorParamsSchema>;

/** Response after creating a permanent grant. */
export type PermanentGrantCreateResponse = z.infer<typeof PermanentGrantCreateResponseSchema>;

/** Response after anchoring a vertical to a permanent grant. */
export type PermanentGrantAnchorResponse = z.infer<typeof PermanentGrantAnchorResponseSchema>;
