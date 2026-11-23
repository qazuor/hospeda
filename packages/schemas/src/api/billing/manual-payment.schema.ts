import { z } from 'zod';

/** Path identifiers for the administrative manual payment routes. */
export const ManualPaymentParamsSchema = z.strictObject({
    subscriptionId: z.uuid(),
    manualPaymentId: z.uuid()
});

/** Path identifier for the installment list. */
export const ManualPaymentListParamsSchema = ManualPaymentParamsSchema.pick({
    subscriptionId: true
});

/** Optional receipt reference supplied when an administrator registers payment. */
export const ManualPaymentRegistrationBodySchema = z.strictObject({
    proofRef: z.string().min(1).max(500).optional()
});

/** Optional proof for an MP4 payment received after declaration. */
export const LateManualPaymentBodySchema = ManualPaymentRegistrationBodySchema;

/** Optional proof for an MP6 transfer without an open installment. */
export const UnallocatedManualPaymentBodySchema = ManualPaymentRegistrationBodySchema;

const iso = z.iso.datetime();
const effect = z.enum(['S29', 'S5', 'S19', 'NONE']);

/** Read-only confirmation of MP1. */
export const ManualPaymentRegistrationPreviewResponseSchema = z.strictObject({
    subscriptionId: z.uuid(),
    manualPaymentId: z.uuid(),
    periodStart: iso,
    effect,
    nextChargeAt: iso
});

/** Result of MP1. */
export const ManualPaymentRegistrationResponseSchema = z.strictObject({
    outcome: z.literal('REGISTERED'),
    effect,
    receiptId: z.uuid(),
    receiptNumber: z.number().int(),
    nextChargeAt: iso
});

/** Which of MP4's three period answers applies (B13a fila 10-bis). */
export const LateManualPaymentPeriodCaseSchema = z.enum([
    'WITHIN_PERIOD',
    'REIMPUTED',
    'C5_FALLBACK',
    'ORIGINAL_PERIOD'
]);

/** What happens to one listing when the S7 return's coverage comes back (PB4/PB5/PB7/PB9). */
export const LateManualPaymentListingOutcomeSchema = z.enum([
    'RETURNS',
    'NO_SLOT',
    'LOCATION_CONFLICT',
    'INCOMPLETE',
    'ARCHIVED_DRAFT',
    'PURGED',
    'MODERATED',
    'ALREADY_PUBLISHED',
    'LOWERED_BY_SURPLUS',
    'DRAFT'
]);

/** What the S7 return brings back for a partner. */
export const LateManualPaymentPartnerOutcomeSchema = z.enum([
    'GOLD_PAGE_RETURNS',
    'CAROUSEL_RETURNS',
    'REVOKED',
    'NO_PARTNER',
    'NO_PRESENCE'
]);

const publicationStatus = z.enum([
    'DRAFT',
    'PUBLISHED',
    'UNPUBLISHED_BY_BILLING',
    'ARCHIVED',
    'MODERATED',
    'PURGED'
]);

/** Fila 10-bis presence, per vertical: listings (a), Partner (b) or none. */
export const LateManualPaymentPresenceSchema = z.discriminatedUnion('kind', [
    z.strictObject({
        kind: z.literal('LISTINGS'),
        vertical: z.enum(['accommodation', 'venue', 'experience']),
        limit: z.number().int().nullable(),
        listings: z.array(
            z.strictObject({
                id: z.uuid(),
                name: z.string(),
                publicationStatus,
                outcome: LateManualPaymentListingOutcomeSchema
            })
        )
    }),
    z.strictObject({
        kind: z.literal('PARTNER'),
        partner: z.strictObject({ name: z.string(), slug: z.string() }).nullable(),
        outcome: LateManualPaymentPartnerOutcomeSchema
    }),
    z.strictObject({ kind: z.literal('NONE'), vertical: z.string().nullable() })
]);

/** The other three S7 effects (S33 complements, inherited Tourist VIP, overdue change). */
export const LateManualPaymentS7EffectsSchema = z.strictObject({
    complements: z.strictObject({ resumed: z.array(z.uuid()), skipped: z.array(z.uuid()) }),
    touristVip: z.strictObject({ cancels: z.boolean(), subscriptionIds: z.array(z.uuid()) }),
    scheduledChange: z.strictObject({ effectiveAt: iso }).nullable()
});

/** Read-only confirmation of MP4 (fila 10-bis, HOS-1640). */
export const LateManualPaymentPreviewResponseSchema = z.strictObject({
    subscriptionId: z.uuid(),
    manualPaymentId: z.uuid(),
    periodStart: iso,
    reimputedPeriodStart: iso.nullable(),
    nextChargeAt: iso,
    effect: z.enum(['S7', 'S19']),
    periodCase: LateManualPaymentPeriodCaseSchema,
    nextChargeOverdue: z.boolean(),
    vertical: z.string().nullable(),
    /** Null under S19: the succession close decides. */
    presence: LateManualPaymentPresenceSchema.nullable(),
    /** Null under S19. */
    s7Effects: LateManualPaymentS7EffectsSchema.nullable()
});

/** The MP4 confirmation as the admin reads it. */
export type LateManualPaymentPreviewResponse = z.infer<
    typeof LateManualPaymentPreviewResponseSchema
>;

/** Result of MP4. */
export const LateManualPaymentResponseSchema = z.strictObject({
    effect: z.enum(['S7', 'S19']),
    nextChargeAt: iso,
    periodStart: iso,
    reimputedFrom: iso.nullable(),
    receiptId: z.uuid().nullable()
});

/** Read-only confirmation of MP6. */
export const UnallocatedManualPaymentPreviewResponseSchema = z.strictObject({
    subscriptionId: z.uuid(),
    periodStart: iso,
    mark: z.enum(['COBRO_DUPLICADO', 'COBRO_POSTERIOR_A_LA_BAJA'])
});

/** Result of MP6. */
export const UnallocatedManualPaymentResponseSchema = z.strictObject({
    manualPaymentId: z.uuid(),
    periodStart: iso,
    markId: z.uuid(),
    mark: z.enum(['COBRO_DUPLICADO', 'COBRO_POSTERIOR_A_LA_BAJA']),
    outcome: z.enum(['OPENED', 'ACCUMULATED'])
});

/** Read-only confirmation of MP2. */
export const ManualUnpaidPreviewResponseSchema = z.strictObject({
    subscriptionId: z.uuid(),
    manualPaymentId: z.uuid(),
    periodStart: iso,
    effect: z.literal('S6')
});

/** Result of MP2. */
export const ManualUnpaidResponseSchema = z.strictObject({
    outcome: z.literal('SUSPENDED'),
    notice: z.enum(['SENT', 'FAILED', 'NO_RECIPIENT'])
});

/** One installment shown to billing administrators. */
export const ManualPaymentListItemSchema = z.strictObject({
    id: z.uuid(),
    periodStart: iso,
    status: z.enum(['AWAITING', 'REGISTERED', 'DECLARED_UNPAID']),
    registeredBy: z.uuid().nullable(),
    registeredAt: iso.nullable(),
    proofRef: z.string().nullable()
});

/** Installments belonging to the requested subscription. */
export const ManualPaymentListResponseSchema = z.array(ManualPaymentListItemSchema);

/** The MP4 result as the admin reads it. */
export type LateManualPaymentResponse = z.infer<typeof LateManualPaymentResponseSchema>;

/** One installment as the admin reads it. */
export type ManualPaymentListItem = z.infer<typeof ManualPaymentListItemSchema>;
