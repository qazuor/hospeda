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

import { AllianceLeadModel } from '@repo/db';
import {
    type AllianceLead,
    AllianceLeadAdminListQuerySchema,
    type AllianceLeadCreateInput,
    AllianceLeadCreateInputSchema,
    AllianceLeadMarkHandledSchema,
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

    constructor(config: ServiceConfig) {
        super(config, 'allianceLead');
        this._model = new AllianceLeadModel();
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
            execute: async (validated, _a, execCtx) => {
                const lead = await this._model.create(
                    validated as Partial<AllianceLead>,
                    execCtx?.tx
                );
                return lead as AllianceLead;
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
