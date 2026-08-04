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
import { AllianceLeadModel, type SelectAllianceLead } from '@repo/db';
import {
    type AllianceLead,
    AllianceLeadAdminListQuerySchema,
    AllianceLeadClaimInputSchema,
    type AllianceLeadCreateInput,
    AllianceLeadCreateInputSchema,
    type AllianceLeadKind,
    AllianceLeadMarkHandledSchema,
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

// ---------------------------------------------------------------------------
// Internal validation schemas
// ---------------------------------------------------------------------------

/** Validates the `{ id, status, adminNote? }` shape for `markHandled`. */
const markHandledInputSchema = AllianceLeadMarkHandledSchema.extend({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
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
    private readonly _claimInviter: AllianceClaimInvitePort | null;

    constructor(config: ServiceConfig, claimInviter?: AllianceClaimInvitePort | null) {
        super(config, 'allianceLead');
        this._model = new AllianceLeadModel();
        this._claimInviter = claimInviter ?? null;
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
            schema: AllianceLeadCreateInputSchema,
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

                const lead = (await this._model.create(
                    {
                        ...(validated as Partial<SelectAllianceLead>),
                        applicantUserId,
                        // The row stores the DIGEST. The raw token exists only
                        // in this closure and in the email that carries it.
                        claimToken: claim === null ? null : digestClaimToken(claim.token),
                        claimExpiresAt: claim?.expiresAt ?? null
                    },
                    execCtx?.tx
                )) as unknown as AllianceLead;

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
                        return existing as unknown as AllianceLead;
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

                const updated = await this._model.update(
                    { id: validated.id },
                    {
                        applicantUserId: actorUserId,
                        // Single use: burn both halves so the same link cannot
                        // be replayed, and so no digest outlives its purpose.
                        claimToken: null,
                        claimExpiresAt: null
                    },
                    execCtx?.tx
                );
                return updated as unknown as AllianceLead;
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
     * Never auto-provisions any role/entity (HOS-277 NG-1) — the admin
     * provisions the corresponding partner/sponsor/editor/HostTrade entry by
     * hand after approving.
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

                const updatePayload: Partial<AllianceLead> = {
                    status: validated.status,
                    updatedById: a.id,
                    ...(validated.adminNote === undefined ? {} : { adminNote: validated.adminNote })
                };

                const updated = await this._model.update(
                    { id: validated.id },
                    updatePayload,
                    execCtx?.tx
                );
                return updated as AllianceLead;
            }
        });
    }
}
