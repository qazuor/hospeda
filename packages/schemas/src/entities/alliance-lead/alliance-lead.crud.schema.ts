import { z } from 'zod';
import { refineHostTradeBenefit } from '../../common/host-trade-benefit.schema.js';
import type { HostTradeBenefitTypeEnum } from '../../enums/host-trade-benefit-type.enum.js';
import { AllianceLeadSchema, AllianceLeadStatusEnum } from './alliance-lead.schema.js';

/**
 * The kind whose application carries structured provider data (HOS-278 §6.4).
 *
 * Bound to the enum's literal so a typo cannot silently disable the whole
 * per-kind rule below — a bare `'provider'` string would compile, match no
 * lead, and let every provider application through with no category, no
 * destination and no benefit.
 */
const SERVICE_PROVIDER_KIND: z.infer<typeof AllianceLeadSchema.shape.kind> = 'service_provider';

/**
 * Bound to the enum's literal for the same reason as
 * {@link SERVICE_PROVIDER_KIND} — a typo here would silently disable the
 * `partner` requirement below and let every partner application through with
 * no `partnerType`.
 */
const PARTNER_KIND: z.infer<typeof AllianceLeadSchema.shape.kind> = 'partner';

/**
 * The fields a `service_provider` application must supply, each paired with its
 * error key.
 *
 * The keys are written as whole literals rather than built with a template,
 * because `scripts/extract-zod-keys.ts` finds translation keys by STATIC
 * analysis: an interpolated key is invisible to it, so it would never be
 * verified against the locales and would surface to a user as the raw key
 * string the first time a provider submitted an incomplete form.
 */
const REQUIRED_SERVICE_PROVIDER_FIELDS = [
    {
        field: 'businessName',
        message: 'zodError.allianceLead.businessName.requiredForServiceProvider'
    },
    { field: 'category', message: 'zodError.allianceLead.category.requiredForServiceProvider' },
    {
        field: 'destinationId',
        message: 'zodError.allianceLead.destinationId.requiredForServiceProvider'
    },
    {
        field: 'benefitType',
        message: 'zodError.allianceLead.benefitType.requiredForServiceProvider'
    }
] as const;

/**
 * The field a `partner` application must supply (HOS-278 §6.3/§7, provisioning
 * slice D) — mirrors {@link REQUIRED_SERVICE_PROVIDER_FIELDS}'s reasoning one
 * program over: `partners.type` is NOT NULL, so `partnerType` is required here
 * for the same reason `category` is required for `service_provider`.
 *
 * `businessName` deliberately stays OUT of this list even though it is now a
 * typed payload column for `partner` too (HOS-278 provisioning slice D form
 * work): this array only encodes what the BACKEND schema enforces, and that
 * asymmetry with `service_provider` (where `businessName` IS enforced here)
 * already existed before this change — extending it was not asked for.
 */
const REQUIRED_PARTNER_FIELDS = [
    { field: 'partnerType', message: 'zodError.allianceLead.partnerType.requiredForPartner' }
] as const;

/**
 * Per-kind requirement rule for an alliance lead submission.
 *
 * The provider/partner fields are nullable columns shared by four programs, so
 * the database cannot express "required, but only for one kind". This is where
 * that lives — and it is load-bearing rather than cosmetic: approving a
 * `service_provider` materializes a `host_trades` row whose `category`,
 * `destination_id` and benefit are NOT NULL, and a future `partner` approval
 * will materialize a `partners` row whose `type` is NOT NULL — so a lead
 * accepted without its kind's required field(s) cannot be approved later
 * without going back to the applicant.
 *
 * The benefit's own internal consistency (value required by numeric types,
 * rejected by the others) is delegated to {@link refineHostTradeBenefit} so the
 * rule is not restated here and cannot drift from the listing's copy of it —
 * `partner` has no equivalent cross-field rule to delegate to.
 */
export const refineAllianceLeadKindFields = (
    value: {
        readonly kind?: string;
        readonly businessName?: string | null;
        readonly partnerType?: string | null;
        readonly category?: string | null;
        readonly destinationId?: string | null;
        readonly benefitType?: HostTradeBenefitTypeEnum | null;
        readonly benefitValue?: number | null;
    },
    ctx: z.RefinementCtx
): void => {
    if (value.kind === SERVICE_PROVIDER_KIND) {
        for (const { field, message } of REQUIRED_SERVICE_PROVIDER_FIELDS) {
            const supplied = value[field];
            if (supplied === null || supplied === undefined) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
            }
        }

        refineHostTradeBenefit(value, ctx);
        return;
    }

    if (value.kind === PARTNER_KIND) {
        for (const { field, message } of REQUIRED_PARTNER_FIELDS) {
            const supplied = value[field];
            if (supplied === null || supplied === undefined) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
            }
        }
    }
};

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Input schema for submitting a new alliance lead (public "aliados" forms).
 *
 * Excludes system-managed fields: id, status, adminNote, the account link, and
 * all audit fields. Callers supply only the applicant-facing fields (`kind`,
 * `contactName`, `email`, `phone`, `message`).
 *
 * `applicantUserId`/`claimExpiresAt` are omitted deliberately (HOS-278 §6.2):
 * the account link is derived server-side from the authenticated actor or from
 * a redeemed claim token. Accepting either from the request body would let a
 * caller attach an application to an arbitrary account — exactly the R-1 attack
 * the "never resolve a lead by email" rule exists to prevent.
 */
