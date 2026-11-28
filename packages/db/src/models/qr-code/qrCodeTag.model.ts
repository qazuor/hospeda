import type { QrCodeTag, QrCodeTagRef } from '@repo/schemas';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { withTransaction } from '../../client.ts';
import { qrCodes } from '../../schemas/qr-code/qr_code.dbschema.ts';
import { qrCodeTags } from '../../schemas/qr-code/qr_code_tag.dbschema.ts';
import { rQrCodeQrCodeTag } from '../../schemas/qr-code/r_qr_code_qr_code_tag.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Model for `qr_code_tags` (HOS-2679). Soft delete by default, per
 * `BaseModelImpl`.
 */
export class QrCodeTagModel extends BaseModelImpl<QrCodeTag> {
    protected table = qrCodeTags;
    public entityName = 'qrCodeTags';

    protected getTableName(): string {
        return 'qrCodeTags';
    }

    /**
     * The LIVE tag holding `slug`, or `null`. A soft-deleted tag does not count:
     * the unique index is partial over live rows, so its slug is free again.
     *
     * @param slug - The derived slug.
     * @param tx - Optional transaction client.
     * @returns The tag, or `null`.
     */
    async findLiveBySlug(slug: string, tx?: DrizzleClient): Promise<QrCodeTag | null> {
        const db = this.getClient(tx);
        const logContext = { slug };
        try {
            const rows = await db
                .select()
                .from(qrCodeTags)
                .where(and(eq(qrCodeTags.slug, slug), isNull(qrCodeTags.deletedAt)))
                .limit(1);
            logQuery(this.entityName, 'findLiveBySlug', logContext, rows);
            // DRIZZLE-LIMITATION: select(*) returns InferSelect with the branded pgEnum colour; cast back to the canonical QrCodeTag.
            return (rows[0] as unknown as QrCodeTag) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findLiveBySlug', logContext, err);
            throw new DbError(this.entityName, 'findLiveBySlug', logContext, err.message);
        }
    }

    /**
     * How many of `ids` name a LIVE tag. The set-tags write uses it to refuse an
     * unknown or deleted id instead of failing on the foreign key.
     *
     * @param ids - Tag ids, de-duplicated by the caller.
     * @param tx - Optional transaction client.
     * @returns The number of live tags among them.
     */
    async countLiveByIds(ids: readonly string[], tx?: DrizzleClient): Promise<number> {
        if (ids.length === 0) return 0;
        const db = this.getClient(tx);
        const logContext = { ids };
        try {
            const rows = await db
                .select({ id: qrCodeTags.id })
                .from(qrCodeTags)
                .where(and(inArray(qrCodeTags.id, [...ids]), isNull(qrCodeTags.deletedAt)));
            logQuery(this.entityName, 'countLiveByIds', logContext, { count: rows.length });
            return rows.length;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'countLiveByIds', logContext, err);
            throw new DbError(this.entityName, 'countLiveByIds', logContext, err.message);
        }
    }
}

/** Singleton instance of QrCodeTagModel. */
export const qrCodeTagModel = new QrCodeTagModel();

/** A join row, as `BaseModelImpl` needs a row type. */
type RQrCodeQrCodeTagRow = { qrCodeId: string; qrCodeTagId: string };

/**
 * Model for `r_qr_code_qr_code_tag` (HOS-2679): the tags each QR code carries.
 */
export class RQrCodeQrCodeTagModel extends BaseModelImpl<RQrCodeQrCodeTagRow> {
    protected table = rQrCodeQrCodeTag;
    public entityName = 'rQrCodeQrCodeTag';

    protected getTableName(): string {
        return 'rQrCodeQrCodeTag';
    }

