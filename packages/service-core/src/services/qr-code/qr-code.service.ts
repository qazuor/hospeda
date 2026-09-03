import type { QrCodeModel, QrCodeScanModel } from '@repo/db';
import {
    or,
    qrCodes,
    QrCodeModel as RealQrCodeModel,
    QrCodeScanModel as RealQrCodeScanModel,
    safeIlike
} from '@repo/db';
import type { QrCode, QrCodeCreateInput, QrCodeScan, QrCodeSearchInput } from '@repo/schemas';
import {
    QrCodeAdminSearchSchema,
    QrCodeCreateInputSchema,
    QrCodeRenderOptionsSchema,
    QrCodeSearchInputSchema,
    QrCodeUpdateInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { generateShortId } from '@repo/utils';
import type { SQL } from 'drizzle-orm';
import { z } from 'zod';
import { BaseCrudService } from '../../base';
import type {
    Actor,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import { normalizeCreateInput, normalizeUpdateInput } from './qr-code.normalizers';
import {
    checkCanCreateQrCode,
    checkCanDeleteQrCode,
    checkCanUpdateQrCode,
    checkCanViewQrCode
} from './qr-code.permissions';

/** How many times a fresh slug is attempted before the create gives up. */
const SLUG_MINT_ATTEMPTS = 5;

const ResolveBySlugInputSchema = z.object({
    slug: z.string().min(1)
});

const RegisterScanInputSchema = z.object({
    qrCodeId: z.string().uuid()
});

/**
 * Service for redirectable QR codes (HOS-981).
 *
 * Beyond the inherited CRUD it carries the two operations the public redirect
 * route (PR 2) will consume: {@link QrCodeService.resolveBySlug} and
 * {@link QrCodeService.registerScan}.
 */
export class QrCodeService extends BaseCrudService<
    QrCode,
    QrCodeModel,
    typeof QrCodeCreateInputSchema,
    typeof QrCodeUpdateInputSchema,
    typeof QrCodeSearchInputSchema
> {
    static readonly ENTITY_NAME = 'qrCode';
    protected readonly entityName = QrCodeService.ENTITY_NAME;
    public readonly model: QrCodeModel;

    /** Append-only scan log. Separate model: it has no soft delete and no audit. */
    public readonly scanModel: QrCodeScanModel;

    public readonly createSchema = QrCodeCreateInputSchema;
    public readonly updateSchema = QrCodeUpdateInputSchema;
    public readonly searchSchema = QrCodeSearchInputSchema;

    public readonly normalizers = {
        create: normalizeCreateInput,
        update: normalizeUpdateInput
    };

    constructor(ctx: ServiceConfig, model?: QrCodeModel, scanModel?: QrCodeScanModel) {
        super(ctx, QrCodeService.ENTITY_NAME);
        this.model = model ?? new RealQrCodeModel();
        this.scanModel = scanModel ?? new RealQrCodeScanModel();
        /** Every admin filter maps to a column, so the default admin search applies. */
        this.adminSearchSchema = QrCodeAdminSearchSchema;
    }

    protected getDefaultListRelations() {
        return undefined;
    }

    /**
     * Columns searched when the admin `search` (free-text) query param is given.
     *
     * The override is load-bearing, not decoration. The base class defaults to
     * `['name']` and `qr_codes` has no `name` column — it has `label`. Unknown
     * columns are dropped SILENTLY by `buildSearchCondition`, which then returns
     * `undefined` for an empty condition list, so the default would attach no
     * filter at all and `?search=plaza` would answer with every code in the
     * table rather than the ones labelled "plaza".
     *
     * These are the same three columns `_buildSearchConditions` uses for the
     * `search()` / `count()` carril, so both list paths match on the same fields.
     */
    protected override getSearchableColumns(): string[] {
        return ['label', 'slug', 'targetUrl'];
    }

    // ------------------------------------------------------------------
    // Permissions
    // ------------------------------------------------------------------

    protected _canCreate(actor: Actor, _data: QrCodeCreateInput): void {
        checkCanCreateQrCode(actor);
    }
    protected _canUpdate(actor: Actor, _entity: QrCode): void {
        checkCanUpdateQrCode(actor);
    }
    protected _canSoftDelete(actor: Actor, _entity: QrCode): void {
        checkCanDeleteQrCode(actor);
    }
    /**
     * Hard delete takes the DELETE gate, not a stricter one — because no route
     * reaches it. `qr_codes.slug` is UNIQUE across the whole table, deleted rows
     * included, precisely so a printed slug can never be reissued; removing the
     * row would free it and orphan the scans that point at it. The admin tier
     * therefore exposes soft delete only.
     */
    protected _canHardDelete(actor: Actor, _entity: QrCode): void {
        checkCanDeleteQrCode(actor);
    }
    /** Undoing a soft delete is the same authority as performing it. */
    protected _canRestore(actor: Actor, _entity: QrCode): void {
        checkCanDeleteQrCode(actor);
    }
    protected _canView(actor: Actor, _entity: QrCode): void {
        checkCanViewQrCode(actor);
    }
    protected _canList(actor: Actor): void {
        checkCanViewQrCode(actor);
    }
    protected _canSearch(actor: Actor): void {
        checkCanViewQrCode(actor);
    }
    protected _canCount(actor: Actor): void {
        checkCanViewQrCode(actor);
    }
    protected _canUpdateVisibility(actor: Actor, _entity: QrCode, _newVisibility: unknown): void {
        checkCanUpdateQrCode(actor);
    }

    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanViewQrCode(actor);
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    /**
     * Mints the slug when the caller did not supply one, and materialises the
     * render defaults so the stored `jsonb` is always a complete document.
     *
     * The retry loop exists because `qr_codes.slug` is UNIQUE across the whole
     * table, soft-deleted rows included: a collision here is astronomically
     * unlikely but it is not impossible, and the failure it would otherwise
     * produce is an opaque constraint violation on an admin form.
     */
    protected async _beforeCreate(
        data: QrCodeCreateInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<Partial<QrCode>> {
        const renderOptions = QrCodeRenderOptionsSchema.parse(data.renderOptions ?? {});

        if (data.slug) {
            return { ...data, slug: data.slug, renderOptions } as Partial<QrCode>;
        }

        for (let attempt = 0; attempt < SLUG_MINT_ATTEMPTS; attempt++) {
            const slug = generateShortId();
            const taken = await this.model.findOne({ slug });
            if (!taken) {
                return { ...data, slug, renderOptions } as Partial<QrCode>;
            }
        }

        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            `Could not mint a free QR slug after ${SLUG_MINT_ATTEMPTS} attempts`
        );
    }

    // ------------------------------------------------------------------
    // Search
    // ------------------------------------------------------------------

    protected async _executeSearch(
        params: QrCodeSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<PaginatedListOutput<QrCode>> {
        const { page = 1, pageSize = 20, sortBy, sortOrder } = params;

        return this.model.findAll(
            this._buildSearchWhere(params),
            { page, pageSize, sortBy, sortOrder },
            this._buildSearchConditions(params)
        );
    }

    protected async _executeCount(
        params: QrCodeSearchInput,
        _actor: Actor,
        _ctx: ServiceContext
    ): Promise<{ count: number }> {
        const count = await this.model.count(this._buildSearchWhere(params), {
            additionalConditions: this._buildSearchConditions(params)
        });

        return { count };
    }

    /** Column-equality filters shared by search and count. */
    private _buildSearchWhere(params: QrCodeSearchInput): Record<string, unknown> {
        const where: Record<string, unknown> = {};

        if (params.source) where.source = params.source;
        if (params.entityType) where.entityType = params.entityType;
        if (params.entityId) where.entityId = params.entityId;
        if (params.isActive !== undefined) where.isActive = params.isActive;

        return where;
    }

    /** Free-text conditions shared by search and count. */
    private _buildSearchConditions(params: QrCodeSearchInput): SQL[] {
        const conditions: SQL[] = [];

        if (params.q) {
            const orCondition = or(
                safeIlike(qrCodes.label, params.q),
                safeIlike(qrCodes.slug, params.q),
                safeIlike(qrCodes.targetUrl, params.q)
            );
            if (orCondition) conditions.push(orCondition);
        }

        return conditions;
    }

    // ------------------------------------------------------------------
    // Public resolution (consumed by the redirect route, PR 2)
    // ------------------------------------------------------------------

    /**
     * Resolves a printed slug to its live QR code.
     *
     * Returns `null` — not an error — for a slug that does not exist, is
     * retired (`isActive = false`) or is soft-deleted. The three cases are
     * deliberately indistinguishable to the caller: the redirect endpoint is
     * unauthenticated, and telling a stranger apart "no such code" from "that
     * code exists but is off" enumerates the table for free.
     *
     * No permission check: this is the one operation on the entity that the
     * public is meant to reach, and it is reached by anyone holding a printed
     * sticker.
     *
     * @param input - Input parameters.
     * @param input.actor - Actor performing the action (may be the guest actor).
     * @param input.slug - The slug carried by the scanned URL.
     * @returns Service output carrying the QR code, or `null`.
     */
    public async resolveBySlug(input: {
        actor: Actor;
        slug: string;
        ctx?: ServiceContext;
    }): Promise<ServiceOutput<QrCode | null>> {
        const { actor, slug, ctx } = input;

        return this.runWithLoggingAndValidation({
            methodName: 'resolveBySlug',
            input: { actor, slug },
            schema: ResolveBySlugInputSchema.extend({ actor: z.any() }),
            ctx,
            execute: async () => {
                const found = await this.model.findOne({ slug });

                if (!found) return null;
                if (found.deletedAt) return null;
                if (!found.isActive) return null;

                return found;
            }
        });
    }

    /**
     * Records one scan of one code.
     *
     * The row carries the code id and the instant, and nothing else — see the
     * comment on the `qr_code_scans` table for why that is a decision rather
     * than an unfinished implementation.
     *
     * No permission check, for the same reason as {@link resolveBySlug}: the
     * caller is whoever pointed a camera at a sticker.
     *
     * @param input - Input parameters.
     * @param input.actor - Actor performing the action (may be the guest actor).
     * @param input.qrCodeId - Id of the code that was scanned.
     * @returns Service output carrying the recorded scan.
     */
    public async registerScan(input: {
        actor: Actor;
        qrCodeId: string;
        ctx?: ServiceContext;
    }): Promise<ServiceOutput<QrCodeScan>> {
        const { actor, qrCodeId, ctx } = input;

        return this.runWithLoggingAndValidation({
            methodName: 'registerScan',
            input: { actor, qrCodeId },
            schema: RegisterScanInputSchema.extend({ actor: z.any() }),
            ctx,
            execute: async () => {
                return this.scanModel.create({ qrCodeId });
            }
        });
    }
}
