import type { z } from 'zod';
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
