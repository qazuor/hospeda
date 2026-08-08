import type { z } from 'zod';
import { partnerSchema } from './partner.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 *
 * GROWS ADDITIVELY ONLY (HOS-294 D-5). `contactInfo` and `socialNetworks` were
 * added for the gold partner's own page at `/partners/<slug>/`, which renders
 * both. Nothing was removed in the same change on purpose: `subscriptionStatus`
 * and `lifecycleState` are constant by construction on every public response —
 * `PartnerModel.findByFilters` already requires `ACTIVE`/`active` — so they
 * inform no consumer and leak commercial state, but dropping a shipped field is
 * a three-phase migration under the schema-compat policy, not a line deleted
 * while adding others. Tracked as a separate follow-up.
 */
export const PartnerPublicSchema = partnerSchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    type: true,
    tier: true,
    logoUrl: true,
    websiteUrl: true,
    lifecycleState: true,
    subscriptionStatus: true,
    startsAt: true,
    endsAt: true,
    contactInfo: true,
    socialNetworks: true
});

export type PartnerPublic = z.infer<typeof PartnerPublicSchema>;
