/**
 * Named regression cases for the partial-PATCH defect the generic guard covers.
 *
 * `no-defaults-in-patch-schemas.guard.test.ts` enforces the property across
 * every schema; this file spells out the instances whose consequence is worth
 * naming, so a future reader meets them as sentences rather than as rows in a
 * guard's failure output.
 *
 * All of these were found by the sweep after H-129 (Aug 2026 smoke), and each
 * was reachable through a real PATCH route in production.
 */

import { describe, expect, it } from 'vitest';
import { HostTradeOwnerUpdateSchema } from '../src/entities/host-trade/host-trade.owner.schema.js';
import { updatePartnerSchema } from '../src/entities/partner/partner.update.schema.js';
import { SocialCampaignUpdateSchema } from '../src/entities/social/social-campaign.crud.schema.js';
import { SocialPlatformFormatUpdateSchema } from '../src/entities/social/social-platform-format.crud.schema.js';
import { SocialPostFooterUpdateSchema } from '../src/entities/social/social-post-footer.crud.schema.js';

describe('a partial PATCH must not carry fields the caller never sent', () => {
    it('partner: editing the name does not wipe accumulated analytics', () => {
        // `analytics` carries `.default({})` and PartnerModel does NOT list it in
        // `mergeableJsonbColumns`, so the defaulted `{}` reached a literal SET and
        // erased the impressions/clicks `incrementAnalytics` had been counting.
        // Every admin edit of a partner destroyed its own traffic history.
        const parsed = updatePartnerSchema.parse({ name: 'Nombre nuevo' });

        expect(Object.hasOwn(parsed, 'analytics')).toBe(false);
    });

    it('host-trade: a provider updating their phone stays open 24h', () => {
        // The provider self-service PATCH sends only the field they touched. The
        // ADMIN update schema was already protected by SPEC-217; this one, built
        // straight off the entity, was not — so the provider's own edit was the
        // only path that could silently un-flag their listing.
        const parsed = HostTradeOwnerUpdateSchema.parse({ contact: '+54 9 3442 000000' });

        expect(Object.hasOwn(parsed, 'is24h')).toBe(false);
    });

    it('social post footer: renaming it does not strip its default-footer status', () => {
        // `isDefault` defaults to false, so renaming the footer marked as the
        // default demoted it — an inverted effect, and invisible until someone
        // noticed posts had stopped carrying a footer.
        const parsed = SocialPostFooterUpdateSchema.parse({ name: 'Pie institucional' });

        expect(Object.hasOwn(parsed, 'isDefault')).toBe(false);
        expect(Object.hasOwn(parsed, 'active')).toBe(false);
        expect(Object.hasOwn(parsed, 'priority')).toBe(false);
    });

    it('social campaign: editing a paused campaign does not restart it', () => {
        // `active` defaults to true. Editing any other field on a campaign an
        // admin had deliberately paused turned it back on, potentially resuming
        // publication nobody asked to resume.
        const parsed = SocialCampaignUpdateSchema.parse({ name: 'Campaña primavera' });

        expect(Object.hasOwn(parsed, 'active')).toBe(false);
    });

    it('social platform format: editing a caption limit does not disable its validations', () => {
        // The worst of the set: `requiresPublicUrl` and `requiresMedia` both
        // default to false, so an unrelated edit re-enabled a disabled format AND
        // switched off the checks that stop the pipeline publishing without the
        // media or URL that format requires.
        const parsed = SocialPlatformFormatUpdateSchema.parse({ maxCaptionLength: 2200 });

        expect(Object.hasOwn(parsed, 'enabled')).toBe(false);
        expect(Object.hasOwn(parsed, 'requiresPublicUrl')).toBe(false);
        expect(Object.hasOwn(parsed, 'requiresMedia')).toBe(false);
    });

    it('an explicitly sent false is still honoured — absence and false differ', () => {
        // The fix removes invented values, not intentional ones. Without this
        // case, "nothing is ever written" would also pass.
        const parsed = SocialCampaignUpdateSchema.parse({ active: false });

        expect(parsed.active).toBe(false);
    });
});
