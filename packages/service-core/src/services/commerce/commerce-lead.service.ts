/**
 * commerce-lead.service.ts
 *
 * Stateless service for commerce listing lead management (SPEC-239 T-033).
 *
 * A "commerce lead" is a pre-onboarding application submitted via the public
 * "Sumar mi negocio" (Add my business) form.  It records the applicant's
 * contact info and business details for admin review and marketing capture.
 * HOS-693 §6.2 removed the admin-provisioning step this used to feed
 * (`approveAndProvision`) — owners now create their own listing directly,
 * which is what grants the COMMERCE_OWNER role (HOS-687). This service's
 * remaining surface (`createLead`, `listLeads`, `markHandled`, `getMyLead`)
 * is unchanged.
 *
 * ## Design decisions
 * - Extends `BaseService` (not `BaseCrudService`) because the lead lifecycle
 *   does not follow the standard CRUD pattern: create is public, update is
 *   admin-only (workflow transition), and delete is admin-only.
 * - `@repo/notifications` is optional: if a configured `NotificationService`
 *   instance is not injected, notification attempts are skipped with a warning
 *   log.  This keeps the service testable without a real email transport.
 * - Permission checks use `COMMERCE_*` `PermissionEnum` values only;
 *   no `RoleEnum` checks.
 *
 * @module commerce-lead.service
 */

import { CommerceLeadModel } from '@repo/db';
import {
    type CommerceLead,
    type CommerceLeadAdminUpdateInput,
    CommerceLeadAdminUpdateInputSchema,
    type CommerceLeadCreateInput,
    CommerceLeadCreateInputSchema,
    PermissionEnum,
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
// Notification port (optional)
// ---------------------------------------------------------------------------

/**
 * Minimal interface for sending a new-lead notification to the ops team.
 * Injected optionally via the service constructor so callers without a wired
 * transport can still use the service (notifications are skipped with a log).
 */
export interface LeadNotificationPort {
    /**
     * Sends a notification that a new commerce lead has been submitted.
     *
     * @param lead - The newly created lead entity.
     * @returns A promise that resolves when the notification is sent.
     *   Must NOT throw — the service wraps this in a try/catch.
     */
    notifyNewLead: (lead: CommerceLead) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

/** Input for listing leads (admin). */
export interface ListLeadsInput {
    /** Filter by workflow status. */
    readonly status?: string;
    /** Filter by commerce domain. */
    readonly domain?: string;
    /** Page number (1-based). */
    readonly page?: number;
    /** Items per page. */
    readonly pageSize?: number;
}

/** Input for marking a lead as handled. */
export interface MarkLeadHandledInput {
    /** UUID of the lead to handle. */
    readonly id: string;
    /** New status after handling: 'approved' or 'rejected'. */
    readonly status: 'approved' | 'rejected';
    /** UUID of the admin user who is handling the lead. */
    readonly handledById: string;
    /** Optional admin note explaining the decision. */
    readonly adminNote?: string;
}

// ---------------------------------------------------------------------------
// Validation schemas (internal)
// ---------------------------------------------------------------------------

const listLeadsInputSchema = z.object({
    status: z.string().optional(),
    domain: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20)
});

/**
 * Input to `getMyLead`. `domain` is a strict enum rather than the loose
 * `z.string()` `listLeadsInputSchema` uses: an unrecognised value here must
 * FAIL, not silently drop the filter, because a dropped filter returns the
 * wrong vertical's lead — which is the whole failure this filter exists to
 * prevent (H-155).
 */
const getMyLeadInputSchema = z.object({
    domain: z.enum(['gastronomy', 'experience']).optional()
});

/** Input to {@link CommerceLeadService.getMyLead}. */
export type GetMyLeadInput = z.infer<typeof getMyLeadInputSchema>;

const markHandledInputSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    status: z.enum(['approved', 'rejected']),
    handledById: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    adminNote: z.string().max(1000).optional()
});

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Manages the commerce lead lifecycle: submission, admin listing, and handling.
 *
 * ## Public surface
 * - `createLead(actor, data, ctx?)` — submit a new lead (public).
 * - `listLeads(actor, input, ctx?)` — list leads with optional filters (admin).
 * - `markHandled(actor, input, ctx?)` — approve or reject a lead (admin).
 * - `getMyLead(actor, ctx?)` — the caller's OWN most-recent provisioned lead
 *   (HOS-257 pre-fill source, protected/self-service).
 *
 * ## Permissions
 * - `createLead`: no permission required (public form endpoint).
 * - `listLeads`: requires `COMMERCE_VIEW_ALL`.
 * - `markHandled`: requires `COMMERCE_EDIT_ALL`.
 * - `getMyLead`: no permission required beyond authentication — the caller
 *   only ever reads their OWN lead (scoped by `provisionedUserId = actor.id`,
 *   never by an arbitrary id), so there is nothing to gate beyond being logged in.
 *
 * ## Notification
 * Inject a `LeadNotificationPort` via the constructor to enable email delivery
 * to the ops team after a lead is submitted.  If not injected, notifications
 * are silently skipped (a warning is logged).
 *
 * @example
 * ```ts
 * const leadService = new CommerceLeadService({ logger }, notificationPort);
 *
 * // From a public route handler:
 * const result = await leadService.createLead(guestActor, {
 *   domain: 'gastronomy',
 *   businessName: 'La Parrilla de Juan',
 *   contactName: 'Juan Pérez',
 *   email: 'juan@example.com',
 *   phone: '+54911234567',
 *   message: 'Me gustaría sumar mi parrilla a la plataforma',
 * });
 * ```
 */
