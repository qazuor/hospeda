import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    HOST_TRADE_BENEFIT_TEXT_MAX,
    HostTradeBenefitValueSchema
} from '../../common/host-trade-benefit.schema.js';
import {
    DestinationIdSchema,
    HostTradeIdSchema,
    PartnerIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { HostTradeBenefitTypeEnumSchema } from '../../enums/host-trade-benefit-type.schema.js';
import { HostTradeCategoryEnumSchema } from '../../enums/host-trade-category.schema.js';
import { PartnerTypeEnumSchema } from '../../enums/partner-type.schema.js';

// ---------------------------------------------------------------------------
// Alliance Lead Schema
// ---------------------------------------------------------------------------

/**
 * Kind of alliance a lead is applying for.
 *
 * Closed set (unlike commerce leads' open `domain` string): the four alliance
 * programs are fully known and acotados, so a Zod enum is used instead of an
 * open string field (HOS-277 §7.1).
 *
 * - `partner` — tourism agencies / commerce partnerships.
 * - `sponsor` — brand sponsorship program.
 * - `editor` — content editor / collaborator program.
 * - `service_provider` — a prospective HostTrade directory entry.
 */
export const AllianceLeadKindEnum = z.enum(['partner', 'sponsor', 'editor', 'service_provider'], {
    message: 'zodError.allianceLead.kind.invalid'
});
export type AllianceLeadKind = z.infer<typeof AllianceLeadKindEnum>;

/**
 * Status enum for an alliance lead.
 * Mirrors the same workflow vocabulary as `CommerceLeadStatusEnum`:
 * submitted → reviewed → approved (admin provisions manually) or rejected.
 */
export const AllianceLeadStatusEnum = z.enum(['pending', 'reviewing', 'approved', 'rejected'], {
    message: 'zodError.allianceLead.status.invalid'
});
export type AllianceLeadStatus = z.infer<typeof AllianceLeadStatusEnum>;

/**
 * Alliance Lead Schema.
 *
 * A qualified lead submitted through one of the four "aliados" landing pages
 * (`partner`, `sponsor`, `editor`, `service_provider`). Kind-specific details are
 * serialized with labels into `message` by the submitting form (HOS-277 §7.3), so
 * the persisted contract stays generic — with ONE deliberate exception: the
 * `service_provider` fields (`category`, `destinationId`, `benefit*`) are typed
 * columns, because approving that kind provisions a `host_trades` row from them
 * and prose cannot be read as data (HOS-278 §6.4).
 *
 * That exception is also why HOS-277's NG-1 ("approval never auto-provisions")
 * no longer holds universally: approving a `service_provider` DOES create its
 * directory listing. For the other three kinds the admin still provisions by
 * hand, and `status` / `adminNote` remain the only fields mark-handled changes.
 *
 * @example
 * ```ts
 * const lead = AllianceLeadSchema.parse({
 *   id: 'some-uuid',
 *   kind: 'partner',
 *   contactName: 'Juan Pérez',
 *   email: 'juan@example.com',
 *   phone: '+54911234567',
 *   message: 'Nombre del negocio: Acme SA\n...',
 *   status: 'pending',
 *   adminNote: null,
 *   applicantUserId: null,
 *   claimExpiresAt: null,
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 *   createdById: null,
 *   updatedById: null,
 *   deletedAt: null,
 *   deletedById: null,
 * });
 * ```
 */
export const AllianceLeadSchema = z.object({
    /** Lead entity ID (UUID). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /**
     * Which alliance program this lead is applying for.
     * Closed enum — see {@link AllianceLeadKindEnum}.
     */
    kind: AllianceLeadKindEnum,

    /**
     * Name of the person to contact about this lead.
     */
    contactName: z
        .string()
        .min(2, { message: 'zodError.allianceLead.contactName.min' })
        .max(255, { message: 'zodError.allianceLead.contactName.max' }),

    /**
     * Contact email address for the lead applicant.
     */
    email: z
        .string()
        .email({ message: 'zodError.allianceLead.email.invalid' })
        .max(320, { message: 'zodError.allianceLead.email.max' }),

    /**
     * Contact phone number (optional; free-form to allow regional formats).
     */
    phone: z.string().max(50, { message: 'zodError.allianceLead.phone.max' }).nullish(),

    /**
     * Free-text message from the applicant. Includes both any free-form text
     * the applicant wrote and any kind-specific fields the form serialized
     * with labels (see HOS-277 §7.3, e.g. business name / website / portfolio
     * links) — there are no dedicated typed columns for those in V1 (NG-3).
     */
    message: z
        .string()
        .min(10, { message: 'zodError.allianceLead.message.min' })
        .max(2000, { message: 'zodError.allianceLead.message.max' }),

    /**
     * Current workflow status of the lead.
     * Defaults to `pending` on submission.
     */
    status: AllianceLeadStatusEnum.default('pending'),

    /**
     * Optional admin note attached when the lead is reviewed via mark-handled.
     */
    adminNote: z.string().max(1000, { message: 'zodError.allianceLead.adminNote.max' }).nullish(),

    /**
     * The account this application belongs to (HOS-278 §6.2).
     *
     * Null is the PRIMARY case, not an edge case: the four "aliados" forms are
     * public and most submissions arrive with no session. It is set when the
     * submitter is authenticated, when an account is created at approval, or
     * when the email's owner redeems a claim token.
     *
     * This field is the ONLY way a lead is resolved to a user. Never match by
     * {@link AllianceLeadSchema.shape.email} (HOS-278 R-1): the lead's email is
     * unverified, so an email match would let anyone attach an application — and
     * whatever benefits it carries — to someone else's account.
     */
    applicantUserId: UserIdSchema.nullish(),

    /**
     * When the pending claim invitation for this lead stops being redeemable
     * (7 days after it was issued — HOS-278 OQ-5). Null when no claim is
     * outstanding.
     *
     * The claim TOKEN itself is deliberately absent from this schema: this
     * schema doubles as the response allowlist for the admin leads inbox
     * (`responseSchema` strips every field it does not declare), and a
     * single-use secret proving ownership of an email address has no business
     * being serialized into a list response. It stays on the DB row only.
     */
    claimExpiresAt: z.coerce
        .date({ message: 'zodError.allianceLead.claimExpiresAt.invalid' })
        .nullish(),

    /**
     * Trading name of the applicant's business — becomes `host_trades.name`.
     *
     * Distinct from {@link AllianceLeadSchema.shape.contactName}, which names
     * the PERSON to talk to. Publishing the contact's name would put "Juan
     * Pérez" into a directory of plumbers and locksmiths.
     */
    businessName: z
        .string()
        .min(2, { message: 'zodError.allianceLead.businessName.min' })
        .max(255, { message: 'zodError.allianceLead.businessName.max' })
        .nullish(),

    /**
     * What kind of organization a `partner` applicant is (HOS-278 §6.3/§7,
     * provisioning slice D).
     *
     * Mirrors {@link AllianceLeadSchema.shape.category}'s reasoning one field
     * over: approving a `partner` will eventually provision a `partners` row,
     * and `partners.type` is NOT NULL — so this typed column exists for the
     * same reason `category`/`destinationId`/`benefit*` do for
     * `service_provider`, one program earlier in the pipeline (this slice
     * only collects the field; provisioning itself is a later spec).
     *
     * Distinct from `partnershipType`, which stays free-text prose serialized
     * into {@link AllianceLeadSchema.shape.message} by the submitting form —
     * that field is WHAT ALLIANCE the applicant is proposing (for an admin to
     * read and evaluate), while this one is WHAT KIND of organization they
     * are (the structured value that becomes `partners.type`).
     *
     * Nullish because the other three kinds never carry it. The per-kind
     * requirement is imposed by `refineAllianceLeadKindFields` on the create
     * input, not here — this schema also parses rows submitted before the
     * column existed, which legitimately have none.
     */
    partnerType: PartnerTypeEnumSchema.nullish(),

    /**
     * Service category the applicant operates in (HOS-278 §6.4).
     *
     * The next four fields are `service_provider`-only, and they exist because
     * approving that kind must materialize a `host_trades` row — a table whose
     * `category`, `destination_id` and benefit are NOT NULL. Under HOS-277's
     * NG-3 those answers were serialized into {@link message} as labelled
     * prose, which is unusable as data.
     *
     * Nullish at the field level because the other three kinds never carry
     * them. The per-kind requirement is imposed by
     * `refineAllianceLeadKindFields` on the create input, not here: this schema
     * also parses rows submitted before the columns existed, which legitimately
     * have none.
     */
    category: HostTradeCategoryEnumSchema.nullish(),

    /** Destination the applicant covers. Becomes `host_trades.destination_id`. */
    destinationId: DestinationIdSchema.nullish(),

    /** What the applicant offers hosts. See {@link category} for why it is nullish. */
    benefitType: HostTradeBenefitTypeEnumSchema.nullish(),

    /** Magnitude of the benefit, interpreted by {@link benefitType}. */
    benefitValue: HostTradeBenefitValueSchema.nullish(),

    /** Fine print accompanying the benefit. */
    benefitText: z
        .string()
        .max(HOST_TRADE_BENEFIT_TEXT_MAX, { message: 'zodError.hostTrade.benefitText.max' })
        .nullish(),

    /**
     * The directory listing this lead's approval produced, or null.
     *
     * System-managed and omitted from the create input: it is what approval
     * WROTE, never something a submission may assert. Accepting it from a
     * request body would let a caller point their application at somebody
     * else's listing.
     */
    provisionedHostTradeId: HostTradeIdSchema.nullish(),

    /**
     * The partner listing this lead's provisioning produced, or null.
     *
     * System-managed and omitted from the create input for exactly the reason
     * {@link provisionedHostTradeId} is: it records what an admin action WROTE,
     * so accepting it from a request body would let a caller point their
     * application at an organization that is not theirs.
     *
     * Unlike its host-trade sibling, this is NOT written by approval — a
     * partner lead is approved and provisioned by two separate admin actions
     * (HOS-278 §6.5 OQ-1), so an approved partner lead routinely has a null
     * here.
     */
    provisionedPartnerId: PartnerIdSchema.nullish(),

    // Audit fields (createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById)
    ...BaseAuditFields
});

/** TypeScript type inferred from {@link AllianceLeadSchema}. */
export type AllianceLead = z.infer<typeof AllianceLeadSchema>;
