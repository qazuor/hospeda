/**
 * alliance-lead.service.ts
 *
 * Stateless service for the alliance-leads lifecycle (HOS-277 §6.3 / §7).
 *
 * An "alliance lead" is a qualified applicant submitted through one of the
 * four "aliados" public landing pages (`partner`, `sponsor`, `editor`,
 * `service_provider`). It records the applicant's contact info + a
 * free-text message (kind-specific fields are serialized into `message` by
 * the submitting form, HOS-277 §7.3) so an admin can review and, if
 * approved, provision the corresponding role/entity BY HAND (HOS-277
 * NG-1 — approving never auto-provisions anything).
 *
 * ## Design decisions
 * - Extends `BaseService` (not `BaseCrudService`), mirroring
 *   `CommerceLeadService`: create is public, list/mark-handled are
 *   admin-only workflow actions rather than standard CRUD.
 * - Permission checks use `ALLIANCE_LEAD_*` `PermissionEnum` values only;
 *   no `RoleEnum` checks (HOS-277 §7.5).
 * - `createLead` deliberately does NOT set `createdById` on the inserted
 *   row: the submitting actor is anonymous/public (`createGuestActor()`),
 *   whose sentinel id is not a real `users` row, so writing it would violate
 *   the table's `created_by_id` → `users.id` FK. The column stays NULL for
 *   every public submission, same as `commerce_leads`' `createdById`-less
 *   design achieves by omitting the column entirely (`alliance_leads` keeps
 *   it, per HOS-277 §7.2's full BaseModel audit convention, but it is only
 *   ever populated for admin-driven mutations like `markHandled`).
 *
 * @module alliance-lead.service
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AllianceLeadModel, HostTradeModel, PartnerModel, type SelectAllianceLead } from '@repo/db';
import {
    type AllianceLead,
    AllianceLeadAdminListQuerySchema,
    AllianceLeadClaimInputSchema,
    type AllianceLeadCreateInput,
    type AllianceLeadKind,
    AllianceLeadMarkHandledSchema,
    AllianceLeadSubmissionSchema,
    type PartnerTierEnum,
    PartnerTierEnumSchema,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service';
import type {
    Actor,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';
import { withServiceTransaction } from '../../utils/transaction';
import {
    type ProvisionPartnerResult,
    provisionPartnerFromLead,
    resolvePartnerProvisionPlan
} from './alliance-lead.partner-provisioning';
import {
    provisionServiceProviderListing,
    resolveProvisionPlan
} from './alliance-lead.provisioning';

// ---------------------------------------------------------------------------
// Input types (RO-RO — every public method takes a single input object)
// ---------------------------------------------------------------------------

/** Input for {@link AllianceLeadService.createLead}. */
export interface CreateAllianceLeadInput {
    /** The actor submitting the lead (typically an anonymous/guest actor). */
    readonly actor: Actor;
    /** Lead creation payload (kind, contactName, email, phone?, message). */
    readonly input: AllianceLeadCreateInput;
}

/** Input for {@link AllianceLeadService.listForAdmin}. */
export interface ListAllianceLeadsForAdminInput {
    /** The admin actor requesting the list. */
    readonly actor: Actor;
    /** Optional kind/status filters + pagination. */
    readonly query: {
        readonly kind?: string;
        readonly status?: string;
        readonly page?: number;
        readonly pageSize?: number;
    };
}

/** Input for {@link AllianceLeadService.listMine}. */
export interface ListMyAllianceLeadsInput {
    /** The authenticated actor whose own applications are being listed. */
    readonly actor: Actor;
}

/** Input for {@link AllianceLeadService.claimLead}. */
export interface ClaimAllianceLeadInput {
    /** The authenticated actor claiming the application as their own. */
    readonly actor: Actor;
    /** UUID of the lead being claimed. */
    readonly id: string;
    /** The raw single-use token from the invitation email. */
    readonly token: string;
}

/**
 * Port for inviting the owner of an email address to claim an anonymous
 * application (HOS-278 §6.2).
 *
 * The service NEVER asks whether the address has an account — that question is
 * the one thing AC-3 forbids leaking, and keeping it entirely outside the
 * service means no branch in the request path can differ on the answer. The
 * port receives every anonymous submission and decides in silence whether
 * there is anyone to write to.
 *
 * Inject via the service constructor. Omitting it silences invitations (tests,
 * preview environments) without changing any other behaviour.
 */
export interface AllianceClaimInvitePort {
    /**
     * Delivers the claim invitation, if there is an account to deliver it to.
     *
     * Called fire-and-forget: its duration MUST NOT be observable in the
     * submission response (AC-3 covers the response TIME, not just its body).
     *
     * @param input - Recipient details and the raw, single-use token.
     */
    inviteToClaim: (input: {
        readonly leadId: string;
        readonly email: string;
        readonly contactName: string;
        readonly kind: AllianceLeadKind;
        /** The RAW token. Never logged, never persisted — the row holds a digest. */
        readonly token: string;
        readonly expiresAt: Date;
    }) => Promise<void>;
}

/**
 * Port for telling an applicant how their application was resolved
 * (HOS-278 AC-6).
 *
 * Injected rather than imported for the same reason as
 * {@link AllianceClaimInvitePort}: `@repo/service-core` has no business
 * knowing about an email transport. Omitting it silences the notification
 * (tests, preview environments) without changing the workflow transition.
 */
export interface AllianceDecisionNotifyPort {
    /**
     * Announces the decision to the applicant.
     *
     * Called fire-and-forget AFTER the status is already persisted: a mail
     * server having a bad afternoon must not roll back an admin's decision, and
     * an admin watching a spinner must not be waiting on Resend.
     *
     * @param input - Recipient details, the program, and which way it went.
     */
    notifyDecision: (input: {
        readonly leadId: string;
        readonly email: string;
        readonly contactName: string;
        readonly kind: AllianceLeadKind;
        readonly outcome: 'approved' | 'rejected';
    }) => Promise<void>;
}

