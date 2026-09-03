import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { qrCodes } from './qr_code.dbschema.ts';

/**
 * QR code scans (HOS-981).
 *
 * ---------------------------------------------------------------------------
 * THIS TABLE DELIBERATELY STORES NO IP ADDRESS AND NO USER-AGENT.
 *
 * That is a decision, not an oversight, and it is the one thing to read before
 * "completing" this schema. The question the table exists to answer is *when
 * was this code scanned* — how a printed code is performing over time, which
 * sticker is worth reprinting, whether a campaign moved anything. `qrCodeId`
 * plus `scannedAt` answers that question completely.
 *
 * An IP address and a user-agent would answer no question anyone has asked.
 * What they would do is turn a counter into a log of who stood in front of a
 * poster and when, on a public endpoint that requires no authentication and is
 * therefore hit by everyone who scans, including people who never signed up for
 * anything. Collecting personal data with no question behind it is the failure
 * mode here, so the columns are absent by design.
 *
 * If a genuine question ever needs more (say, coarse geography for a campaign
 * report), add the narrowest column that answers THAT question — a country
 * code, a truncated prefix — and write down the question next to it. Do not add
 * a raw IP because it was easy to have.
 * ---------------------------------------------------------------------------
 *
 * The row is an append-only event, so it carries no audit columns and no soft
 * delete: there is no one to attribute it to and nothing to update.
 */
export const qrCodeScans = pgTable(
    'qr_code_scans',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        qrCodeId: uuid('qr_code_id')
            .notNull()
            .references(() => qrCodes.id, { onDelete: 'cascade' }),

        scannedAt: timestamp('scanned_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        /** Every read is "scans for this code", usually over a date window. */
        qrCodeScans_qrCodeId_idx: index('qrCodeScans_qrCodeId_idx').on(table.qrCodeId),
        qrCodeScans_scannedAt_idx: index('qrCodeScans_scannedAt_idx').on(table.scannedAt)
    })
);

export type InsertQrCodeScan = typeof qrCodeScans.$inferInsert;
export type SelectQrCodeScan = typeof qrCodeScans.$inferSelect;
