import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { HostTradeIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { HostTradeUsageChannelEnumSchema } from '../../enums/host-trade-usage-channel.schema.js';
import { HostTradeUsageDeclaredByEnumSchema } from '../../enums/host-trade-usage-declared-by.schema.js';
import { HostTradeUsageStatusEnumSchema } from '../../enums/host-trade-usage-status.schema.js';
import {
    HOST_TRADE_USAGE_NOTE_MAX,
    HOST_TRADE_USAGE_REJECTION_NOTE_MAX
} from '../host-trade/host-trade-usage.constants.js';

/** Calendar-date shape for `serviced_at`, which is a Postgres `date`, not a timestamp. */
const SERVICED_AT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Calendar date on which the service actually happened.
 *
 * A plain `YYYY-MM-DD` string rather than a coerced `Date`, because the column
 * is a Postgres `date` and the driver returns it as a string. Coercing to a
 * `Date` would attach a UTC midnight that shifts the day backwards for every
 * Argentine caller (UTC-3), turning "I was there on the 1st" into the 31st.
 */
export const HostTradeUsageServicedAtSchema = z.string().regex(SERVICED_AT_REGEX, {
    message: 'zodError.hostTradeUsage.servicedAt.format'
});

/**
 * HostTradeBenefitUsageSchema — one "this host used this provider's benefit"
 * record (HOS-376 §7.1).
 *
 * Mirrors the `host_trade_benefit_usages` row. The mechanism is "one party
 * declares, the counterpart confirms": {@link declaredBy} says which side
 * opened the record and therefore who is expected to answer it.
 */
export const HostTradeBenefitUsageSchema = z.object({
    /** Unique identifier for this usage record (UUID v4). */
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    /** The provider whose benefit was used. */
    hostTradeId: HostTradeIdSchema,

    /** The host who used the benefit. */
    hostUserId: UserIdSchema,

    /**
     * Which side opened this record — and therefore which side must confirm it.
     *
     * Both directions exist on purpose (OQ-1). If only the provider could
     * declare, he would decide which jobs are eligible to be reviewed, declare
     * the ones that went well, and the directory would trend to nothing but
     * five stars.
     */
    declaredBy: HostTradeUsageDeclaredByEnumSchema,

    /** The account that actually submitted the declaration. */
    declaredById: UserIdSchema,

    /** How the record came to exist. Lets abuse be audited per channel (R-5). */
    creationChannel: HostTradeUsageChannelEnumSchema,

    /** Current lifecycle state. Only `CONFIRMED` counts towards anything. */
    status: HostTradeUsageStatusEnumSchema,

    /** Calendar date of the service, as declared by whoever opened the record. */
    servicedAt: HostTradeUsageServicedAtSchema,

    /** Free-text note from the declarant. */
    note: z
        .string()
        .max(HOST_TRADE_USAGE_NOTE_MAX, { message: 'zodError.hostTradeUsage.note.max' })
        .nullish(),

    /** `declaredAt + 30 days`. The daily cron flips anything past this to EXPIRED. */
    expiresAt: z.coerce.date(),

    /** Idempotency marker for the day-10 reminder cron. Null until sent. */
    reminderSentAt: z.coerce.date().nullish(),

    /** When the counterpart confirmed. Null until confirmed. */
    confirmedAt: z.coerce.date().nullish(),
    /** Who confirmed. Null until confirmed. */
    confirmedById: UserIdSchema.nullish(),

    /** When the counterpart rejected. Null until rejected. */
    rejectedAt: z.coerce.date().nullish(),
    /** Who rejected. Null until rejected. */
    rejectedById: UserIdSchema.nullish(),
    /** Free-text reason attached to the rejection. */
    rejectionNote: z
        .string()
        .max(HOST_TRADE_USAGE_REJECTION_NOTE_MAX, {
            message: 'zodError.hostTradeUsage.rejectionNote.max'
        })
        .nullish(),

    // Shared audit + soft-delete fields
    ...BaseAuditFields
});

/** Inferred TypeScript type for a full benefit-usage record. */
export type HostTradeBenefitUsage = z.infer<typeof HostTradeBenefitUsageSchema>;