/**
 * Port for telling OPERATIONS that a new application just arrived
 * (H-62 / H-148).
 *
 * Distinct from the two ports above, and the distinction is the whole point of
 * this one existing: {@link AllianceClaimInvitePort} writes to the APPLICANT
 * about linking an account, {@link AllianceDecisionNotifyPort} writes to the
 * APPLICANT about a verdict already reached. Neither tells the platform that
 * something arrived and is waiting. Nobody had modelled that at all, so every
 * "aliados" application depended on an operator opening the admin unprompted —
 * which is how eleven of them sat unread.
 *
 * Injected rather than imported for the same reason as its siblings:
 * `@repo/service-core` has no business knowing about an email transport.
 * Omitting it silences the alert (tests, preview environments) without
 * changing the submission.
 */
export interface AllianceLeadIntakeNotifyPort {
    /**
     * Announces the arrival to whoever handles leads.
     *
     * Called fire-and-forget AFTER the row is persisted: the alert is a
     * courtesy to the platform, and a mail server having a bad afternoon must
     * never cost an applicant their submission.
     *
     * Runs for EVERY submission, so its duration cannot vary with anything
     * about the applicant — in particular it cannot become the stopwatch that
     * AC-3 forbids for "does this address have an account?".
     *
     * @param input - The lead as persisted.
     */
    notifyNewLead: (input: { readonly lead: AllianceLead }) => Promise<void>;
}

/** Input for {@link AllianceLeadService.markHandled}. */
export interface MarkAllianceLeadHandledInput {
    /** The admin actor handling the lead. */
    readonly actor: Actor;
    /** UUID of the lead to handle. */
    readonly id: string;
    /** Terminal status + optional admin note. */
    readonly input: {
        readonly status: 'approved' | 'rejected';
        readonly adminNote?: string;
    };
}

/** Input for {@link AllianceLeadService.approveAndProvisionPartner}. */
export interface ApproveAndProvisionPartnerInput {
    /** The admin actor performing the action. */
    readonly actor: Actor;
    /** UUID of the `partner` lead to approve and provision. */
    readonly id: string;
    /** The tier to grant, plus an optional admin note. */
    readonly input: {
        readonly tier: PartnerTierEnum;
        readonly adminNote?: string;
    };
}

/** Result of {@link AllianceLeadService.approveAndProvisionPartner}. */
export interface ApproveAndProvisionPartnerOutput {
    /** The updated lead — `approved`, and linked to the partner when one exists. */
    readonly lead: AllianceLead;
    /**
     * The partner this lead points at, or null.
     *
     * Null only for a lead with no usable typed organization data, which is
     * approved without a partner and left for the admin to build by hand.
     */
    readonly partnerId: string | null;
    /** `true` when THIS call created the partner; `false` when it already existed. */
    readonly provisioned: boolean;
}

// ---------------------------------------------------------------------------
// Internal validation schemas
// ---------------------------------------------------------------------------

/** Validates the `{ id, status, adminNote? }` shape for `markHandled`. */
const markHandledInputSchema = AllianceLeadMarkHandledSchema.extend({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

/** Validates the `{ id, tier, adminNote? }` shape for partner provisioning. */
const approveAndProvisionPartnerInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    tier: PartnerTierEnumSchema,
    adminNote: z.string().max(1000, { message: 'zodError.allianceLead.adminNote.max' }).optional()
});

/** `listMine` takes no caller-supplied input — its only scope is the actor. */
const listMineInputSchema = z.object({});

/**
 * The `where` key that scopes a read to a single applicant.
 *
 * Typed against the table's row shape ON PURPOSE. `buildWhereClause` silently
 * DROPS a key the table does not have, so a typo (or a future column rename)
 * would not fail — it would quietly remove the ownership filter and turn
 * "my applications" into "everyone's". Binding the literal to
 * `keyof SelectAllianceLead` turns that runtime footgun into a build error.
 */
const APPLICANT_SCOPE_KEY: keyof SelectAllianceLead = 'applicantUserId';

/**
 * Upper bound on how many of an applicant's own leads a single `listMine` call
 * returns (newest first). A person applies to at most a handful of the four
 * programs; this is a sanity cap, not a paging contract.
 */
const MY_LEADS_MAX = 100;

/**
 * The slice of a model the claim needs in order to backfill an owner.
 *
 * Structural rather than a union of `HostTradeModel | PartnerModel`, because
 * both call sites want the SAME operation: the two differ only in which table
 * the id points at. Writing it twice would mean maintaining the read-then-write
 * reasoning below in two places, and letting them drift apart is precisely how
 * one of the two programs ends up silently losing the backfill.
 */
interface OwnableProvisionedModel {
    readonly findById: (
        id: string,
        tx?: DrizzleTransaction
    ) => Promise<{ readonly ownerUserId?: string | null } | null>;
    readonly update: (
        where: { readonly id: string },
        data: { readonly ownerUserId: string; readonly updatedById: string },
        tx?: DrizzleTransaction
    ) => Promise<unknown>;
}

/** The transaction handle the models accept, borrowed from one of them. */
type DrizzleTransaction = Parameters<HostTradeModel['findById']>[1];

/**
 * Fills an EMPTY owner on a row this lead provisioned, and only an empty one.
 *
 * Read-then-write, not a conditional UPDATE: Drizzle's `where` builder cannot
 * express "ownerUserId IS NULL" from a plain object (`eq(col, null)` renders
 * `= NULL`, which never matches). And the emptiness check is the whole point —
 * a row some other flow already attached to an account must never be moved by
 * a later claim.
 *
 * Emptiness is tested with LOOSE `== null`, deliberately. `ownerUserId` is
 * declared `.nullish()`, so its type admits `undefined` as well as `null`, and
 * a strict `=== null` would read an undefined owner as "already owned" and skip
 * the backfill — leaving the row ownerless forever, with the claim reporting
 * success. Same footgun that `revokedAt` has already sprung once in this
 * domain, in the opposite direction.
 *
 * @param input - The model to read/write through, the row id, the new owner, and
 *   the transaction to enlist in.
 */
const backfillProvisionedOwner = async ({
    model,
    id,
    ownerUserId,
    tx
}: {
    readonly model: OwnableProvisionedModel;
    readonly id: string;
    readonly ownerUserId: string;
    readonly tx?: DrizzleTransaction;
}): Promise<void> => {
    const row = await model.findById(id, tx);
    if (row && row.ownerUserId == null) {
        await model.update({ id }, { ownerUserId, updatedById: ownerUserId }, tx);
    }
};

