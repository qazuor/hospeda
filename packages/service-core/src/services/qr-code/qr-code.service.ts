import type { QrCodeModel, QrCodeScanModel } from '@repo/db';
import {
    or,
    qrCodes,
    QrCodeModel as RealQrCodeModel,
    QrCodeScanModel as RealQrCodeScanModel,
    safeIlike
} from '@repo/db';
import type {
    EntityTypeEnum,
    QrCode,
    QrCodeCreateInput,
    QrCodePurposeEnum,
    QrCodeScan,
    QrCodeSearchInput
} from '@repo/schemas';
import {
    EntityTypeEnumSchema,
    QR_CODE_LABEL_MAX_LENGTH,
    QR_CODE_TARGET_URL_MAX_LENGTH,
    QR_SCAN_BROWSER_LANGUAGE_MAX_LENGTH,
    QR_SCAN_USER_AGENT_MAX_LENGTH,
    QrCodeAdminSearchSchema,
    QrCodeCreateInputSchema,
    QrCodePurposeEnumSchema,
    QrCodeRenderOptionsSchema,
    QrCodeSearchInputSchema,
    QrCodeSourceEnum,
    QrCodeUpdateInputSchema,
    QrScanDeviceTypeEnumSchema,
    QrScanOsEnumSchema,
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
import { extractPostgresErrorCause } from '../../utils/postgres-error-cause';
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

/**
 * What {@link QrCodeService.registerScan} accepts (HOS-1141).
 *
 * Only `qrCodeId` is required. Every other field is optional AND nullable, and
 * that shape is the contract rather than an accident of typing: the caller
 * reads these values off headers a stranger controls, and the rule the whole
 * redirect path is built on is that a scan is lost before a redirect is. If any
 * field here were REQUIRED, a hostile client could make the insert fail simply
 * by withholding a header.
 *
 * `browserLanguage` is length-bounded rather than pinned to the closed locale
 * set on purpose. This is the WRITE boundary; pinning it here would mean that
 * the day a locale is retired, rows already derived from it start failing
 * validation on a path whose entire job is not to fail. `QrCodeScanSchema`, the
 * read shape, is where the closed set is named.
 */
const RegisterScanInputSchema = z.object({
    qrCodeId: z.string().uuid(),
    userAgent: z.string().max(QR_SCAN_USER_AGENT_MAX_LENGTH).nullable().optional(),
    deviceType: QrScanDeviceTypeEnumSchema.nullable().optional(),
    os: QrScanOsEnumSchema.nullable().optional(),
    browserLanguage: z.string().max(QR_SCAN_BROWSER_LANGUAGE_MAX_LENGTH).nullable().optional(),
    targetUrlAtScan: z.string().max(QR_CODE_TARGET_URL_MAX_LENGTH).nullable().optional(),
    userId: z.string().uuid().nullable().optional()
});

/** The derived half of a scan — everything past the code id. */
export type QrCodeScanContextInput = Omit<z.infer<typeof RegisterScanInputSchema>, 'qrCodeId'>;

/**
 * Postgres SQLSTATE for `unique_violation`.
 *
 * Matched against {@link extractPostgresErrorCause}, never against the error's
 * own `code`: Drizzle wraps every query failure and does NOT copy the SQLSTATE
 * onto the wrapper, so `error.code` is `undefined` on the very error this is
 * meant to recognise.
 */
const POSTGRES_UNIQUE_VIOLATION = '23505';

/**
 * How many rows the entity lookup reads before picking the oldest live one.
 *
 * More than one even though `qr_codes_entity_purpose_unique` now makes a second
 * live row for one `(entity, purpose)` impossible: the index is partial on
 * `deleted_at IS NULL`, so retired codes for the same key are still returned by
 * this query and filtered in code, and rows written before the index existed
 * were never checked by it at all. Small because anything past a handful means
 * a provisioning bug worth noticing, not a page to scroll through.
 */
const ENTITY_CODE_LOOKUP_PAGE_SIZE = 10;

/**
 * Shared entity-reference shape for the provisioning methods.
 *
 * `purpose` is REQUIRED here even though the column is nullable. The nullable
 * column exists for MANUAL codes an operator typed in; a code reached through
 * provisioning is by definition a system code, and a lookup that omitted the
 * purpose would match whichever of the subject's codes came back first.
 */
const EntityRefInputSchema = z.object({
    entityType: EntityTypeEnumSchema,
    entityId: z.string().uuid(),
    purpose: QrCodePurposeEnumSchema
});

const GetOrCreateForEntityInputSchema = EntityRefInputSchema.extend({
    targetUrl: z.string().url().max(QR_CODE_TARGET_URL_MAX_LENGTH),
    label: z.string().min(1).max(QR_CODE_LABEL_MAX_LENGTH)
});

const SetEntityTargetUrlInputSchema = EntityRefInputSchema.extend({
    targetUrl: z.string().url().max(QR_CODE_TARGET_URL_MAX_LENGTH)
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

        return { ...data, slug: await this._mintSlug(), renderOptions } as Partial<QrCode>;
    }

    /**
     * Draws a slug that is not already taken.
     *
     * Extracted from {@link _beforeCreate} so the entity-provisioning path
     * ({@link getOrCreateForEntity}) mints slugs the SAME way the admin panel
     * does. There is deliberately no semantic prefix: `QrCodeSlugSchema` admits
     * only the unambiguous alphabet and no separators, so a prefixed slug would
     * either be rejected outright (`ht-K7Qm2XbT`) or be indistinguishable from
     * a random one (`htK7Qm2XbT`) while quietly shrinking the space and leaking
     * what a code is for to anyone reading a sticker. One convention, minted in
     * one function.
     *
     * @returns A free slug.
     * @throws {ServiceError} `INTERNAL_ERROR` when every attempt collided.
     */
    private async _mintSlug(): Promise<string> {
        for (let attempt = 0; attempt < SLUG_MINT_ATTEMPTS; attempt++) {
            const slug = generateShortId();
            const taken = await this.model.findOne({ slug });
            if (!taken) {
                return slug;
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
        if (params.purpose) where.purpose = params.purpose;
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
     * Beyond the code id and the instant, the row carries what the caller could
     * learn about the client (HOS-1141) — the raw user agent, the device and OS
     * read out of it, the browser's language, where the code pointed at that
     * moment, and the signed-in scanner if there was one. Read the comment on
     * the `qr_code_scans` table before adding anything else: it rejects an IP
     * column and a referrer column BY NAME, with the reasons, so that neither
     * gets added later as an obvious completion.
     *
     * ## The context is optional, and that is load-bearing
     *
     * Every field but `qrCodeId` may be omitted or `null`, because all of them
     * come from headers a stranger chooses. This method must record the scan
     * with three nulls in it rather than refuse the row — the redirect it sits
     * on the critical path of is the function that may not fail, and a scan
     * annotated with nothing still answers "this sticker was used".
     *
     * No permission check, for the same reason as {@link resolveBySlug}: the
     * caller is whoever pointed a camera at a sticker. In particular `userId`
     * is taken from the ROUTE's resolved actor, never from a client-supplied
     * field, so passing it here cannot be used to attribute a scan to somebody
     * else.
     *
     * @param input - Input parameters.
     * @param input.actor - Actor performing the action (may be the guest actor).
     * @param input.qrCodeId - Id of the code that was scanned.
     * @param input.context - What the caller could read off the request, if
     *   anything. Omit it entirely for a scan recorded with no client context.
     * @returns Service output carrying the recorded scan.
     */
    public async registerScan(input: {
        actor: Actor;
        qrCodeId: string;
        context?: QrCodeScanContextInput;
        ctx?: ServiceContext;
    }): Promise<ServiceOutput<QrCodeScan>> {
        const { actor, qrCodeId, context, ctx } = input;

        return this.runWithLoggingAndValidation({
            methodName: 'registerScan',
            input: { actor, qrCodeId, ...(context ?? {}) },
            schema: RegisterScanInputSchema.extend({ actor: z.any() }),
            ctx,
            execute: async (validated) => {
                // Spread from the VALIDATED object, never from `context`. The
                // difference matters: `runWithLoggingAndValidation` is what
                // enforces the bounds, and writing the raw input here would let
                // an over-long user agent reach a `varchar(1024)` column and
                // turn a hostile header into a lost scan.
                return this.scanModel.create({
                    qrCodeId: validated.qrCodeId,
                    userAgent: validated.userAgent ?? null,
                    deviceType: validated.deviceType ?? null,
                    os: validated.os ?? null,
                    browserLanguage: validated.browserLanguage ?? null,
                    targetUrlAtScan: validated.targetUrlAtScan ?? null,
                    userId: validated.userId ?? null
                } as Partial<QrCodeScan>);
            }
        });
    }

    // ------------------------------------------------------------------
    // Entity provisioning (HOS-981 PR 4)
    // ------------------------------------------------------------------

    /**
     * Reads the live `GENERATED` code a subject holds FOR ONE PURPOSE.
     *
     * The key is all three of `(entityType, entityId, purpose)`, never the
     * first two. A gastronomy listing carries a door code and a table code; an
     * experience carries a listing code and a certificate code that resolve to
     * the same URL. Looking up by entity alone would answer with whichever of
     * them the database happened to return, and the provisioner would then
     * treat the menu's code as the listing's.
     *
     * Soft-deleted rows are filtered HERE rather than in the `where` object:
     * `BaseModelImpl` builds its filter from column equality and a
     * `deletedAt: null` key is not equality, so a mistyped attempt at it would
     * be dropped silently and this would start returning retired codes. The
     * oldest live row wins, deterministically — belt-and-braces now that the
     * partial UNIQUE index makes a second live row for one purpose impossible,
     * and still meaningful for the rows written before that index existed.
     *
     * No permission check: this is a system read on behalf of a caller the
     * ROUTE has already authorised by row ownership, exactly like
     * {@link resolveBySlug}.
     *
     * @param input - Input parameters.
     * @param input.actor - Actor performing the action.
     * @param input.entityType - The entity's type.
     * @param input.entityId - The entity's id.
     * @param input.purpose - WHICH of the subject's codes is wanted.
     * @returns Service output carrying the code, or `null`.
     */
    public async findLiveCodeForEntity(input: {
        actor: Actor;
        entityType: EntityTypeEnum;
        entityId: string;
        purpose: QrCodePurposeEnum;
        ctx?: ServiceContext;
    }): Promise<ServiceOutput<QrCode | null>> {
        const { actor, entityType, entityId, purpose, ctx } = input;

        return this.runWithLoggingAndValidation({
            methodName: 'findLiveCodeForEntity',
            input: { actor, entityType, entityId, purpose },
            schema: EntityRefInputSchema.extend({ actor: z.any() }),
            ctx,
            execute: async () => this._findLiveCodeForEntity({ entityType, entityId, purpose, ctx })
        });
    }

    /**
     * Returns the entity's QR code, creating it on first request.
     *
     * ## Why creation happens on READ
     *
     * A code is minted the first time somebody asks to see it, not when the
     * entity is created. That covers the rows that already exist in production
     * with no backfill, and it means an entity nobody ever prints a code for
     * never occupies a slug.
     *
     * ## The race, and how the two halves divide the work
     *
     * This runs inside a `GET`, so two concurrent requests reach the insert
     * together. The DATABASE is what makes that safe: the partial unique index
     * `(entity_type, entity_id, purpose) WHERE deleted_at IS NULL`
     * (`extras/040`) refuses the second insert outright, so the entity cannot
     * end up holding two live codes for one purpose no matter how the requests
     * interleave.
     *
     * The catch below is the RECOVERY, not the guarantee, and it is still
     * needed for exactly that reason: without it the loser of the race receives
     * a raw constraint violation as a 500 while a perfectly good code sits in
     * the table. It re-reads by the same three-part key and answers with the
     * winner's row. Two distinct constraints can fire here — the entity/purpose
     * one just described, and the far rarer `slug` collision — and only the
     * first leaves a row to recover, which is why the re-read result decides
     * whether to return or rethrow rather than the constraint name.
     *
     * Note the index is over `purpose`, NOT over `(entity_type, entity_id)`
     * alone: a restaurant's door code and its table code are two live rows for
     * one subject on purpose, and a two-column index would reject the second
     * and take that feature with it.
     *
     * ## No permission check
     *
     * Deliberate, and the same reasoning as {@link registerScan}: the caller is
     * a provider fetching their OWN code through a route authorised by row
     * ownership, and they hold no `QR_CODE_CREATE`. Routing this through
     * `create()` would demand that permission and lock every provider out of
     * their own sticker.
     *
     * @param input - Input parameters.
     * @param input.actor - Actor performing the action.
     * @param input.entityType - The entity's type.
     * @param input.entityId - The entity's id.
     * @param input.purpose - WHICH of the subject's codes this is. Part of the
     *   identity, not a label: a different purpose is a different code, not a
     *   duplicate.
     * @param input.targetUrl - Where a scan should land. Used only on creation;
     *   an existing code keeps whatever target it already has, because that
     *   value is operator-editable and must not be silently reverted on a read.
     * @param input.label - Operator-facing name. Creation only, same reason.
     * @returns Service output carrying the existing or freshly created code.
     */
    public async getOrCreateForEntity(input: {
        actor: Actor;
        entityType: EntityTypeEnum;
        entityId: string;
        purpose: QrCodePurposeEnum;
        targetUrl: string;
        label: string;
        ctx?: ServiceContext;
    }): Promise<ServiceOutput<QrCode>> {
        const { actor, entityType, entityId, purpose, targetUrl, label, ctx } = input;

        return this.runWithLoggingAndValidation({
            methodName: 'getOrCreateForEntity',
            input: { actor, entityType, entityId, purpose, targetUrl, label },
            schema: GetOrCreateForEntityInputSchema.extend({ actor: z.any() }),
            ctx,
            execute: async (validated, validActor) => {
                const existing = await this._findLiveCodeForEntity({
                    entityType: validated.entityType,
                    entityId: validated.entityId,
                    purpose: validated.purpose,
                    ctx
                });
                if (existing) return existing;

                try {
                    return await this.model.create(
                        {
                            slug: await this._mintSlug(),
                            targetUrl: validated.targetUrl,
                            label: validated.label,
                            source: QrCodeSourceEnum.GENERATED,
                            entityType: validated.entityType,
                            entityId: validated.entityId,
                            purpose: validated.purpose,
                            renderOptions: QrCodeRenderOptionsSchema.parse({}),
                            isActive: true,
                            createdById: validActor.id,
                            updatedById: validActor.id
                        } as Partial<QrCode>,
                        ctx?.tx
                    );
                } catch (error) {
                    const cause = extractPostgresErrorCause(error);
                    if (cause?.code !== POSTGRES_UNIQUE_VIOLATION) throw error;

                    const winner = await this._findLiveCodeForEntity({
                        entityType: validated.entityType,
                        entityId: validated.entityId,
                        purpose: validated.purpose,
                        ctx
                    });
                    // Only the entity/purpose constraint leaves a row behind. A
                    // violation with nothing to show for it was the `slug`
                    // index firing against a DIFFERENT subject, and swallowing
                    // that would hand the caller a success with no code in it.
                    if (winner) return winner;
                    throw error;
                }
            }
        });
    }

    /**
     * Repoints an entity's existing code at a new target.
     *
     * A no-op when the entity has no code, and that is the specified behaviour
     * rather than a shortcut: a code is minted when somebody first asks to see
     * it ({@link getOrCreateForEntity}), so provisioning one here — during an
     * unrelated edit — would burn a permanent slug for an entity that may never
     * print anything.
     *
     * No permission check, for the same reason as {@link getOrCreateForEntity}:
     * the caller is the owning service reconciling its own derived data, not a
     * human editing a QR code in the admin panel.
     *
     * @param input - Input parameters.
     * @param input.actor - Actor performing the action.
     * @param input.entityType - The entity's type.
     * @param input.entityId - The entity's id.
     * @param input.purpose - WHICH of the subject's codes to repoint. Required,
     *   and it must be: repointing "the entity's code" is not a well-formed
     *   request once a restaurant holds a door code and a table code that go to
     *   different places.
     * @param input.targetUrl - The new absolute target URL.
     * @returns Service output saying whether a row was actually written.
     */
    public async setEntityTargetUrl(input: {
        actor: Actor;
        entityType: EntityTypeEnum;
        entityId: string;
        purpose: QrCodePurposeEnum;
        targetUrl: string;
        ctx?: ServiceContext;
    }): Promise<ServiceOutput<{ updated: boolean }>> {
        const { actor, entityType, entityId, purpose, targetUrl, ctx } = input;

        return this.runWithLoggingAndValidation({
            methodName: 'setEntityTargetUrl',
            input: { actor, entityType, entityId, purpose, targetUrl },
            schema: SetEntityTargetUrlInputSchema.extend({ actor: z.any() }),
            ctx,
            execute: async (validated, validActor) => {
                const existing = await this._findLiveCodeForEntity({
                    entityType: validated.entityType,
                    entityId: validated.entityId,
                    purpose: validated.purpose,
                    ctx
                });

                if (!existing) return { updated: false };
                if (existing.targetUrl === validated.targetUrl) return { updated: false };

                await this.model.update(
                    { id: existing.id },
                    {
                        targetUrl: validated.targetUrl,
                        updatedById: validActor.id
                    } as Partial<QrCode>,
                    ctx?.tx
                );

                return { updated: true };
            }
        });
    }

    /** Shared body of the entity lookup. See {@link findLiveCodeForEntity}. */
    private async _findLiveCodeForEntity(input: {
        entityType: EntityTypeEnum;
        entityId: string;
        purpose: QrCodePurposeEnum;
        ctx?: ServiceContext;
    }): Promise<QrCode | null> {
        const { items } = await this.model.findAll(
            {
                entityType: input.entityType,
                entityId: input.entityId,
                purpose: input.purpose
            },
            { page: 1, pageSize: ENTITY_CODE_LOOKUP_PAGE_SIZE, sortBy: 'createdAt' },
            undefined,
            input.ctx?.tx
        );

        const live = items.filter((item) => !item.deletedAt);
        if (live.length === 0) return null;

        return live.reduce((oldest, candidate) =>
            candidate.createdAt < oldest.createdAt ? candidate : oldest
        );
    }
}