export const AllianceLeadCreateInputSchema = AllianceLeadSchema.omit({
    id: true,
    status: true,
    adminNote: true,
    applicantUserId: true,
    claimExpiresAt: true,
    // What approval WROTE, never what a submission may assert: accepting it
    // from a request body would let a caller point their application at
    // somebody else's directory listing.
    provisionedHostTradeId: true,
    // Same reason, for the partner side: provisioning WROTE it, a submission
    // may never assert it.
    provisionedPartnerId: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/** TypeScript type for {@link AllianceLeadCreateInputSchema}. */
export type AllianceLeadCreateInput = z.infer<typeof AllianceLeadCreateInputSchema>;

/**
 * {@link AllianceLeadCreateInputSchema} with the per-kind requirement applied.
 *
 * Two schemas exist because they are consumed by machinery with different
 * needs. The plain object above stays a `ZodObject` so the HTTP layer can
 * `.extend()` it (the route adds a honeypot field) and so OpenAPI can generate
 * from it — neither works on the `ZodEffects` a `.superRefine()` produces. This
 * one is the schema that actually ENFORCES the rules.
 *
 * `AllianceLeadService.create` validates with this one, which makes the service
 * the choke point every submission passes through: a client that validates with
 * the plain object still gets rejected server-side. Client-side use is for the
 * error message, never for the guarantee.
 */
export const AllianceLeadSubmissionSchema = AllianceLeadCreateInputSchema.superRefine(
    refineAllianceLeadKindFields
);

/** TypeScript type for {@link AllianceLeadSubmissionSchema}. */
export type AllianceLeadSubmission = z.infer<typeof AllianceLeadSubmissionSchema>;

// ---------------------------------------------------------------------------
// Mark handled (admin only — approve/reject + note)
// ---------------------------------------------------------------------------

/**
 * Input schema for the admin "mark-handled" workflow action.
 *
 * An admin resolves a `pending`/`reviewing` lead by approving or rejecting it,
 * optionally attaching an internal note. Approving never auto-provisions any
 * role/entity (HOS-277 NG-1) — this schema only records the workflow decision.
 */
export const AllianceLeadMarkHandledSchema = z.object({
    /** Terminal status the admin is transitioning the lead to. */
    status: AllianceLeadStatusEnum.refine(
        (status) => status === 'approved' || status === 'rejected',
        {
            message: 'zodError.allianceLead.markHandled.status.invalid'
        }
    ),
    /** Optional internal note explaining the decision. */
    adminNote: z.string().max(1000, { message: 'zodError.allianceLead.adminNote.max' }).optional()
});

/** TypeScript type for {@link AllianceLeadMarkHandledSchema}. */
export type AllianceLeadMarkHandled = z.infer<typeof AllianceLeadMarkHandledSchema>;

// ---------------------------------------------------------------------------
// Admin update (generic — status transitions + annotation)
// ---------------------------------------------------------------------------

/**
 * Input schema for updating an alliance lead (admin workflow).
 *
 * Only the fields an admin can explicitly change are included: `status` and
 * `adminNote`. Applicant fields (contactName, email, etc.) are intentionally
 * excluded — the lead is an immutable record of the original submission.
 */
export const AllianceLeadAdminUpdateInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    status: AllianceLeadStatusEnum.optional(),
    adminNote: z.string().max(1000, { message: 'zodError.allianceLead.adminNote.max' }).optional()
});

/** TypeScript type for {@link AllianceLeadAdminUpdateInputSchema}. */
export type AllianceLeadAdminUpdateInput = z.infer<typeof AllianceLeadAdminUpdateInputSchema>;

// ---------------------------------------------------------------------------
// Claim (applicant redeeming an emailed confirmation token)
// ---------------------------------------------------------------------------

/**
 * Input schema for redeeming a claim invitation (HOS-278 AC-4).
 *
 * The token is the single-use secret from the invitation email. It is the ONLY
 * body field: the lead comes from the path, and the identity of the claimant
 * comes from the session — never from the request, which is the whole point of
 * R-1 (the lead's email is unverified, so nothing the caller sends may decide
 * whose account an application attaches to).
 */
export const AllianceLeadClaimInputSchema = z.object({
    /** UUID of the lead being claimed. */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** Single-use token from the claim invitation email. */
    token: z
        .string()
        .min(1, { message: 'zodError.allianceLead.claimToken.required' })
        .max(512, { message: 'zodError.allianceLead.claimToken.max' })
});

/** TypeScript type for {@link AllianceLeadClaimInputSchema}. */
export type AllianceLeadClaimInput = z.infer<typeof AllianceLeadClaimInputSchema>;

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Input schema for deleting an alliance lead (admin only).
 *
 * Soft-delete by default; `force: true` permanently removes the record.
 */
export const AllianceLeadDeleteInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    force: z.boolean().default(false)
});

/** TypeScript type for {@link AllianceLeadDeleteInputSchema}. */
export type AllianceLeadDeleteInput = z.infer<typeof AllianceLeadDeleteInputSchema>;
