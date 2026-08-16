import { z } from 'zod';
import { stripShapeDefaults } from '../../utils/utils.js';
import {
    PARTNER_REAPER_MANAGED_FIELDS,
    PARTNER_REVIEW_MANAGED_FIELDS,
    PARTNER_REVOKE_MANAGED_FIELDS,
    partnerSchema
} from './partner.schema.js';

/**
 * Update partner schema
 * All fields optional except id, excludes createdAt/createdById
 *
 * `ownerUserId` is omitted deliberately (HOS-278 D1). Ownership is written by
 * exactly two paths — provisioning an approved lead, and the claim that
 * backfills an anonymous applicant — and neither goes through this schema. An
 * admin editing a partner must not be able to hand the listing to a different
 * account as an unremarkable field edit; `host_trades` forbids the same field
 * for the same reason (`HOST_TRADE_OWNER_FORBIDDEN_FIELDS`).
 *
 * The content-review columns are omitted too — see
 * {@link PARTNER_REVIEW_MANAGED_FIELDS}. `POST /admin/partners/{id}/review-content`
 * is the only way to move them, so an approval is always a decision someone
 * made on purpose and never a field that rode along inside an unrelated PATCH.
 *
 * `analytics` carries `.default({})`, and `PartnerModel` does NOT list it in
 * `mergeableJsonbColumns` — so without `stripShapeDefaults` an admin editing a
 * partner's name wiped the accumulated `impressions` / `clicks` that
 * `incrementAnalytics` had been counting in production. *
 * `stripShapeDefaults` is load-bearing: in Zod 4 `.partial()` does NOT suppress
 * a `.default()`, so a PATCH omitting a defaulted field parses that field back
 * in and the literal SQL `SET` overwrites it. See the guard in
 * `test/no-defaults-in-patch-schemas.guard.test.ts`.
 */
export const updatePartnerSchema = z
    .object(
        stripShapeDefaults(
            partnerSchema.omit({
                ...PARTNER_REVIEW_MANAGED_FIELDS,
                ...PARTNER_REVOKE_MANAGED_FIELDS,
                ...PARTNER_REAPER_MANAGED_FIELDS,
                id: true,
                createdAt: true,
                createdById: true,
                ownerUserId: true
            }).shape
        )
    )
    .partial();

export type UpdatePartner = z.infer<typeof updatePartnerSchema>;
