import { relations } from 'drizzle-orm';
import { date, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { experiences } from './experiences.dbschema.ts';

/**
 * Certificates an experience provider issues to the people who did the
 * experience (HOS-1057).
 *
 * ---------------------------------------------------------------------------
 * THREE COLUMNS OF SUBSTANCE, AND THAT IS THE WHOLE MODEL.
 *
 * "A quién, de qué experiencia, cuándo" — `recipientName`, `experienceId`,
 * `completedAt`. Everything else on the row is audit or the issue stamp. There
 * is no state machine, no price, no party size and no link to a booking,
 * because a certificate is a souvenir rather than a transaction: nothing about
 * it is negotiated, confirmed or reversed.
 *
 * ## No recipient account, deliberately
 *
 * `recipientName` is free text and there is no `recipientUserId`. The person
 * who spent an afternoon fishing is usually not a Hospeda user, and requiring
 * them to be one would make the feature unusable for exactly the providers it
 * is for. The cost is that the platform cannot verify the name — which is why
 * the certificate never claims to: it says the provider certifies it, and the
 * provider is the one whose reputation travels with the sheet.
 *
 * ## No public share token
 *
 * There is no `code`, `token` or `publicSlug` column, and its absence is a
 * decision recorded in
 * `apps/api/src/services/experience-certificate/certificate-response.ts`: a
 * certificate is readable by the issuing owner and by nobody else, and what
 * travels is the PDF file the provider hands over. Adding a token later is an
 * additive migration; un-leaking one is not.
 * ---------------------------------------------------------------------------
 *
 * Carries the full audit and soft-delete quartet, unlike `qr_code_scans`: a
 * certificate is authored by a person, can be corrected when the name was
 * mistyped, and can be withdrawn — none of which is true of an append-only
 * event.
 */
export const experienceCertificates = pgTable(
    'experience_certificates',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /**
         * The experience this certifies. `cascade`, because a certificate for a
         * listing that no longer exists attests to nothing.
         */
        experienceId: uuid('experience_id')
            .notNull()
            .references(() => experiences.id, { onDelete: 'cascade' }),

        /**
         * Who it was issued to, as the provider typed it.
         *
         * Bounded at 120 to match `ExperienceCertificateRecipientNameSchema`
         * (`@repo/schemas`) — the column is the second wall, not the first, and
         * the two lengths are meant to stay equal.
         */
        recipientName: varchar('recipient_name', { length: 120 }).notNull(),

        /**
         * The day they did the experience.
         *
         * A `date` and not a `timestamp`: what a certificate states is a day,
         * printed as a day, and storing an instant would make the printed line
         * depend on the reader's time zone — the failure
         * `feedback_toisostring_shifts_date_windows_a_day` describes, on the one
         * field a person checks against their own memory.
         */
        completedAt: date('completed_at').notNull(),

        /** When the provider issued it. Server-decided, never client-sent. */
        issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /** Every read is "the certificates of this listing", newest first. */
        experienceCertificates_experienceId_idx: index(
            'experienceCertificates_experienceId_idx'
        ).on(table.experienceId),
        experienceCertificates_issuedAt_idx: index('experienceCertificates_issuedAt_idx').on(
            table.issuedAt
        )
    })
);

export const experienceCertificatesRelations = relations(experienceCertificates, ({ one }) => ({
    experience: one(experiences, {
        fields: [experienceCertificates.experienceId],
        references: [experiences.id]
    })
}));

export type InsertExperienceCertificate = typeof experienceCertificates.$inferInsert;
export type SelectExperienceCertificate = typeof experienceCertificates.$inferSelect;
