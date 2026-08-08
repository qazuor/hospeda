import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { HostTradeUsageChannelEnumSchema } from '../../enums/host-trade-usage-channel.schema.js';
import { HostTradeUsageDeclaredByEnumSchema } from '../../enums/host-trade-usage-declared-by.schema.js';
import { HostTradeUsageStatusEnumSchema } from '../../enums/host-trade-usage-status.schema.js';

/**
 * HostTradeBenefitUsageAdminSearchSchema — filters for
 * `GET /admin/host-trades/usages` (HOS-376 §7.5).
 *
 * Extends `AdminSearchBaseSchema` (page, pageSize, search, sort, status,
 * includeDeleted, createdAfter, createdBefore) with the domain filters.
 *
 * `status` REPLACES the base field rather than adding to it, and the override is
 * load-bearing. `AdminSearchBaseSchema.status` is
 * `z.enum(['all', ...LifecycleStatusEnum]).default('all')` — a LIFECYCLE filter
 * (`DRAFT`/`ACTIVE`/`ARCHIVED`) that has nothing to do with this state machine.
 * Left as inherited it would reject the only values worth filtering on here
 * (`?status=PENDING` would 400) while accepting three that mean nothing to a
 * usage row.
 *
 * The base's `.default('all')` is dropped with it, deliberately: `'all'` is a
 * sentinel this domain has no use for, since an absent `status` already means
 * "do not filter".
 *
 * @example
 * ```ts
 * const params = HostTradeBenefitUsageAdminSearchSchema.parse({
 *   status: 'REJECTED',
 *   creationChannel: 'EMAIL_LOOKUP'
 * });
 * ```
 */
export const HostTradeBenefitUsageAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by provider. */
    hostTradeId: z.string().uuid().optional(),

    /** Filter by host. */
    hostUserId: z.string().uuid().optional(),

    /** Filter by lifecycle state. Narrows the base schema's free-form string. */
    status: HostTradeUsageStatusEnumSchema.optional(),

    /** Filter by which side opened the record. */
    declaredBy: HostTradeUsageDeclaredByEnumSchema.optional(),

    /**
     * Filter by channel.
     *
     * The one filter built for abuse triage: the email fallback is the only
     * channel a provider can drive without the host being present (R-5), so
     * isolating `EMAIL_LOOKUP` is how a suspected spam pattern gets read.
     */
    creationChannel: HostTradeUsageChannelEnumSchema.optional()
});

/** Inferred type for {@link HostTradeBenefitUsageAdminSearchSchema}. */
export type HostTradeBenefitUsageAdminSearch = z.infer<
    typeof HostTradeBenefitUsageAdminSearchSchema
>;