    /**
     * Replaces the WHOLE tag set of one code, in one transaction: lock the code
     * row, delete every link for the code, insert the new set.
     *
     * Race-safe in two ways. The `FOR UPDATE` on the `qr_codes` row serialises
     * two concurrent writes for the SAME code, so the second sees the first's
     * links gone and writes its own set — last writer wins as a whole set,
     * never a mix. And the insert is `ON CONFLICT DO NOTHING`, so even a writer
     * that slipped in without the lock cannot turn a duplicate link into a 500.
     * Applying the same set twice leaves the same rows.
     *
     * @param qrCodeId - The code.
     * @param tagIds - The complete new set; `[]` clears it. De-duplicated here.
     * @param tx - Optional outer transaction, reused when given.
     */
    async setTagsForQrCode(
        qrCodeId: string,
        tagIds: readonly string[],
        tx?: DrizzleClient
    ): Promise<void> {
        const unique = [...new Set(tagIds)];
        const logContext = { qrCodeId, tagIds: unique };
        try {
            await withTransaction(async (innerTx) => {
                await innerTx
                    .select({ id: qrCodes.id })
                    .from(qrCodes)
                    .where(eq(qrCodes.id, qrCodeId))
                    .for('update');
                await innerTx
                    .delete(rQrCodeQrCodeTag)
                    .where(eq(rQrCodeQrCodeTag.qrCodeId, qrCodeId));
                if (unique.length === 0) return;
                await innerTx
                    .insert(rQrCodeQrCodeTag)
                    .values(unique.map((qrCodeTagId) => ({ qrCodeId, qrCodeTagId })))
                    .onConflictDoNothing();
            }, tx);
            logQuery(this.entityName, 'setTagsForQrCode', logContext, { count: unique.length });
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'setTagsForQrCode', logContext, err);
            throw new DbError(this.entityName, 'setTagsForQrCode', logContext, err.message);
        }
    }

    /**
     * The LIVE tags of each of `qrCodeIds`, in ONE query, ordered by name. A code
     * with no tags is absent from the map; callers default it to `[]`.
     *
     * @param qrCodeIds - The codes of one list page.
     * @param tx - Optional transaction client.
     * @returns Map from code id to its tag refs.
     */
    async findTagRefsByQrCodeIds(
        qrCodeIds: readonly string[],
        tx?: DrizzleClient
    ): Promise<Map<string, QrCodeTagRef[]>> {
        const result = new Map<string, QrCodeTagRef[]>();
        if (qrCodeIds.length === 0) return result;
        const db = this.getClient(tx);
        const logContext = { qrCodeIds };
        try {
            const rows = await db
                .select({
                    qrCodeId: rQrCodeQrCodeTag.qrCodeId,
                    id: qrCodeTags.id,
                    name: qrCodeTags.name,
                    slug: qrCodeTags.slug,
                    color: qrCodeTags.color
                })
                .from(rQrCodeQrCodeTag)
                .innerJoin(qrCodeTags, eq(qrCodeTags.id, rQrCodeQrCodeTag.qrCodeTagId))
                .where(
                    and(
                        inArray(rQrCodeQrCodeTag.qrCodeId, [...qrCodeIds]),
                        isNull(qrCodeTags.deletedAt)
                    )
                )
                .orderBy(asc(qrCodeTags.name));
            for (const { qrCodeId, ...tag } of rows) {
                const list = result.get(qrCodeId) ?? [];
                // DRIZZLE-LIMITATION: the projected pgEnum colour is branded; cast to the canonical ref.
                list.push(tag as unknown as QrCodeTagRef);
                result.set(qrCodeId, list);
            }
            logQuery(this.entityName, 'findTagRefsByQrCodeIds', logContext, { count: rows.length });
            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findTagRefsByQrCodeIds', logContext, err);
            throw new DbError(this.entityName, 'findTagRefsByQrCodeIds', logContext, err.message);
        }
    }
}

/** Singleton instance of RQrCodeQrCodeTagModel. */
export const rQrCodeQrCodeTagModel = new RQrCodeQrCodeTagModel();
