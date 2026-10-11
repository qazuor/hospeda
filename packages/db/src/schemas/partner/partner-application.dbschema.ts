import { sql } from 'drizzle-orm';
import {
    check,
    integer,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';
import { enumToTuple } from '../../utils/enum-utils.ts';
import { users } from '../user/user.dbschema.ts';
import { partners } from './partner.dbschema.ts';

/** Spec «postulacion» statuses; PENDIENTE/APROBADA/RECHAZADA map to PENDING/APPROVED/REJECTED. PP1 creates PENDING. */
export const PartnerApplicationStatusEnum = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED'
} as const;
export type PartnerApplicationStatus =
    (typeof PartnerApplicationStatusEnum)[keyof typeof PartnerApplicationStatusEnum];
export const PartnerApplicationStatusPgEnum = pgEnum(
    'partner_application_status_enum',
    enumToTuple(PartnerApplicationStatusEnum)
);

/** Spec «postulacion» (V/02 §2.7); the flow writes these fields in V7. */
export const partnerApplications = pgTable(
    'partner_application',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** Spec «el correo que se escribió en el formulario». */
        email: text('email').notNull(),
        /** Spec «estado»; PP1 is the only creator and defaults to PENDING. */
        status: PartnerApplicationStatusPgEnum('status').notNull().default('PENDING'),
        /** Spec «el instante de resolución», written by V7. */
        resolvedAt: timestamp('resolved_at', { withTimezone: true }),
        /** Spec «partner_id», set on approval by V7. */
        partnerId: uuid('partner_id').references(() => partners.id, { onDelete: 'restrict' }),
        /** Spec «espera_anulada_en», written by the admin wait cancellation in V7. */
        waitCancelledAt: timestamp('wait_cancelled_at', { withTimezone: true }),
        /** Spec «quién la anuló», written by the admin wait cancellation in V7. */
        waitCancelledBy: uuid('wait_cancelled_by').references(() => users.id, {
            onDelete: 'set null'
        }),
        /** Version of PLAZO:9 used for a rejection clock, stored by V7 PP3; no FK by design. */
        deadlinesVersion: integer('deadlines_version'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        pendingEmail: uniqueIndex('uq_partner_application_pending_email')
            .on(sql`lower(${table.email})`)
            .where(sql`${table.status} = 'PENDING'`),
        partnerIffApproved: check(
            'ck_partner_application_partner_iff_approved',
            sql`(${table.status} = 'APPROVED') = (${table.partnerId} IS NOT NULL)`
        ),
        waitCancelPair: check(
            'ck_partner_application_wait_cancel_pair',
            sql`${table.waitCancelledBy} IS NULL OR ${table.waitCancelledAt} IS NOT NULL`
        )
    })
);
