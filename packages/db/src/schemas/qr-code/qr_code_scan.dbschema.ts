import { QR_SCAN_BROWSER_LANGUAGE_MAX_LENGTH, QR_SCAN_USER_AGENT_MAX_LENGTH } from '@repo/schemas';
import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { QrScanDeviceTypePgEnum, QrScanOsPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { qrCodes } from './qr_code.dbschema.ts';

/**
 * QR code scans (HOS-981, widened by HOS-1141).
 *
 * ---------------------------------------------------------------------------
 * THIS TABLE NOW STORES A RAW USER-AGENT. IT STILL STORES NO IP ADDRESS.
 *
 * The first version of this file argued at length that a scan row should carry
 * the code id and the instant and nothing else. That argument was REPLACED by
 * an owner decision (HOS-1141), and the replacement is written down here rather
 * than quietly deleted, because the cost the old comment named is real and was
 * accepted with open eyes rather than refuted.
 *
 * What changed is the question. `qrCodeId + scannedAt` answers *when was this
 * code scanned*, and that turned out not to be the question the product has.
 * The question is *who is standing in front of this sign, and on what* — which
 * sticker is worth reprinting, whether the menu code is read on phones while
 * the door code is read at desks, whether the people a campaign brought are
 * locals or visitors. None of that is derivable from a count.
 *
 * ## The cost, stated rather than glossed
 *
 * `user_agent` is a device fingerprint. It carries no name and no IP, but a
 * long UA string is specific enough to re-identify a phone across scans, and
 * this endpoint is unauthenticated. The owner asked for the raw value with that
 * cost named and took the decision. It is bounded to
 * {@link QR_SCAN_USER_AGENT_MAX_LENGTH} characters — see the column.
 *
 * ## What was rejected, and why, so nobody "completes" it later
 *
 * - **No IP address, and no country derived from one.** A menu code is scanned
 *   with the customer sitting inside the restaurant, and a foreign tourist on
 *   roaming leaves through a local carrier. The column would read "Argentina"
 *   almost always — including for exactly the visitors the metric is meant to
 *   count. `browser_language` answers the same question without that defect:
 *   the language travels with the person, the IP travels with the network.
 * - **No referrer.** A camera scan opens the URL directly and sends no
 *   `Referer` at all. A column for it would be permanently null and would read,
 *   to whoever found it later, as a broken write rather than an absent signal.
 * ---------------------------------------------------------------------------
 *
 * Every added column is NULLABLE, and that is the safety property this table is
 * built around: a hostile, absent or unparseable `User-Agent` leaves the three
 * derivations null and the scan is still recorded. The redirect is the critical
 * function and the metric is not, so nothing in this table may be able to
 * refuse a row.
 *
 * The row is an append-only event, so it carries no audit columns and no soft
 * delete: there is nothing to update, and the only actor it could be attributed
 * to is already `user_id`.
 */

export const qrCodeScans = pgTable(
    'qr_code_scans',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        qrCodeId: uuid('qr_code_id')
            .notNull()
            .references(() => qrCodes.id, { onDelete: 'cascade' }),

        scannedAt: timestamp('scanned_at', { withTimezone: true }).defaultNow().notNull(),

        /**
         * The `User-Agent` header, verbatim, truncated to
         * {@link QR_SCAN_USER_AGENT_MAX_LENGTH}.
         *
         * Kept ALONGSIDE the three derivations rather than instead of them: a
         * derivation is a lossy reading made by code that will be wrong about
         * some agents, and keeping the source means a later fix can be applied
         * to rows already written instead of only to rows written after it.
         *
         * `NULL` when the header was absent or blank — never the empty string.
         * An empty UA and a missing one are the same fact and must not produce
         * two different values to group by.
         */
        userAgent: varchar('user_agent', { length: QR_SCAN_USER_AGENT_MAX_LENGTH }),

        /**
         * Phone / tablet / desktop, derived from `user_agent`.
         *
         * `NULL` means the string named none of them — NOT "desktop". Every
         * value here is a positive match (see `QrScanDeviceTypeEnum`), so a
         * garbage agent is never counted as somebody sitting at a desk.
         */
        deviceType: QrScanDeviceTypePgEnum('device_type'),

        /**
         * iOS / Android / other, derived from `user_agent`.
         *
         * `OTHER` and `NULL` are different facts and the difference is the
         * point: `OTHER` is "a UA was presented and it named neither", `NULL` is
         * "there was nothing to read". A derivation that quietly broke would
         * show up as a spike in `NULL`; folded into `OTHER` it would look like
         * an ordinary long tail.
         */
        os: QrScanOsPgEnum('os'),

        /**
         * The supported locale the scanner's `Accept-Language` asked for
         * (`es` / `en` / `pt`), or `NULL` when the header was absent, malformed
         * or named no locale this platform serves.
         *
         * NOT defaulted to `es`. Falling back to the site default is precisely
         * what would make this column useless for the question it was added for
         * — telling a local apart from a visitor — because every header-less
         * request would be reported as Spanish-speaking. The matching is
         * delegated to `matchAcceptLanguage` in `@repo/i18n`, the platform's
         * single source of truth for that negotiation, and the `matched` flag it
         * returns is what decides between a value and `NULL`.
         */
        browserLanguage: varchar('browser_language', {
            length: QR_SCAN_BROWSER_LANGUAGE_MAX_LENGTH
        }),

        /**
         * Where this code pointed AT THE MOMENT OF THE SCAN.
         *
         * Denormalised on purpose, as the direct consequence of counting by
         * `qr_code_id` rather than by the entity behind it. Counting by code is
         * the right choice — a repointed code is still the same printed sticker,
         * and knowing which sticker performs is the product — but on its own it
         * makes the history UNINTERPRETABLE: a year of scans against a code
         * whose target moved three times is one number covering three different
         * destinations, with nothing on the row to separate them.
         * `qr_codes.target_url` holds only the CURRENT value and cannot answer
         * for the past.
         *
         * `text`, mirroring `qr_codes.target_url`. Nullable so a scan whose
         * target could not be captured is still recorded, for the same reason
         * every other column added here is nullable.
         */
        targetUrlAtScan: text('target_url_at_scan'),

        /**
         * The signed-in user who scanned, when there was one.
         *
         * `NULL` for an anonymous scan, which is the overwhelmingly common case:
         * a printed code is scanned by whoever walks past it. `ON DELETE SET
         * NULL` rather than `CASCADE` — erasing an account must not silently
         * delete scans that already happened, because the count belongs to the
         * sticker, not to the person.
         */
        userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /** Every read is "scans for this code", usually over a date window. */
        qrCodeScans_qrCodeId_idx: index('qrCodeScans_qrCodeId_idx').on(table.qrCodeId),
        qrCodeScans_scannedAt_idx: index('qrCodeScans_scannedAt_idx').on(table.scannedAt),
        /**
         * Not for a query anybody runs — for the FOREIGN KEY. `ON DELETE SET
         * NULL` makes PostgreSQL find every scan belonging to a deleted user,
         * and with no index that is a sequential scan over what will be the
         * largest append-only table on the platform, taken while an account
         * deletion holds its locks.
         */
        qrCodeScans_userId_idx: index('qrCodeScans_userId_idx').on(table.userId)
    })
);

export type InsertQrCodeScan = typeof qrCodeScans.$inferInsert;
export type SelectQrCodeScan = typeof qrCodeScans.$inferSelect;
