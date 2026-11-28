import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { qrCodes } from './qr_code.dbschema.ts';
import { qrCodeTags } from './qr_code_tag.dbschema.ts';

/**
 * `r_qr_code_qr_code_tag` — which tags a QR code carries (HOS-2679).
 *
 * Shaped like `r_post_post_tag`: a composite primary key over the pair, both
 * sides cascading, no audit columns. An assignment is editorial organisation of
 * the panel, not a fact anybody needs a history of.
 *
 * Soft-deleting a tag leaves its rows here on purpose; every read joins
 * `qr_code_tags.deleted_at IS NULL`, so a deleted tag simply stops showing, and
 * the cascade only fires on a hard delete no route performs.
 */
export const rQrCodeQrCodeTag = pgTable(
    'r_qr_code_qr_code_tag',
    {
        qrCodeId: uuid('qr_code_id')
            .notNull()
            .references(() => qrCodes.id, { onDelete: 'cascade' }),
        qrCodeTagId: uuid('qr_code_tag_id')
            .notNull()
            .references(() => qrCodeTags.id, { onDelete: 'cascade' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.qrCodeId, table.qrCodeTagId] }),
        /** The tag filter on the QR list reads by tag, so the reverse side is indexed too. */
        r_qr_code_qr_code_tag_qrCodeTagId_idx: index('r_qr_code_qr_code_tag_qrCodeTagId_idx').on(
            table.qrCodeTagId
        )
    })
);

export type InsertRQrCodeQrCodeTag = typeof rQrCodeQrCodeTag.$inferInsert;
export type SelectRQrCodeQrCodeTag = typeof rQrCodeQrCodeTag.$inferSelect;
