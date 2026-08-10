import { z } from 'zod';
import { HostTradeIdSchema } from '../../common/id.schema.js';
import { HostTradeCategoryEnumSchema } from '../../enums/host-trade-category.schema.js';
import { HostTradeBenefitUsageSchema } from './host-trade-usage.schema.js';

/**
 * @file host-trade-usage.access.schema.ts
 * @description Read tiers for benefit usages (HOS-376).
 *
 * There are only TWO tiers, and the missing one is the point.
 *
 * There is NO public tier. The host-trades routes have no public surface
 * (§7.5: "Sin tier público"), and the only usage data an anonymous visitor ever
 * sees is the AGGREGATE counter denormalised onto `host_trades` — "34 usos · 21
 * anfitriones". A usage ROW names two identifiable people and the date one was
 * at the other's home; there is no route that should ever serve it publicly.
 * Adding a `HostTradeBenefitUsagePublicSchema` "for symmetry" would create the
 * same dead scaffold the spec §5 calls out in `hasOwnerResponse`/`responseAfter`
 * — an unused shape that reads like an endorsement to build the route.
 */

/**
 * PROTECTED ACCESS SCHEMA
 *
 * What either party sees about a usage they are part of: the pending list, the
 * provider's history, the confirm/reject screen.
 *
 * The `*ById` audit columns and the soft-delete pair stay out, per the
 * established convention that they are admin-only. `confirmedAt`/`rejectedAt`
 * remain because the resolution DATE is what the history renders; who pressed
 * the button is already implied by `declaredBy` for the two people involved.
 */
export const HostTradeBenefitUsageProtectedSchema = HostTradeBenefitUsageSchema.pick({
    id: true,
    hostTradeId: true,
    hostUserId: true,
    declaredBy: true,
    declaredById: true,
    creationChannel: true,
    status: true,
    servicedAt: true,
    note: true,
    expiresAt: true,
    confirmedAt: true,
    rejectedAt: true,
    rejectionNote: true,
    createdAt: true,
    updatedAt: true
});

/** Inferred type for {@link HostTradeBenefitUsageProtectedSchema}. */
export type HostTradeBenefitUsageProtected = z.infer<typeof HostTradeBenefitUsageProtectedSchema>;

/**
 * The provider's identity, as a host's own usage rows carry it.
 *
 * Four fields and no more: enough to name the provider, link to its QR landing
 * page and label its trade. Everything else about a listing — the benefit text,
 * the contact, the counters — belongs to the directory read, and duplicating it
 * onto every usage row would make the two drift.
 */
export const HostTradeUsageProviderRefSchema = z.object({
    id: HostTradeIdSchema,
    slug: z.string().min(1),
    name: z.string().min(1),
    category: HostTradeCategoryEnumSchema
});

/** Inferred type for {@link HostTradeUsageProviderRefSchema}. */
export type HostTradeUsageProviderRef = z.infer<typeof HostTradeUsageProviderRefSchema>;

/**
 * A usage as the HOST's own screens read it: the row plus who the provider is.
 *
 * The plain row names its provider by uuid, which is unrenderable — the inbox
 * would ask a host to confirm work done by `a3f9…-8c21`. The host cannot resolve
 * it client-side either: the directory list is scoped to the destinations he
 * currently hosts in and excludes revoked listings, so precisely the oldest rows
 * would keep the raw id.
 *
 * `hostTrade` is NULLABLE rather than required. The FK cascades, so an
 * unresolvable provider should not happen — but the route factory validates the
 * response payload, and a required field would turn one unresolved name into a
 * 500 for the whole page instead of one row rendering a neutral label.
 */
export const HostTradeBenefitUsageWithProviderSchema = HostTradeBenefitUsageProtectedSchema.extend({
    hostTrade: HostTradeUsageProviderRefSchema.nullable()
});

/** Inferred type for {@link HostTradeBenefitUsageWithProviderSchema}. */
export type HostTradeBenefitUsageWithProvider = z.infer<
    typeof HostTradeBenefitUsageWithProviderSchema
>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * The full row, including the audit trail and soft-delete columns. Backs
 * `GET /admin/host-trades/usages`, which is where a suspected collusion pattern
 * gets looked at — and that investigation needs `creationChannel` and the
 * `*ById` columns to be able to tell a QR scan from an email lookup.
 */
export const HostTradeBenefitUsageAdminSchema = HostTradeBenefitUsageSchema;

/** Inferred type for {@link HostTradeBenefitUsageAdminSchema}. */
export type HostTradeBenefitUsageAdmin = z.infer<typeof HostTradeBenefitUsageAdminSchema>;
