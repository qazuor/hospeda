import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';

/** Schema for one permanent grant vertical anchor. */
export const anchorSchema = z.strictObject({
    vertical: VerticalEnumSchema,
    planId: z.uuid(),
    floorPlanVersionId: z.uuid()
});

/** Schema for creating a permanent grant with unique vertical anchors. */
export const grantSchema = z
    .strictObject({
        beneficiaryUserId: z.uuid(),
        grantedBy: z.uuid(),
        reason: z.string().refine((value) => value.trim().length > 0),
        includesAddons: z.boolean(),
        anchors: z.array(anchorSchema).min(1)
    })
    .superRefine((value, ctx) => {
        const seen = new Set<string>();
        for (const anchor of value.anchors) {
            if (seen.has(anchor.vertical))
                ctx.addIssue({
                    code: 'custom',
                    message: 'Verticals must be unique',
                    path: ['anchors']
                });
            seen.add(anchor.vertical);
        }
    });

/** Schema for adding one vertical anchor to a permanent grant. */
export const anchorInputSchema = z.strictObject({
    permanentGrantId: z.uuid(),
    anchoredBy: z.uuid(),
    ...anchorSchema.shape
});

/** Creates the typed validation error for invalid permanent-grant input. */
export function invalidPermanentGrantInput(error: unknown): ServiceError {
    return new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        'Invalid permanent grant input',
        error,
        'INVALID_PERMANENT_GRANT_INPUT'
    );
}