export class CommerceLeadService extends BaseService {
    private readonly _model: CommerceLeadModel;
    private readonly _notifier: LeadNotificationPort | null;

    constructor(config: ServiceConfig, notifier?: LeadNotificationPort | null) {
        super(config, 'commerceLead');
        this._model = new CommerceLeadModel();
        this._notifier = notifier ?? null;
    }

    // -----------------------------------------------------------------------
    // createLead — public (no permission gate)
    // -----------------------------------------------------------------------

    /**
     * Submits a new commerce listing lead.
     *
     * No permission check is applied — this corresponds to the public
     * "Sumar mi negocio" form endpoint.  After saving the lead, a
     * best-effort notification is sent to the ops team via the injected
     * `LeadNotificationPort`.  Notification failures are logged and suppressed;
     * they never block the create operation.
     *
     * @param actor - The actor submitting the lead (typically an anonymous / public actor).
     * @param data - Lead creation payload (see `CommerceLeadCreateInput`).
     * @param ctx - Optional service execution context.
     * @returns `ServiceOutput<CommerceLead>` wrapping the created lead.
     */
    public async createLead(
        actor: Actor,
        data: CommerceLeadCreateInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<CommerceLead>> {
        return this.runWithLoggingAndValidation({
            methodName: 'createLead',
            input: { actor, ...data },
            schema: CommerceLeadCreateInputSchema,
            ctx,
            execute: async (validated, _a, execCtx) => {
                const lead = await this._model.create(
                    validated as Partial<CommerceLead>,
                    execCtx?.tx
                );
                const created = lead as CommerceLead;

                // Best-effort notification — never blocks the create. A failure
                // is left for the backstop cron, which finds the lead through
                // its null `opsNotifiedAt`.
                if (this._notifier) {
                    try {
                        await this._notifier.notifyNewLead(created);
                    } catch (err) {
                        this.logger.error(
                            { err, leadId: created.id },
                            '[commerce-lead] ops intake alert failed to send'
                        );
                    }
                } else {
                    // WARN, not debug. This branch ran on every commerce lead
                    // ever submitted, and production does not emit debug — so
                    // the one trace of the path not taken was invisible, which
                    // is why nobody noticed the alert had never been wired.
                    this.logger.warn(
                        { leadId: created.id },
                        '[commerce-lead] no notifier configured; nobody was told about this lead'
                    );
                }

                return created;
            }
        });
    }

    // -----------------------------------------------------------------------
    // getMyLead — self-service, auth-only (HOS-257)
    // -----------------------------------------------------------------------

    /**
     * Returns the authenticated caller's own most-recent PROVISIONED lead, for
     * pre-filling the commerce create form (HOS-257 D-4).
     *
     * Scoped by `provisionedUserId = actor.id` — the FK the now-removed
     * admin provisioning flow used to set when the owner account was created
     * from this lead (HOS-693 §6.2 deleted that flow; this method and its
     * scoping column are unchanged, so no lead is provisioned by it any
     * more). This is the only reliable "own lead" link: `commerce_leads` rows
     * have no `ownerId`/`createdById` (leads are anonymous public-form
     * submissions, see the schema doc), so any OTHER lead matching the actor's
     * email would NOT be provably theirs. A caller with no provisioned lead
     * (now the ONLY case) gets `null`, never an error — this is a pre-fill
     * convenience, not a gate (D-4 golden rule).
     *
     * No permission check beyond `validateActor` — the query is inherently
     * self-scoped, so there is nothing an elevated permission would unlock.
     *
     * ## Scoping by `domain` (H-155)
     *
     * Owner scoping alone is NOT enough. One owner can legitimately hold leads
     * in both verticals — the product invites exactly that ("+ Nuevo comercio",
     * gastronomy and experience under one account) — so "the caller's most
     * recent lead" was pre-filling the EXPERIENCE create form with a
     * GASTRONOMY lead's business name and destination.
     *
     * That is not a cosmetic wrong default. The create form derives the public
     * slug from `name`, and the editor tells the owner the slug cannot be
     * changed afterwards, so an owner who does not notice the pre-filled
     * restaurant name ships their excursion under it permanently. The error
     * becomes irreversible in the same click that commits it.
     *
     * Callers rendering a vertical-specific form MUST pass that vertical as
     * `domain`. Omitting it keeps the original owner-only behaviour for callers
     * that genuinely want "any lead of mine".
     *
     * @param actor - The authenticated actor requesting their own lead.
     * @param input - Optional filters; `domain` restricts to one vertical.
     * @param ctx - Optional service execution context.
     * @returns `ServiceOutput<CommerceLead | null>` — `null` when the caller
     *   has no provisioned lead on record (for the requested domain, when one
     *   was given).
     */
    public async getMyLead(
        actor: Actor,
        input: GetMyLeadInput = {},
        ctx?: ServiceContext
    ): Promise<ServiceOutput<CommerceLead | null>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getMyLead',
            input: { actor, ...input },
            schema: getMyLeadInputSchema,
            ctx,
            execute: async (validated, a, execCtx) => {
                const where: Record<string, unknown> = { provisionedUserId: a.id };
                if (validated.domain !== undefined) {
                    where.domain = validated.domain;
                }

                const result = await this._model.findAll(
                    where,
                    { page: 1, pageSize: 1, sortBy: 'createdAt', sortOrder: 'desc' },
                    undefined,
                    execCtx?.tx
                );
                const [mostRecent] = result.items;
                return (mostRecent as CommerceLead | undefined) ?? null;
            }
        });
    }

    // -----------------------------------------------------------------------
    // listLeads — admin (requires COMMERCE_VIEW_ALL)
    // -----------------------------------------------------------------------

    /**
     * Lists commerce leads with optional status / domain filters.
     *
     * Requires `COMMERCE_VIEW_ALL`.
     *
     * @param actor - The admin actor requesting the list.
     * @param input - Optional filter and pagination parameters.
     * @param ctx - Optional service execution context.
     * @returns `ServiceOutput<PaginatedListOutput<CommerceLead>>`.
     */
    public async listLeads(
        actor: Actor,
        input: ListLeadsInput = {},
        ctx?: ServiceContext
    ): Promise<ServiceOutput<PaginatedListOutput<CommerceLead>>> {
        return this.runWithLoggingAndValidation({
            methodName: 'listLeads',
            input: { actor, ...input },
            schema: listLeadsInputSchema,
            ctx,
            execute: async (validated, a, execCtx) => {
                if (!hasPermission(a, PermissionEnum.COMMERCE_VIEW_ALL)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: COMMERCE_VIEW_ALL required to list commerce leads'
                    );
                }

                const { status, domain, page, pageSize } = validated;
                const where: Record<string, unknown> = {};
                if (status !== undefined) where.status = status;
                if (domain !== undefined) where.domain = domain;

                const result = await this._model.findAll(
                    where,
                    { page, pageSize },
                    undefined,
                    execCtx?.tx
                );
                return result as PaginatedListOutput<CommerceLead>;
            }
        });
    }

    // -----------------------------------------------------------------------
    // markHandled — admin (requires COMMERCE_EDIT_ALL)
    // -----------------------------------------------------------------------

    /**
     * Approves or rejects a commerce lead (admin workflow transition).
     *
     * Requires `COMMERCE_EDIT_ALL`.  Sets:
     * - `status` → `'approved'` or `'rejected'`
     * - `handledAt` → current timestamp
     * - `handledById` → actor performing the action
     * - `adminNote` → optional note
     *
     * @param actor - The admin actor handling the lead.
     * @param input - Handle input: `{ id, status, handledById, adminNote? }`.
     * @param ctx - Optional service execution context.
     * @returns `ServiceOutput<CommerceLead>` wrapping the updated lead.
     * @throws `NOT_FOUND` when the lead does not exist.
     */
    public async markHandled(
        actor: Actor,
        input: MarkLeadHandledInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<CommerceLead>> {
        return this.runWithLoggingAndValidation({
            methodName: 'markHandled',
            input: { actor, ...input },
            schema: markHandledInputSchema,
            ctx,
            execute: async (validated, a, execCtx) => {
                if (!hasPermission(a, PermissionEnum.COMMERCE_EDIT_ALL)) {
                    throw new ServiceError(
                        ServiceErrorCode.FORBIDDEN,
                        'Permission denied: COMMERCE_EDIT_ALL required to handle commerce leads'
                    );
                }

                const existing = await this._model.findById(validated.id, execCtx?.tx);
                if (!existing) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `Commerce lead not found: ${validated.id}`
                    );
                }

                const updatePayload: CommerceLeadAdminUpdateInput = {
                    id: validated.id,
                    status: validated.status,
                    handledAt: new Date(),
                    handledById: validated.handledById,
                    ...(validated.adminNote === undefined ? {} : { adminNote: validated.adminNote })
                };

                // Validate through the admin update schema for consistency
                const parsed = CommerceLeadAdminUpdateInputSchema.safeParse(updatePayload);
                if (!parsed.success) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        `Invalid update payload: ${parsed.error.message}`
                    );
                }

                const updated = await this._model.update(
                    { id: validated.id },
                    parsed.data as Partial<CommerceLead>,
                    execCtx?.tx
                );
                return updated as CommerceLead;
            }
        });
    }
}
