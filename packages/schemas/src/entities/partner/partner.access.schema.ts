import type { z as Zod } from 'zod';
import { z } from 'zod';
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
 * both. `lifecycleState` is constant by construction on every public response
 * (`PartnerModel.findByFilters` requires `ACTIVE`), but dropping a shipped field
 * is a three-phase migration under the schema-compat policy. The former
 * `subscriptionStatus` field left with its column (HOS-1419).
 */
export const PartnerPublicSchema = partnerSchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    type: true,
    logoUrl: true,
    websiteUrl: true,
    lifecycleState: true,
    contactInfo: true,
    socialNetworks: true
});

export type PartnerPublic = Zod.infer<typeof PartnerPublicSchema>;

/**
 * Carousel payload with the owner's current page entitlement.
 * AC:V7:13; V7 §1.2: Gold grants the page and the carousel, Silver only the carousel.
 */
export const PartnerCarouselItemSchema = PartnerPublicSchema.extend({
    hasPublicPage: z.boolean()
});

export type PartnerCarouselItem = Zod.infer<typeof PartnerCarouselItemSchema>;
