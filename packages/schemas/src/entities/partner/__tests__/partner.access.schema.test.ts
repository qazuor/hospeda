import { describe, expect, it } from 'vitest';
import { PartnerTierEnum } from '../../../enums/partner-tier.enum.js';
import { PartnerTypeEnum } from '../../../enums/partner-type.enum.js';
import { PartnerPublicSchema } from '../partner.access.schema.js';

/**
 * A complete, valid public partner payload as the public endpoints return it.
 *
 * Every field is individually valid, so a failing assertion can only mean the
 * schema does not carry that field — never that the fixture is malformed.
 */
const basePayload = {
    id: '00000000-0000-4000-a000-000000000001',
    slug: 'acme-litoral',
    name: 'Acme Litoral',
    description: 'Excursiones por el Litoral.',
    type: PartnerTypeEnum.COMMERCE,
    tier: PartnerTierEnum.GOLD,
    logoUrl: 'https://cdn.example.com/acme.png',
    websiteUrl: 'https://acme.example.com',
    lifecycleState: 'ACTIVE',
    subscriptionStatus: 'active',
    startsAt: '2026-01-01T00:00:00.000Z',
    endsAt: null
};

/**
 * The fields the public schema carried BEFORE HOS-294 (D-5).
 *
 * Asserted explicitly rather than implied: the spec's §12 follow-up wants two
 * of these gone eventually, and the schema-compat policy says that removal is a
 * three-phase migration, not a field deleted in passing while adding others.
 */
const PRE_EXISTING_PUBLIC_FIELDS = [
    'id',
    'slug',
    'name',
    'description',
    'type',
    'tier',
    'logoUrl',
    'websiteUrl',
    'lifecycleState',
    'subscriptionStatus',
    'startsAt',
    'endsAt'
] as const;

describe('PartnerPublicSchema — the detail page payload (HOS-294 D-5)', () => {
    it('carries contactInfo through to the parsed output', () => {
        // Arrange — the detail page renders contact details, so the public
        // payload has to actually deliver them. Zod strips undeclared keys
        // silently, which is exactly the failure this asserts against.
        const payload = { ...basePayload, contactInfo: { workPhone: '+543442123456' } };

        // Act
        const result = PartnerPublicSchema.safeParse(payload);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.contactInfo?.workPhone).toBe('+543442123456');
        }
    });

    it('carries socialNetworks through to the parsed output', () => {
        // Arrange
        const payload = {
            ...basePayload,
            socialNetworks: { instagram: 'https://instagram.com/acme' }
        };

        // Act
        const result = PartnerPublicSchema.safeParse(payload);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.socialNetworks?.instagram).toBe('https://instagram.com/acme');
        }
    });

    it('still parses a payload that predates the two new fields', () => {
        // Arrange — the additive half of the compat policy: a stored or cached
        // response written before this change must keep parsing.
        // Act
        const result = PartnerPublicSchema.safeParse(basePayload);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.slug).toBe('acme-litoral');
        }
    });

    it.each(
        PRE_EXISTING_PUBLIC_FIELDS
    )('still declares the pre-existing public field %s', (field) => {
        // Arrange / Act — reading the shape directly, because a field
        // dropped from the pick would otherwise only surface as a missing
        // key in some consumer far from here.
        const shape = PartnerPublicSchema.shape as Record<string, unknown>;

        // Assert
        expect(shape[field], `"${field}" is no longer declared`).toBeDefined();
    });
});
