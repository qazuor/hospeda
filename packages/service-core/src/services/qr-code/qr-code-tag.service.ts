import { QrCodeModel, QrCodeTagModel, RQrCodeQrCodeTagModel } from '@repo/db';
import type {
    QrCodeTag,
    QrCodeTagAdminSearch,
    QrCodeTagCreateInput,
    QrCodeTagRef,
    QrCodeTagUpdateInput
} from '@repo/schemas';
import {
    QR_CODE_TAG_NAME_MAX_LENGTH,
    QrCodeSetTagsInputSchema,
    QrCodeTagAdminSearchSchema,
    QrCodeTagCreateInputSchema,
    QrCodeTagUpdateInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { toSlug } from '@repo/utils';
import { z } from 'zod';
import { BaseCrudService } from '../../base/base.crud.service';
import type {
    Actor,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../types';
import { ServiceError } from '../../types';
import { extractPostgresErrorCause } from '../../utils/postgres-error-cause';
import {
    checkCanCreateQrCode,
    checkCanDeleteQrCode,
    checkCanUpdateQrCode,
    checkCanViewQrCode
} from './qr-code.permissions';

/** `hookState` key carrying the id being updated to `_beforeUpdate`. */
const UPDATE_ID_KEY = 'qrCodeTagUpdateId';

/**
 * The partial unique index on the live slug (migration 0259). Two creates or
 * renames racing past {@link QrCodeTagService} `assertFreeSlug` both pass the
 * read; the index refuses the second, and that refusal must reach the caller as
 * the same 409 the read answers, never as a 500.
 */
export const QR_CODE_TAG_SLUG_CONSTRAINT = 'qrCodeTags_slug_live_unique';

/**
 * Turns a live-slug unique violation into `ALREADY_EXISTS`; anything else is
 * returned unchanged.
 *
 * @param error - The thrown value (a `DbError` wrapping the driver error, or a
 *   `ServiceError` whose `details` carry it).
 * @returns The `ALREADY_EXISTS` error, or `null` when `error` is not that race.
 */
export function toSlugConflict(error: unknown): ServiceError | null {
    const cause = extractPostgresErrorCause(error);
    if (cause?.code !== '23505' || cause.constraint !== QR_CODE_TAG_SLUG_CONSTRAINT) return null;
    return new ServiceError(
        ServiceErrorCode.ALREADY_EXISTS,
        'A QR tag with that name already exists',
        { field: 'name', reason: 'SLUG_TAKEN' }
    );
}

/** What {@link QrCodeTagService.getTagsForCode} accepts. */
const GetTagsForCodeInputSchema = z.object({ qrCodeId: z.string().uuid() });

/** What {@link QrCodeTagService.setTagsForCode} accepts. */
const SetTagsForCodeInputSchema = QrCodeSetTagsInputSchema.extend({
    qrCodeId: z.string().uuid()
});

/**
 * Derives the dedupe slug of a tag name. Exported for the tests and for any
 * caller that needs to predict a collision before writing.
 *
 * @param input.name - The tag name, already trimmed by the schema.
 * @returns The slug, possibly `''` for a name with no sluggable character.
 */
export function deriveQrCodeTagSlug(input: { readonly name: string }): string {
    return toSlug(input.name).slice(0, QR_CODE_TAG_NAME_MAX_LENGTH).replace(/-+$/, '');
}

/**
 * Service for the QR-code tag catalog (HOS-2679).
 *
 * Gated on the QR-code permissions rather than a family of its own — a tag is
 * how a QR operator organises their own list, so whoever may create, edit or
 * delete QR codes may do the same to the tags on them. No new `PermissionEnum`
 * value, no new `role_permission` rows.
 *
 * Rules:
 * - the slug is derived from the name on create AND on rename, and must be free
 *   among LIVE tags (`ALREADY_EXISTS`, 409); a deleted tag frees its slug;
 * - a name with nothing to slug (only symbols) is a 400;
 * - delete is soft. The tag's assignments stay in the join table and simply stop
 *   being read, because every read joins live tags only;
 * - it also owns the per-code tag SET ({@link getTagsForCode},
 *   {@link setTagsForCode}), so `QrCodeService` — already the largest file in
 *   this folder — only reads tags for its list.
 *
 * @extends BaseCrudService
 */
export class QrCodeTagService extends BaseCrudService<
    QrCodeTag,
    QrCodeTagModel,
    typeof QrCodeTagCreateInputSchema,
    typeof QrCodeTagUpdateInputSchema,
    typeof QrCodeTagAdminSearchSchema
> {
    static readonly ENTITY_NAME = 'qrCodeTag';
    protected readonly entityName = QrCodeTagService.ENTITY_NAME;
    public readonly model: QrCodeTagModel;

    /** The QR codes a tag set is written to; read to 404 a missing code. */
    public readonly qrCodeModel: QrCodeModel;

    /** The join table. */
    public readonly tagLinkModel: RQrCodeQrCodeTagModel;

    public readonly createSchema = QrCodeTagCreateInputSchema;
    public readonly updateSchema = QrCodeTagUpdateInputSchema;
    public readonly searchSchema = QrCodeTagAdminSearchSchema;
    protected readonly adminSearchSchema = QrCodeTagAdminSearchSchema;

    constructor(
        ctx: ServiceConfig,
        model?: QrCodeTagModel,
        qrCodeModel?: QrCodeModel,
        tagLinkModel?: RQrCodeQrCodeTagModel
    ) {
        super(ctx, QrCodeTagService.ENTITY_NAME);
        this.model = model ?? new QrCodeTagModel();
        this.qrCodeModel = qrCodeModel ?? new QrCodeModel();
        this.tagLinkModel = tagLinkModel ?? new RQrCodeQrCodeTagModel();
    }

    protected getDefaultListRelations() {
        return undefined;
    }

    /** The admin `search` param matches the tag name. */
    protected override getSearchableColumns(): string[] {
        return ['name'];
    }

    protected _canCreate(actor: Actor): void {
        checkCanCreateQrCode(actor);
    }
    protected _canUpdate(actor: Actor): void {
        checkCanUpdateQrCode(actor);
    }
    protected _canView(actor: Actor): void {
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
    protected _canSoftDelete(actor: Actor): void {
        checkCanDeleteQrCode(actor);
    }
    /** No route reaches it; same gate as soft delete, like `QrCodeService`. */
    protected _canHardDelete(actor: Actor): void {
        checkCanDeleteQrCode(actor);
    }
    protected _canRestore(actor: Actor): void {
        checkCanDeleteQrCode(actor);
    }
    protected _canUpdateVisibility(actor: Actor): void {
        checkCanUpdateQrCode(actor);
    }

    protected async _canAdminList(actor: Actor): Promise<void> {
        await super._canAdminList(actor);
        checkCanViewQrCode(actor);
    }

    /**
     * Create, with the slug race mapped to 409 (see {@link toSlugConflict}).
     * The base re-throws a `DbError` and returns other failures as
     * `INTERNAL_ERROR` carrying the original on `details`; both are covered.
     */
    public override async create(
        actor: Actor,
        data: QrCodeTagCreateInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<QrCodeTag>> {
        return this.withSlugConflict(() => super.create(actor, data, ctx), ctx);
    }

    /** Derives the slug and refuses a live duplicate. */
    protected override async _beforeCreate(
        data: QrCodeTagCreateInput,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<Partial<QrCodeTag>> {
        const slug = await this.assertFreeSlug({ name: data.name, ctx });
        return { name: data.name, color: data.color ?? null, slug };
    }

    /**
     * Carries the id to {@link _beforeUpdate}, which needs it to tell "this tag
     * already has that slug" apart from "another tag has it".
     */
    public override async update(
        actor: Actor,
        id: string,
        data: QrCodeTagUpdateInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<QrCodeTag>> {
        return this.withSlugConflict(
            () =>
                super.update(actor, id, data, {
                    ...ctx,
                    hookState: { ...ctx?.hookState, [UPDATE_ID_KEY]: id }
                }),
            ctx
        );
    }

    /** Runs a write and maps the live-slug race to `ALREADY_EXISTS`. */
    private async withSlugConflict(
        write: () => Promise<ServiceOutput<QrCodeTag>>,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<QrCodeTag>> {
        try {
            const result = await write();
            const conflict = result.error ? toSlugConflict(result.error) : null;
            return conflict ? { error: conflict } : result;
        } catch (error) {
            const conflict = toSlugConflict(error);
            if (!conflict) throw error;
            // Inside an outer transaction the base throws instead of returning.
            if (ctx?.tx) throw conflict;
            return { error: conflict };
        }
    }

    /** A rename re-derives the slug; a colour-only edit leaves it alone. */
    protected override async _beforeUpdate(
        data: QrCodeTagUpdateInput,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<Partial<QrCodeTag>> {
        if (data.name === undefined) return data;
        const id = ctx?.hookState?.[UPDATE_ID_KEY];
        const slug = await this.assertFreeSlug({
            name: data.name,
            ctx,
            selfId: typeof id === 'string' ? id : undefined
        });
        return { ...data, slug };
    }

    /**
     * @throws {ServiceError} `VALIDATION_ERROR` for a name with no sluggable
     *   character; `ALREADY_EXISTS` when another live tag holds the slug.
     */
    private async assertFreeSlug(input: {
        readonly name: string;
        readonly ctx: ServiceContext;
        readonly selfId?: string;
    }): Promise<string> {
        const slug = deriveQrCodeTagSlug({ name: input.name });
        if (slug === '') {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'A tag name needs at least one letter or digit',
                { field: 'name', reason: 'NAME_NOT_SLUGGABLE' }
            );
        }
        const existing = await this.model.findLiveBySlug(slug, input.ctx?.tx);
        if (existing && existing.id !== input.selfId) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                `A QR tag named like "${input.name}" already exists`,
                { field: 'name', slug, existingTagId: existing.id }
            );
        }
        return slug;
    }

    protected async _executeSearch(
        params: QrCodeTagAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<PaginatedListOutput<QrCodeTag>> {
        return this.model.findAll(
            { deletedAt: null },
            {
                page: ctx.pagination?.page ?? params.page,
                pageSize: ctx.pagination?.pageSize ?? params.pageSize,
                sortBy: 'name',
                sortOrder: 'asc'
            },
            undefined,
            ctx.tx
        );
    }

    protected async _executeCount(
        _params: QrCodeTagAdminSearch,
        _actor: Actor,
        ctx: ServiceContext
    ): Promise<{ count: number }> {
        const count = await this.model.count({ deletedAt: null }, { tx: ctx.tx });
        return { count };
    }

    /**
     * The live tags of one QR code.
     *
     * @param input.actor - Needs `QR_CODE_VIEW`.
     * @param input.qrCodeId - The code.
     * @returns The tags, by name. `NOT_FOUND` for a missing or deleted code.
     */
    public async getTagsForCode(input: {
        actor: Actor;
        qrCodeId: string;
        ctx?: ServiceContext;
    }): Promise<ServiceOutput<{ items: QrCodeTagRef[] }>> {
        const { actor, qrCodeId, ctx } = input;
        return this.runWithLoggingAndValidation({
            methodName: 'getTagsForCode',
            input: { actor, qrCodeId },
            schema: GetTagsForCodeInputSchema,
            ctx,
            execute: async (validated, validActor, execCtx) => {
                checkCanViewQrCode(validActor);
                await this.assertLiveCode({ id: validated.qrCodeId, ctx: execCtx });
                return {
                    items: await this.readTagsOf({ qrCodeId: validated.qrCodeId, ctx: execCtx })
                };
            }
        });
    }

    /**
     * Replaces the COMPLETE tag set of one QR code. Idempotent: the same set twice
     * leaves the same rows.
     *
     * @param input.actor - Needs `QR_CODE_UPDATE`.
     * @param input.qrCodeId - The code.
     * @param input.tagIds - The complete new set; `[]` clears it.
     * @returns The tags the code now carries. `NOT_FOUND` for a missing code;
     *   `VALIDATION_ERROR` with `reason: UNKNOWN_TAG` when an id is not a live tag.
     */
    public async setTagsForCode(input: {
        actor: Actor;
        qrCodeId: string;
        tagIds: readonly string[];
        ctx?: ServiceContext;
    }): Promise<ServiceOutput<{ items: QrCodeTagRef[] }>> {
        const { actor, qrCodeId, tagIds, ctx } = input;
        return this.runWithLoggingAndValidation({
            methodName: 'setTagsForCode',
            input: { actor, qrCodeId, tagIds: [...tagIds] },
            schema: SetTagsForCodeInputSchema,
            ctx,
            execute: async (validated, validActor, execCtx) => {
                checkCanUpdateQrCode(validActor);
                await this.assertLiveCode({ id: validated.qrCodeId, ctx: execCtx });
                const unique = [...new Set(validated.tagIds)];
                const live = await this.model.countLiveByIds(unique, execCtx.tx);
                if (live !== unique.length) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'One or more tags do not exist',
                        { field: 'tagIds', reason: 'UNKNOWN_TAG' }
                    );
                }
                await this.tagLinkModel.setTagsForQrCode(validated.qrCodeId, unique, execCtx.tx);
                return {
                    items: await this.readTagsOf({ qrCodeId: validated.qrCodeId, ctx: execCtx })
                };
            }
        });
    }

    /** @throws {ServiceError} `NOT_FOUND` for a missing or soft-deleted code. */
    private async assertLiveCode(input: { id: string; ctx: ServiceContext }): Promise<void> {
        const code = await this.qrCodeModel.findById(input.id, input.ctx?.tx);
        if (!code || code.deletedAt) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, `QR code not found: ${input.id}`);
        }
    }

    private async readTagsOf(input: {
        qrCodeId: string;
        ctx: ServiceContext;
    }): Promise<QrCodeTagRef[]> {
        const map = await this.tagLinkModel.findTagRefsByQrCodeIds([input.qrCodeId], input.ctx?.tx);
        return map.get(input.qrCodeId) ?? [];
    }
}
