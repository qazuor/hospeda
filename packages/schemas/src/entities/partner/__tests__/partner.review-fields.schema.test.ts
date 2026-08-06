import { describe, expect, it } from 'vitest';
import { PartnerContentReviewStateEnum } from '../../../enums/partner-content-review-state.enum.js';
import { PartnerTierEnum } from '../../../enums/partner-tier.enum.js';
import { PartnerTypeEnum } from '../../../enums/partner-type.enum.js';
import { createPartnerSchema } from '../partner.create.schema.js';
import { PARTNER_REVIEW_MANAGED_FIELDS, partnerSchema } from '../partner.schema.js';
import { updatePartnerSchema } from '../partner.update.schema.js';

/** A valid value for each review-managed field, so only the allowlist can reject it. */
const smuggled: Record<string, unknown> = {
    pendingLogoUrl: 'https://cdn.example.com/sneaky.png',
    pendingDescription: 'sneaky',
    pendingWebsiteUrl: 'https://sneaky.example.com',
    contentReviewState: PartnerContentReviewStateEnum.APPROVED,
    contentReviewNote: 'sneaky',
    contentApprovedAt: new Date().toISOString(),
    contentApprovedById: '00000000-0000-4000-a000-000000000003'
};

const REVIEW_FIELDS = Object.keys(PARTNER_REVIEW_MANAGED_FIELDS);

/** A minimal payload the create schema accepts on its own. */
const baseCreate = {
    slug: 'acme-turismo',
    name: 'Acme Turismo',
    type: PartnerTypeEnum.COMMERCE,
    tier: PartnerTierEnum.SILVER,
    subscriptionStatus: 'pending',
    lifecycleState: 'DRAFT'
};

describe('PARTNER_REVIEW_MANAGED_FIELDS — the mask itself', () => {
    it('names every review column the base schema declares, and nothing else', () => {
        // Arrange — the mask is what both create and update spread. If a new
        // review column is added to `partnerSchema` and forgotten here, it
        // silently becomes writable through an ordinary admin PATCH.
        const declared = Object.keys(partnerSchema.shape).filter(
            (key) =>
                key.startsWith('pending') ||
                key.startsWith('contentReview') ||
                key.startsWith('contentApproved')
        );

        // Act + Assert
        expect([...REVIEW_FIELDS].sort()).toEqual(declared.sort());
    });
});

describe('createPartnerSchema — HOS-278 AC-11 review fields are not settable', () => {
    it.each(REVIEW_FIELDS)('strips %s from an admin create payload', (field) => {
        // Arrange
        const payload = { ...baseCreate, [field]: smuggled[field] };

        // Act
        const result = createPartnerSchema.safeParse(payload);

        // Assert — parsing SUCCEEDS (a stripped key is not an error) but the
        // field is gone, so nobody can hand themselves an approved partner at
        // creation time. `PartnerService._beforeCreate` is the only writer.
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty(field);
            expect(result.data.name).toBe('Acme Turismo');
        }
    });
});

describe('updatePartnerSchema — HOS-278 AC-11 review fields are not settable', () => {
    it.each(REVIEW_FIELDS)('strips %s from an admin update payload', (field) => {
        // Arrange — an ordinary edit smuggling one review column. Approving is
        // meant to be a decision someone made on the review endpoint, never a
        // field that rode along inside a rename.
        const payload = { name: 'Acme Turismo SRL', [field]: smuggled[field] };

        // Act
        const result = updatePartnerSchema.safeParse(payload);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty(field);
            expect(result.data.name).toBe('Acme Turismo SRL');
        }
    });
});

describe('partnerSchema — the read shape still carries them', () => {
    it('accepts a partner row with the review columns populated', () => {
        // Arrange — stripping them from the WRITE schemas must not make them
        // unreadable, or the admin could never see what is pending.
        const row = {
            id: '00000000-0000-4000-a000-000000000001',
            ...baseCreate,
            analytics: {},
            ...smuggled,
            contentReviewState: PartnerContentReviewStateEnum.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: '00000000-0000-4000-a000-000000000004',
            updatedById: '00000000-0000-4000-a000-000000000004'
        };

        // Act
        const result = partnerSchema.safeParse(row);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.pendingLogoUrl).toBe('https://cdn.example.com/sneaky.png');
            expect(result.data.contentReviewState).toBe(PartnerContentReviewStateEnum.PENDING);
            expect(result.data.contentApprovedAt).toBeInstanceOf(Date);
        }
    });
});
