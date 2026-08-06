import { describe, expect, it } from 'vitest';
import { PartnerContentReviewStateEnum } from '../../../enums/partner-content-review-state.enum.js';
import { PartnerTierEnum } from '../../../enums/partner-tier.enum.js';
import { PartnerTypeEnum } from '../../../enums/partner-type.enum.js';
import {
    PARTNER_OWNER_FORBIDDEN_FIELDS,
    PartnerOwnerUpdateSchema,
    PartnerOwnerViewSchema
} from '../partner.owner.schema.js';

/** A valid value for every forbidden field, so only the allowlist can reject it. */
const smuggled: Record<string, unknown> = {
    id: '00000000-0000-4000-a000-000000000001',
    name: 'Renamed By Owner',
    slug: 'renamed-by-owner',
    type: PartnerTypeEnum.NGO,
    tier: PartnerTierEnum.GOLD,
    planId: '00000000-0000-4000-a000-000000000002',
    subscriptionId: '00000000-0000-4000-a000-000000000003',
    subscriptionStatus: 'active',
    lifecycleState: 'ACTIVE',
    startsAt: new Date().toISOString(),
    endsAt: new Date().toISOString(),
    ownerUserId: '00000000-0000-4000-a000-000000000004',
    analytics: { impressions: 999 },
    pendingLogoUrl: 'https://cdn.example.com/sneaky.png',
    pendingDescription: 'sneaky',
    pendingWebsiteUrl: 'https://sneaky.example.com',
    contentReviewState: PartnerContentReviewStateEnum.APPROVED,
    contentReviewNote: 'sneaky',
    contentApprovedAt: new Date().toISOString(),
    contentApprovedById: '00000000-0000-4000-a000-000000000005',
    revokedAt: new Date().toISOString(),
    revokedById: '00000000-0000-4000-a000-000000000006',
    revokeReason: 'sneaky',
    unpaidNoticeSentAt: new Date().toISOString()
};

describe('PartnerOwnerUpdateSchema — server-side stripping', () => {
    it.each(
        PARTNER_OWNER_FORBIDDEN_FIELDS
    )('should strip %s from a partner payload instead of accepting it', (field) => {
        // Arrange — a well-formed content edit smuggling one field the
        // partner does not own. Every value is individually VALID, so
        // nothing but the allowlist can be what removes it.
        const payload = {
            description: 'Excursiones por el Litoral.',
            [field]: smuggled[field]
        };

        // Act
        const result = PartnerOwnerUpdateSchema.safeParse(payload);

        // Assert — parsing SUCCEEDS (a stripped key is not an error) but
        // the field is gone. That is the whole mechanism: the update never
        // sees a value it must not apply.
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty(field);
            expect(result.data.description).toBe('Excursiones por el Litoral.');
        }
    });

    it('names a value for every forbidden field, so no case is vacuous', () => {
        // Arrange — an entry missing from `smuggled` would make its `it.each`
        // case pass by smuggling `undefined`, which Zod strips regardless of
        // the allowlist. The test would look green and prove nothing.
        for (const field of PARTNER_OWNER_FORBIDDEN_FIELDS) {
            expect(smuggled[field], `no smuggled value for "${field}"`).toBeDefined();
        }
    });

    it('accepts the five fields a partner DOES own', () => {
        // Arrange
        const payload = {
            logoUrl: 'https://cdn.example.com/acme.png',
            description: 'Excursiones por el Litoral.',
            websiteUrl: 'https://acme.example.com',
            contactInfo: { workPhone: '+543442123456' },
            socialNetworks: { instagram: 'https://instagram.com/acme' }
        };

        // Act
        const result = PartnerOwnerUpdateSchema.safeParse(payload);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.logoUrl).toBe('https://cdn.example.com/acme.png');
            expect(result.data.contactInfo?.workPhone).toBe('+543442123456');
            expect(result.data.socialNetworks?.instagram).toBe('https://instagram.com/acme');
        }
    });

    it('accepts null for a cleared contact field but NOT for a cleared social link', () => {
        // Arrange — this asymmetry is why the form's payload builder omits an
        // emptied social link instead of nulling it. Pinning it here means a
        // future widening of either schema shows up as a failing test rather
        // than as a form that 400s.
        const contact = PartnerOwnerUpdateSchema.safeParse({
            contactInfo: { workPhone: null }
        });
        const social = PartnerOwnerUpdateSchema.safeParse({
            socialNetworks: { instagram: null }
        });

        // Act + Assert
        expect(contact.success).toBe(true);
        expect(social.success).toBe(false);
    });
});

describe('PartnerOwnerViewSchema — what the owner may READ', () => {
    it('carries the pending content and the payment gate', () => {
        // Arrange — the page cannot say "under review" or decide whether to
        // offer payment without these, so their absence would be a silent UI
        // regression rather than a type error.
        const shape = Object.keys(PartnerOwnerViewSchema.shape);

        // Act + Assert
        expect(shape).toContain('pendingLogoUrl');
        expect(shape).toContain('contentReviewState');
        expect(shape).toContain('contentReviewNote');
        expect(shape).toContain('contentApprovedAt');
    });

    it('does NOT leak the reviewing admin or the audit columns', () => {
        // Arrange
        const shape = Object.keys(PartnerOwnerViewSchema.shape);

        // Act + Assert — which admin approved it is an audit fact, not
        // something the partner needs.
        expect(shape).not.toContain('contentApprovedById');
        expect(shape).not.toContain('createdById');
        expect(shape).not.toContain('updatedById');
        expect(shape).not.toContain('deletedAt');
    });
});