// ---------------------------------------------------------------------------
// Claim token
// ---------------------------------------------------------------------------

/** How long a claim invitation stays redeemable (HOS-278 OQ-5). */
const CLAIM_TOKEN_TTL_DAYS = 7;

/** Bytes of entropy behind a claim token. */
const CLAIM_TOKEN_BYTES = 32;

/**
 * Mints a raw claim token. Returned to the caller ONCE, delivered by email,
 * and never persisted — {@link digestClaimToken} is what reaches the row.
 */
const generateClaimToken = (): string => randomBytes(CLAIM_TOKEN_BYTES).toString('base64url');

/**
 * Hashes a claim token for storage.
 *
 * The column holds this digest, not the token. A claim token is a bearer
 * secret: anyone holding it can attach an application to the account that owns
 * the address, so a database dump (or a stray log line reading the row) must
 * not hand that power over. Plain SHA-256 with no salt is the right tool here
 * and a password KDF is not — the input is 32 bytes of CSPRNG output, so there
 * is no dictionary to slow down, and equality lookup must stay cheap.
 */
const digestClaimToken = (token: string): string =>
    createHash('sha256').update(token, 'utf8').digest('hex');

/**
 * Compares a candidate token against a stored digest without leaking, through
 * timing, how many leading characters matched.
 *
 * Both sides are hex digests of fixed length, so `timingSafeEqual` never sees
 * mismatched buffer lengths — but the length check stays as a guard for a
 * malformed stored value rather than letting the comparison throw.
 */
const claimTokenMatches = (candidate: string, storedDigest: string): boolean => {
    const candidateDigest = Buffer.from(digestClaimToken(candidate), 'utf8');
    const stored = Buffer.from(storedDigest, 'utf8');
    if (candidateDigest.length !== stored.length) {
        return false;
    }
    return timingSafeEqual(candidateDigest, stored);
};

/**
 * Normalises an email for the "is this the account owner" comparison.
 *
 * Case only — no dot-stripping or plus-tag removal. Those are provider-specific
 * conventions, and treating `a.b@gmail.com` as `ab@gmail.com` on a provider
 * that considers them distinct would let one mailbox claim another's
 * application.
 */
const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Presents a persisted row as the service-level entity.
 *
 * The two types genuinely differ and neither is wrong: `SelectAllianceLead`
 * carries `kind`/`status` as the varchar the column actually is, plus
 * `claimToken`, which `AllianceLeadSchema` deliberately does not declare
 * (that schema doubles as the admin list's response allowlist, and a bearer
 * secret has no business being serialized there). So there is no assignability
 * between them in either direction, and the alternative to this one cast is
 * `AllianceLeadSchema.parse` on every read — runtime validation, and a throw,
 * on rows this service just wrote itself.
 *
 * Funnelled through a single function rather than repeated at each call site so
 * the gap is asserted in one place instead of three.
 */
// TYPE-WORKAROUND: the DB row types kind/status as varchar and carries claimToken, which the entity schema deliberately omits — no assignability exists in either direction.
const toAllianceLead = (row: SelectAllianceLead): AllianceLead => row as unknown as AllianceLead;

