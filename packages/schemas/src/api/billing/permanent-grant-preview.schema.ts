import { z } from 'zod';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';

/** Projected effects of granting or anchoring a permanent grant. */
export const PermanentGrantPreviewResponseSchema = z.object({
    stoppedCharges: z.array(
        z.object({
            subscriptionId: z.uuid(),
            vertical: VerticalEnumSchema,
            status: z.enum([
                'ACTIVE',
                'PENDING_AUTHORIZATION',
                'GRACE_PERIOD',
                'PAUSED',
                'SUSPENDED',
                'CANCEL_SCHEDULED',
                'CANCELLED'
            ]),
            providerEmail: z.boolean()
        })
    ),
    endingCourtesies: z.array(
        z.object({
            subscriptionId: z.uuid(),
            vertical: VerticalEnumSchema,
            endsAt: z.string().datetime(),
            providerEmail: z.boolean()
        })
    ),
    closedDeferredBalances: z.array(
        z.object({
            courtesyGrantId: z.uuid(),
            vertical: VerticalEnumSchema,
            balanceMonths: z.number().int()
        })
    ),
    convertedAddons: z.array(
        z.object({
            addonInstanceId: z.uuid(),
            addonName: z.string(),
            complementSubscriptionId: z.uuid(),
            providerEmail: z.boolean()
        })
    )
});

/** Projected loss of service and addons after revocation. */
export const PermanentGrantRevocationPreviewResponseSchema = z.object({
    permanentGrantId: z.uuid(),
    verticalsLosingService: z.array(VerticalEnumSchema),
    addonsTurnedOff: z.array(z.object({ addonInstanceId: z.uuid(), addonName: z.string() })),
    trialReturns: z.literal(false),
    oldDebitResumes: z.literal(false)
});

/** Path parameters for reading a beneficiary's live grant. */
export const LivePermanentGrantParamsSchema = z.object({ userId: z.uuid() });

/** The live grant and its anchors, or null when no live grant exists. */
export const LivePermanentGrantResponseSchema = z.object({
    grant: z
        .object({
            permanentGrantId: z.uuid(),
            includesAddons: z.boolean(),
            createdAt: z.string().datetime(),
            anchors: z.array(
                z.object({
                    vertical: VerticalEnumSchema,
                    planId: z.uuid(),
                    floorPlanVersionId: z.uuid()
                })
            )
        })
        .nullable()
});

/** Parsed permanent grant effect preview. */
export type PermanentGrantPreviewResponse = z.infer<typeof PermanentGrantPreviewResponseSchema>;
/** Parsed permanent grant revocation preview. */
export type PermanentGrantRevocationPreviewResponse = z.infer<
    typeof PermanentGrantRevocationPreviewResponseSchema
>;
/** Parsed live grant lookup parameters. */
export type LivePermanentGrantParams = z.infer<typeof LivePermanentGrantParamsSchema>;
/** Parsed live grant lookup response. */
export type LivePermanentGrantResponse = z.infer<typeof LivePermanentGrantResponseSchema>;