// ---------------------------------------------------------------------------
// Actor helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the account an incoming submission belongs to (HOS-278 AC-1).
 *
 * Identity is read from the ROLE SET, never from the actor's id: the guest
 * actor's id is a sentinel UUID with no `users` row behind it, so writing it
 * into `applicant_user_id` would violate the column's FK. `createGuestActor()`
 * produces exactly `[GUEST]` and no real account is ever granted that hat
 * (see `actorMiddleware`'s `isGuestOnly`), which makes "holds only GUEST" the
 * canonical anonymity test.
 *
 * A degenerate actor with NO roles is treated as anonymous too. Fail-safe is
 * the whole point: an unlinked application is merely unlinked, while a wrongly
 * linked one hands someone else's account whatever the application carries.
 *
 * @param actor - The actor submitting the lead.
 * @returns The applicant's user id, or `null` for an anonymous submission.
 */
const resolveApplicantUserId = (actor: Actor): string | null => {
    const isAnonymous =
        actor.roles.length === 0 || actor.roles.every((role) => role === RoleEnum.GUEST);
    return isAnonymous ? null : actor.id;
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Manages the alliance-lead lifecycle: public submission, admin listing,
 * and admin approve/reject.
 *
 * ## Public surface
 * - `createLead({ actor, input })` — submit a new lead (public, no permission
 *   gate — corresponds to one of the 4 "aliados" landing forms).
 * - `listMine({ actor })` — the caller's OWN applications (authenticated, no
 *   permission gate; `[]` when there are none).
 * - `claimLead({ actor, id, token })` — redeem an emailed claim token to link
 *   an anonymous application to the calling account.
 * - `listForAdmin({ actor, query })` — list leads with optional kind/status
 *   filters (admin, requires `ALLIANCE_LEAD_VIEW_ALL`).
 * - `markHandled({ actor, id, input })` — approve or reject a lead (admin,
 *   requires `ALLIANCE_LEAD_MANAGE`). NEVER auto-provisions any role/entity
 *   (HOS-277 NG-1) — it only records the workflow decision.
 *
 * @example
 * ```ts
 * const service = new AllianceLeadService({ logger });
 *
 * // From a public route handler:
 * const result = await service.createLead({
 *   actor: createGuestActor(),
 *   input: {
 *     kind: 'partner',
 *     contactName: 'Juan Pérez',
 *     email: 'juan@example.com',
 *     phone: '+54911234567',
 *     message: 'Nombre del negocio: Acme SA\n...',
 *   },
 * });
 * ```
 */
export class AllianceLeadService extends BaseService {
    private readonly _model: AllianceLeadModel;
    private readonly _hostTradeModel: HostTradeModel;
    private readonly _partnerModel: PartnerModel;
    private readonly _claimInviter: AllianceClaimInvitePort | null;
    private readonly _decisionNotifier: AllianceDecisionNotifyPort | null;
    private readonly _intakeNotifier: AllianceLeadIntakeNotifyPort | null;

    constructor(
        config: ServiceConfig,
        claimInviter?: AllianceClaimInvitePort | null,
        decisionNotifier?: AllianceDecisionNotifyPort | null,
        intakeNotifier?: AllianceLeadIntakeNotifyPort | null
    ) {
        super(config, 'allianceLead');
        this._model = new AllianceLeadModel();
        // The MODEL, not HostTradeService: provisioning is an effect of
        // ALLIANCE_LEAD_MANAGE, and going through the service would additionally
        // demand HOST_TRADE_CREATE from an admin whose permission to approve
        // this lead is not in question.
        this._hostTradeModel = new HostTradeModel();
        // Same reasoning as `_hostTradeModel` above: provisioning is an effect
        // of ALLIANCE_LEAD_MANAGE, and going through PartnerService would
        // additionally demand PARTNER_MANAGE from an admin whose permission to
        // handle this lead is not in question.
        this._partnerModel = new PartnerModel();
        this._claimInviter = claimInviter ?? null;
        this._decisionNotifier = decisionNotifier ?? null;
        this._intakeNotifier = intakeNotifier ?? null;
    }

    // -----------------------------------------------------------------------
    // createLead — public (no permission gate)
    // -----------------------------------------------------------------------

    /**
     * Submits a new alliance lead.
     *
     * No permission check is applied — this corresponds to one of the four
     * public "aliados" landing forms. `status` defaults to `pending` (set by
     * the DB column default / schema default); `createdById` is intentionally
     * left unset (see class-level doc).
     *
     * When the submitter is authenticated, the lead is linked to their account
     * on the spot via `applicantUserId` (HOS-278 AC-1). An anonymous submission
     * stays unlinked (AC-2) — it is NEVER resolved to an account by matching
     * `email` (R-1), since the submitted email is unverified. Linking an
     * anonymous lead whose email already has an owner requires that owner to
     * redeem a claim token (AC-4).
     *
     * @param params - `{ actor, input }`.
     * @param ctx - Optional service execution context.
     * @returns `ServiceOutput<AllianceLead>` wrapping the created lead.
     */
    public async createLead(
        params: CreateAllianceLeadInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AllianceLead>> {
        const { actor, input } = params;
        return this.runWithLoggingAndValidation({
            methodName: 'createLead',
            input: { actor, ...input },
            // The SUBMISSION schema, not the plain create-input object: it is
            // the one carrying the per-kind requirement (a `service_provider`
            // must declare category, destination and benefit). The HTTP layer
            // validates against the plain object because OpenAPI and `.extend()`
            // cannot consume a refined schema, which makes this the only place
            // the rule is actually enforced for every caller.
            schema: AllianceLeadSubmissionSchema,
            ctx,
            execute: async (validated, a, execCtx) => {
                // The account link is derived from the ACTOR, never from the
                // request body: `AllianceLeadCreateInputSchema` omits
                // `applicantUserId` precisely so a caller cannot name the
                // account their application hangs off.
                const applicantUserId = resolveApplicantUserId(a);

                // An anonymous submission ALWAYS mints a claim token, whether or
                // not the address turns out to have an account behind it. The
                // work is unconditional on purpose: the moment the amount of
                // work depends on that answer, the response time answers it
                // (AC-3).
                const claim =
                    applicantUserId === null
                        ? {
                              token: generateClaimToken(),
                              expiresAt: new Date(
                                  Date.now() + CLAIM_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
                              )
                          }
                        : null;

                const lead = toAllianceLead(
                    await this._model.create(
                        {
                            ...(validated as Partial<SelectAllianceLead>),
                            applicantUserId,
                            // The row stores the DIGEST. The raw token exists
                            // only in this closure and in the email that
                            // carries it.
                            claimToken: claim === null ? null : digestClaimToken(claim.token),
                            claimExpiresAt: claim?.expiresAt ?? null
                        },
                        execCtx?.tx
                    )
                );

                if (claim !== null && this._claimInviter !== null) {
                    // Deliberately NOT awaited. Delivery takes a network
                    // round-trip and only happens when the address has an
                    // owner, so awaiting it would turn "does this email have an
                    // account?" into a stopwatch reading (AC-3). Failures are
                    // swallowed into the log: an undelivered invitation leaves
                    // the lead unlinked, which is the same safe state as never
                    // having issued one.
                    void this._claimInviter
                        .inviteToClaim({
                            leadId: lead.id,
                            email: lead.email,
                            contactName: lead.contactName,
                            kind: lead.kind,
                            token: claim.token,
                            expiresAt: claim.expiresAt
                        })
                        .catch((error: unknown) => {
                            this.logger.error(
                                {
                                    leadId: lead.id,
                                    error: error instanceof Error ? error.message : String(error)
                                },
                                '[alliance-lead] claim invitation failed to send'
                            );
                        });
                }

                if (this._intakeNotifier === null) {
                    this.logger.warn(
                        { leadId: lead.id },
                        '[alliance-lead] no intake notifier configured; nobody was told about this lead'
                    );
                } else {
                    // Unconditional and not awaited: every submission gets the
                    // same work, so nothing about the applicant can be read off
                    // the response time (AC-3), and a failing mail server never
                    // costs an applicant their submission. A failure here is
                    // logged at ERROR and left for the backstop cron, which
                    // finds the lead through its null `opsNotifiedAt`.
                    void this._intakeNotifier.notifyNewLead({ lead }).catch((error: unknown) => {
                        this.logger.error(
                            {
                                leadId: lead.id,
                                error: error instanceof Error ? error.message : String(error)
                            },
                            '[alliance-lead] ops intake alert failed to send'
                        );
                    });
                }

                return lead;
            }
        });
    }

    // -----------------------------------------------------------------------
    // listMine — authenticated caller, own applications only
    // -----------------------------------------------------------------------

    /**
     * Lists the calling user's OWN alliance applications, newest first
     * (HOS-278 AC-5).
     *
     * No permission gate, deliberately: the read is scoped to the actor's own
     * `applicantUserId`, so there is nothing an elevated permission could
     * unlock. Requiring one would turn a self-service read into an accidental
     * gate — the same reasoning as `CommerceLeadService.getMyLead`.
     *
     * Having no applications is the COMMON case (`/mi-cuenta/aliados` is a
     * discovery hub most visitors reach without ever having applied), so it
     * returns `[]` — never `NOT_FOUND`, never `FORBIDDEN`.
     *
     * An actor with no real identity short-circuits to `[]` BEFORE any query
     * runs. That guard is load-bearing: the alternative is a `where` whose
     * ownership filter is `null`, which reads as "every unlinked lead" rather
     * than "nothing".
     *
     * @param params - `{ actor }`.
     * @param ctx - Optional service execution context.
     * @returns `ServiceOutput<AllianceLead[]>` — the caller's own leads.
     */
    public async listMine(
        params: ListMyAllianceLeadsInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AllianceLead[]>> {
        const { actor } = params;
        return this.runWithLoggingAndValidation({
            methodName: 'listMine',
            input: { actor },
            schema: listMineInputSchema,
            ctx,
            execute: async (_validated, a, execCtx) => {
                const applicantUserId = resolveApplicantUserId(a);
                if (applicantUserId === null) {
                    return [];
                }

                const result = await this._model.findAll(
                    { deletedAt: null, [APPLICANT_SCOPE_KEY]: applicantUserId },
                    {
                        page: 1,
                        pageSize: MY_LEADS_MAX,
                        sortBy: 'createdAt',
                        sortOrder: 'desc'
                    },
                    undefined,
                    execCtx?.tx
                );
                return result.items as AllianceLead[];
            }
        });
    }

    // -----------------------------------------------------------------------
    // claimLead — authenticated caller redeeming an emailed claim token
    // -----------------------------------------------------------------------

    /**
     * Links an anonymous application to the calling account by redeeming the
     * single-use token from its invitation email (HOS-278 AC-4).
     *
     * Three independent conditions must ALL hold, and none of them is the
     * lead's email on its own (R-1 — that address is unverified):
     *
     * 1. **The token matches.** Compared as digests, in constant time, so a
     *    caller cannot walk the secret out one character at a time.
     * 2. **It has not expired.** 7 days (OQ-5).
     * 3. **The caller's account owns the address the invitation went to.** The
     *    token proves someone read that mailbox; this proves the redeemer IS
     *    that account rather than someone the link was forwarded to. Together
     *    they are what "the owner confirmed" means — the email is a second
     *    factor here, never the resolution path.
     *
     * Every failure answers the SAME `NOT_FOUND`. Distinguishing "wrong token"
     * from "expired" from "not your address" would turn this endpoint into an
     * oracle for whether a given lead id exists and who it belongs to.
     *
     * Redeeming clears the token, so a second redemption of the same link
     * fails — except by the account that already holds the lead, which is
     * answered idempotently (a double-clicked email must not look broken).
     *
     * When the lead was approved BEFORE it was claimed (the normal ordering,
     * since an admin and the recipient act independently), its provisioned
     * `host_trades` listing was created with `ownerUserId: null` — see
     * {@link provisionServiceProviderListing}. This redemption is the moment
     * ownership can finally be established, so it also backfills the
     * listing's owner, in the same transaction as the link itself.
     *
     * @param params - `{ actor, id, token }`.
     * @param ctx - Optional service execution context.
     * @returns `ServiceOutput<AllianceLead>` wrapping the now-linked lead.
     * @throws `NOT_FOUND` for every rejected claim, whatever the reason.
     */
    public async claimLead(
        params: ClaimAllianceLeadInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AllianceLead>> {
        const { actor, id, token } = params;
        return this.runWithLoggingAndValidation({
            methodName: 'claimLead',
            input: { actor, id, token },
            schema: AllianceLeadClaimInputSchema,
            ctx,
            execute: async (validated, a, execCtx) => {
                const rejected = new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'This confirmation link is not valid'
                );

                const actorUserId = resolveApplicantUserId(a);
                const actorEmail = a.email;
                if (actorUserId === null || actorEmail === undefined) {
                    throw rejected;
                }

                const existing = (await this._model.findById(
                    validated.id,
                    execCtx?.tx
                )) as SelectAllianceLead | null;

                if (!existing || existing.deletedAt !== null) {
                    throw rejected;
                }

                // Already linked. Same account → idempotent success (the
                // recipient clicked twice). Anyone else → indistinguishable
                // from a bad token.
                if (existing.applicantUserId !== null) {
                    if (existing.applicantUserId === actorUserId) {
                        return toAllianceLead(existing);
                    }
                    throw rejected;
                }

                if (existing.claimToken === null || existing.claimExpiresAt === null) {
                    throw rejected;
                }

                if (existing.claimExpiresAt.getTime() <= Date.now()) {
                    throw rejected;
                }

                if (normalizeEmail(existing.email) !== normalizeEmail(actorEmail)) {
                    throw rejected;
                }

                if (!claimTokenMatches(validated.token, existing.claimToken)) {
                    throw rejected;
                }

                // Linking the lead and backfilling its provisioned listing's
                // owner must land together. `provisionServiceProviderListing`
                // writes `ownerUserId: lead.applicantUserId` at APPROVAL time
                // (`alliance-lead.provisioning.ts`), which is `null` for an
                // anonymous submission whose email already had an account —
                // the listing has no owner until THIS moment, when the
                // recipient proves ownership of the address. Without this
                // backfill the listing stays ownerless forever: nothing else
                // in the codebase ever writes `host_trades.ownerUserId`.
                //
                // The boundary is opened here only when the caller did not
                // already supply one — nesting would create an INDEPENDENT
                // transaction (this package's `withServiceTransaction` does
                // not use savepoints), which is exactly the atomicity a linked
                // lead whose listing stayed ownerless would break.
                const applyClaim = async (
                    txCtx: ServiceContext | undefined
                ): Promise<SelectAllianceLead> => {
                    const updated = await this._model.update(
                        { id: validated.id },
                        {
                            applicantUserId: actorUserId,
                            // Single use: burn both halves so the same link
                            // cannot be replayed, and so no digest outlives
                            // its purpose.
                            claimToken: null,
                            claimExpiresAt: null
                        },
                        txCtx?.tx
                    );

                    // `update` answers null when the row is gone — it existed
                    // a few lines ago, so this is a row deleted mid-request.
                    // Nothing was linked, so it answers like every other
                    // rejected claim rather than surfacing a distinct "it
                    // vanished" the caller could learn something from.
                    if (!updated) {
                        throw rejected;
                    }

                    if (existing.provisionedHostTradeId) {
                        await backfillProvisionedOwner({
                            model: this._hostTradeModel,
                            id: existing.provisionedHostTradeId,
                            ownerUserId: actorUserId,
                            tx: txCtx?.tx
                        });
                    }

                    // The partner side of the same story. A `partner` lead is
                    // provisioned by a separate admin action (§6.5 OQ-1) that
                    // copies `lead.applicantUserId` into `partners.ownerUserId`
                    // — null whenever the application arrived anonymously. This
                    // is the moment that null can finally be resolved, and
                    // nothing else in the codebase ever writes that column.
                    //
                    // Both links are checked because ONE LEAD CAN CARRY BOTH:
                    // the columns are independent, so an `else if` here would
                    // silently drop whichever backfill lost the coin toss.
                    if (existing.provisionedPartnerId) {
                        await backfillProvisionedOwner({
                            model: this._partnerModel,
                            id: existing.provisionedPartnerId,
                            ownerUserId: actorUserId,
                            tx: txCtx?.tx
                        });
                    }

                    return updated as SelectAllianceLead;
                };

                // A boundary is opened ONLY when a backfill is actually
                // coming — same discipline as `markHandled`'s provisioning
                // decision. Every other claim is a single UPDATE, and wrapping
                // that in a transaction it does not need would be the same
                // regression this file's own review already ruled out once.
                // Truthiness, matching the guards inside `applyClaim`: the two
                // must agree, or a lead whose link column is absent rather than
                // null opens a transaction for a backfill that never runs —
                // and, in the other direction, a partner-only lead would run
                // its backfill OUTSIDE the boundary, leaving the linked lead
                // and the ownerless partner able to disagree after a failure.
                const willBackfillOwner = Boolean(
                    existing.provisionedHostTradeId || existing.provisionedPartnerId
                );

                const updated = execCtx?.tx
                    ? await applyClaim(execCtx)
                    : willBackfillOwner
                      ? await withServiceTransaction(applyClaim)
                      : await applyClaim(undefined);

                return toAllianceLead(updated);
            }
        });
    }

    // -----------------------------------------------------------------------
    // listForAdmin — admin (requires ALLIANCE_LEAD_VIEW_ALL)
    // -----------------------------------------------------------------------

    /**
     * Lists alliance leads with optional kind/status filters (admin inbox).
     *
     * Requires `ALLIANCE_LEAD_VIEW_ALL`.
     *
     * @param params - `{ actor, query }`.
     * @param ctx - Optional service execution context.
     * @returns `ServiceOutput<PaginatedListOutput<AllianceLead>>`.
     */
    public async listForAdmin(
        params: ListAllianceLeadsForAdminInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PaginatedListOutput<AllianceLead>>> {
        const { actor, query } = params;
        return this.runWithLoggingAndValidation({
            methodName: 'listForAdmin',
            input: { actor, ...query },
            schema: AllianceLeadAdminListQuerySchema,
            ctx,
            execute: async (validated, a, execCtx) => {
                if (!hasPermission(a, PermissionEnum.ALLIANCE_LEAD_VIEW_ALL)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: ALLIANCE_LEAD_VIEW_ALL required to list alliance leads'
                    );
                }

                const { kind, status, page, pageSize } = validated;
                const where: Record<string, unknown> = { deletedAt: null };
                if (kind !== undefined) where.kind = kind;
                if (status !== undefined) where.status = status;

                const result = await this._model.findAll(
                    where,
                    { page, pageSize },
                    undefined,
                    execCtx?.tx
                );
                return result as PaginatedListOutput<AllianceLead>;
            }
        });
    }

    // -----------------------------------------------------------------------
    // markHandled — admin (requires ALLIANCE_LEAD_MANAGE)
    // -----------------------------------------------------------------------

    /**
     * Approves or rejects an alliance lead (admin workflow transition).
     *
     * Requires `ALLIANCE_LEAD_MANAGE`. Sets:
     * - `status` → `'approved'` or `'rejected'`
     * - `adminNote` → optional note
     * - `updatedById` → the acting admin's id
     *
     * Approving a `service_provider` ALSO provisions its `host_trades`
     * directory listing, in the same transaction (HOS-278 §6.4) — this is the
     * one place HOS-277's NG-1 no longer holds. Partner, sponsor and editor are
     * still provisioned by hand, as are provider leads submitted before the
     * typed provider columns existed (see
     * {@link provisionServiceProviderListing} for why those degrade rather than
     * fail).
     *
     * Approving an unclaimed `service_provider` lead ALSO mints a fresh claim
     * token and, when a {@link AllianceClaimInvitePort} is injected, sends the
     * invite unconditionally — regardless of whether the address already has
     * an account (HOS-599). Without this, the listing above is provisioned
     * ownerless and stays that way forever: nothing else ever invites the
     * applicant to redeem the token `createLead` silently withheld from them.
     *
     * @param params - `{ actor, id, input }`.
     * @param ctx - Optional service execution context.
     * @returns `ServiceOutput<AllianceLead>` wrapping the updated lead.
     * @throws `NOT_FOUND` when the lead does not exist.
     */
    public async markHandled(
        params: MarkAllianceLeadHandledInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<AllianceLead>> {
        const { actor, id, input } = params;
        return this.runWithLoggingAndValidation({
            methodName: 'markHandled',
            input: { actor, id, ...input },
            schema: markHandledInputSchema,
            ctx,
            execute: async (validated, a, execCtx) => {
                if (!hasPermission(a, PermissionEnum.ALLIANCE_LEAD_MANAGE)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: ALLIANCE_LEAD_MANAGE required to handle alliance leads'
                    );
                }

                const existing = await this._model.findById(validated.id, execCtx?.tx);
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Alliance lead not found: ${validated.id}`
                    );
                }

                // A boundary is opened ONLY when a listing is actually coming.
                // Rejections, and approvals of the other three programs, are a
                // single UPDATE — wrapping those would make a method that needs
                // no database connection demand one, which is precisely what
                // broke every mocked unit test of this method when it did.
                const willProvision =
                    validated.status === 'approved' &&
                    resolveProvisionPlan(existing).kind === 'provision';

                // HOS-599: a `service_provider` approval provisions its
                // `host_trades` listing with `ownerUserId: null` whenever the
                // lead arrived anonymously — which is the ordinary case, per
                // HOS-647. The listing then stays ownerless until the
                // applicant redeems a claim token via `claimLead`, so approval
                // is also the moment a fresh invite must go out.
                //
                // Unlike `createLead`'s claim invite — gated on the address
                // already having an account, because AC-3 forbids leaking
                // account existence to an anonymous, unauthenticated caller —
                // this fires UNCONDITIONALLY. There is nothing left to protect:
                // an admin already reviewed and approved this specific lead, so
                // sending regardless of account existence discloses nothing a
                // stranger could probe for.
                //
                // Also covers the retry case: re-approving an idempotent,
                // already-provisioned lead that is STILL unclaimed re-issues
                // the invite — exactly the recovery path this fix needed for
                // every lead whose first attempt silently never sent one.
                const needsClaimInvite =
                    validated.status === 'approved' &&
                    existing.kind === 'service_provider' &&
                    existing.applicantUserId === null &&
                    (willProvision || existing.provisionedHostTradeId !== null);

                // The RAW token minted by `createLead` never survives past its
                // own closure — only its digest reaches the row — so there is
                // no original token to resend here. A fresh one is minted
                // instead. This supersedes any still-valid token from the
                // original submission, which is the correct outcome: the email
                // about to go out is the current, authoritative one.
                const freshClaim = needsClaimInvite
                    ? {
                          token: generateClaimToken(),
                          expiresAt: new Date(
                              Date.now() + CLAIM_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
                          )
                      }
                    : null;

                // Provisioning and the status change must land together. A lead
                // marked `approved` with no listing is the inconsistent state
                // this whole slice exists to remove, and an orphan listing whose
                // lead is still pending would be provisioned AGAIN on the retry,
                // because the link that makes approval idempotent is written by
                // the very update that failed.
                //
                // The boundary is opened here only when the caller did not
                // already supply one — nesting would create an INDEPENDENT
                // transaction (this package's `withServiceTransaction` does not
                // use savepoints), which is exactly the atomicity we are buying.
                const applyDecision = async (
                    txCtx: ServiceContext | undefined
                ): Promise<SelectAllianceLead> => {
                    const provisioning =
                        validated.status === 'approved'
                            ? await provisionServiceProviderListing({
                                  lead: existing,
                                  hostTradeModel: this._hostTradeModel,
                                  actorId: a.id,
                                  logger: this.logger,
                                  tx: txCtx?.tx
                              })
                            : null;

                    // TYPE-WORKAROUND: `claimToken` is deliberately absent from
                    // the `AllianceLead` entity schema — it doubles as the
                    // admin list response allowlist, and a single-use secret has
                    // no business being serialized there — but it IS a real
                    // column on the DB row, same gap `createLead` casts around.
                    const updatePayload: Partial<AllianceLead> &
                        Partial<Pick<SelectAllianceLead, 'claimToken'>> = {
                        status: validated.status,
                        updatedById: a.id,
                        ...(validated.adminNote === undefined
                            ? {}
                            : { adminNote: validated.adminNote }),
                        ...(provisioning?.provisioned
                            ? { provisionedHostTradeId: provisioning.hostTradeId }
                            : {}),
                        ...(freshClaim
                            ? {
                                  claimToken: digestClaimToken(freshClaim.token),
                                  claimExpiresAt: freshClaim.expiresAt
                              }
                            : {})
                    };

                    const row = await this._model.update(
                        { id: validated.id },
                        updatePayload,
                        txCtx?.tx
                    );

                    // Same reasoning as `update` in `claimLead`: null means the
                    // row went away mid-request. Throwing here also rolls back
                    // any listing this call just created, which is the point of
                    // doing both inside one boundary.
                    if (!row) {
                        throw new ServiceError(
                            ServiceErrorCode.NOT_FOUND,
                            `Alliance lead not found: ${validated.id}`
                        );
                    }

                    return row as SelectAllianceLead;
                };

                const updated = execCtx?.tx
                    ? await applyDecision(execCtx)
                    : willProvision
                      ? await withServiceTransaction(applyDecision)
                      : await applyDecision(undefined);

                const lead = toAllianceLead(updated);

                if (this._decisionNotifier !== null) {
                    // AFTER the write, and deliberately NOT awaited. The status
                    // change is the durable outcome; the email is a courtesy on
                    // top of it. Awaiting would let a slow mail transport hold
                    // an admin's UI open, and throwing would surface a delivery
                    // problem as a failed decision the admin would then retry —
                    // re-sending, never re-deciding.
                    void this._decisionNotifier
                        .notifyDecision({
                            leadId: lead.id,
                            email: lead.email,
                            contactName: lead.contactName,
                            kind: lead.kind,
                            outcome: validated.status
                        })
                        .catch((error: unknown) => {
                            this.logger.error(
                                {
                                    leadId: lead.id,
                                    outcome: validated.status,
                                    error: error instanceof Error ? error.message : String(error)
                                },
                                '[alliance-lead] decision notification failed to send'
                            );
                        });
                }

                if (freshClaim !== null && this._claimInviter !== null) {
                    // Same fire-and-forget reasoning as the decision notifier
                    // above and as `createLead`'s own invite: a slow mail
                    // transport must not hold the admin's approval request
                    // open, and a delivery failure must not surface as a
                    // failed approval the admin would then retry.
                    void this._claimInviter
                        .inviteToClaim({
                            leadId: lead.id,
                            email: lead.email,
                            contactName: lead.contactName,
                            kind: lead.kind,
                            token: freshClaim.token,
                            expiresAt: freshClaim.expiresAt
                        })
                        .catch((error: unknown) => {
                            this.logger.error(
                                {
                                    leadId: lead.id,
                                    error: error instanceof Error ? error.message : String(error)
                                },
                                '[alliance-lead] claim invitation failed to send at approval'
                            );
                        });
                }

                return lead;
            }
        });
    }

    // -----------------------------------------------------------------------
    // approveAndProvisionPartner — admin (requires ALLIANCE_LEAD_MANAGE)
    // -----------------------------------------------------------------------

    /**
     * Approves a `partner` lead AND provisions its `partners` row in one action.
     *
     * A SEPARATE entry point from {@link markHandled}, not a branch inside it
     * (HOS-278 §6.5 OQ-1). Approving a partner lead through `markHandled`
     * still provisions nothing — that path remains available for an admin who
     * wants to accept the application without standing up an organization yet,
     * and it is what every pre-existing partner approval already did. Folding
     * provisioning into `markHandled` would have changed the meaning of a
     * button admins already use.
     *
     * The tier is taken from the ADMIN, not the lead: it is a commercial
     * decision about what Hospeda is granting, so no public form asks for it
     * and no applicant can assert it.
     *
     * Degrades rather than fails on a lead with no usable typed organization
     * data: the lead is still approved, `partnerId` comes back null, and the
     * admin builds the partner by hand. Refusing would strand every partner
     * lead submitted before the typed columns existed.
     *
     * @param params - `{ actor, id, input: { tier, adminNote? } }`.
     * @param ctx - Optional service execution context.
     * @returns `ServiceOutput<ApproveAndProvisionPartnerOutput>`.
     * @throws `FORBIDDEN` without `ALLIANCE_LEAD_MANAGE`.
     * @throws `NOT_FOUND` when the lead does not exist.
     * @throws `VALIDATION_ERROR` when the lead is not a `partner` lead.
     */
    public async approveAndProvisionPartner(
        params: ApproveAndProvisionPartnerInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<ApproveAndProvisionPartnerOutput>> {
        const { actor, id, input } = params;
        return this.runWithLoggingAndValidation({
            methodName: 'approveAndProvisionPartner',
            input: { actor, id, ...input },
            schema: approveAndProvisionPartnerInputSchema,
            ctx,
            execute: async (validated, a, execCtx) => {
                if (!hasPermission(a, PermissionEnum.ALLIANCE_LEAD_MANAGE)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: ALLIANCE_LEAD_MANAGE required to handle alliance leads'
                    );
                }

                const existing = await this._model.findById(validated.id, execCtx?.tx);
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Alliance lead not found: ${validated.id}`
                    );
                }

                const plan = resolvePartnerProvisionPlan(existing);

                // The ONE skip that is a real error. The other two are outcomes
                // an admin can legitimately reach by pressing this button; this
                // one means the button was pressed on the wrong lead, and
                // silently approving a sponsor or editor application as a side
                // effect of a partner-specific action would be a surprise worth
                // failing over.
                if (plan.kind === 'skip' && plan.reason === 'not-a-partner') {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        `Alliance lead ${validated.id} is not a partner application`
                    );
                }

                // Provisioning and the status change land together, for the
                // reason spelled out in `markHandled`: an approved lead with no
                // partner is the inconsistent state this slice removes, and an
                // orphan partner whose lead never got linked would be
                // provisioned AGAIN on the retry, because the link that makes
                // this idempotent is written by the very update that failed.
                const applyDecision = async (
                    txCtx: ServiceContext | undefined
                ): Promise<{ row: SelectAllianceLead; result: ProvisionPartnerResult }> => {
                    const result = await provisionPartnerFromLead({
                        lead: existing,
                        partnerModel: this._partnerModel,
                        tier: validated.tier,
                        actorId: a.id,
                        logger: this.logger,
                        tx: txCtx?.tx
                    });

                    const updatePayload: Partial<AllianceLead> = {
                        status: 'approved',
                        updatedById: a.id,
                        ...(validated.adminNote === undefined
                            ? {}
                            : { adminNote: validated.adminNote }),
                        ...(result.provisioned ? { provisionedPartnerId: result.partnerId } : {})
                    };

                    const row = await this._model.update(
                        { id: validated.id },
                        updatePayload,
                        txCtx?.tx
                    );

                    // Null means the row went away mid-request. Throwing here
                    // also rolls back the partner this call just created, which
                    // is the point of doing both inside one boundary.
                    if (!row) {
                        throw new ServiceError(
                            ServiceErrorCode.NOT_FOUND,
                            `Alliance lead not found: ${validated.id}`
                        );
                    }

                    return { row: row as SelectAllianceLead, result };
                };

                // A boundary is opened ONLY when a partner is actually coming.
                // Re-pressing the button on an already-provisioned lead, and
                // approving a lead too incomplete to provision, are a single
                // UPDATE — wrapping those would make a method that needs no
                // database connection demand one.
                const willProvision = plan.kind === 'provision';

                const { row, result } = execCtx?.tx
                    ? await applyDecision(execCtx)
                    : willProvision
                      ? await withServiceTransaction(applyDecision)
                      : await applyDecision(undefined);

                const lead = toAllianceLead(row);

                if (this._decisionNotifier !== null) {
                    // AFTER the write and deliberately NOT awaited — same
                    // reasoning as `markHandled`: the approval is the durable
                    // outcome and the email is a courtesy on top of it.
                    void this._decisionNotifier
                        .notifyDecision({
                            leadId: lead.id,
                            email: lead.email,
                            contactName: lead.contactName,
                            kind: lead.kind,
                            outcome: 'approved'
                        })
                        .catch((error: unknown) => {
                            this.logger.error(
                                {
                                    leadId: lead.id,
                                    outcome: 'approved',
                                    error: error instanceof Error ? error.message : String(error)
                                },
                                '[alliance-lead] decision notification failed to send'
                            );
                        });
                }

                return {
                    lead,
                    partnerId: result.provisioned
                        ? result.partnerId
                        : (result.partnerId ?? lead.provisionedPartnerId ?? null),
                    provisioned: result.provisioned
                };
            }
        });
    }
}
