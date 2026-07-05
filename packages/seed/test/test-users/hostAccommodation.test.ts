/**
 * Unit tests for the pure, DB-free builders in `hostAccommodation.ts` (HOS-30).
 *
 * `ensureHostAccommodation` itself (the DB-orchestrating idempotency check +
 * AccommodationService.create + junction inserts) is NOT unit tested here —
 * it requires a live database, matching the existing precedent in this
 * package: `testUsers.seed.ts`'s own DB-touching helpers (`ensureBillingCustomer`,
 * `ensureSubscription`, etc.) have no unit test coverage either, and are
 * excluded from the coverage gate in `vitest.config.ts`. Only the pure
 * `markUserReady` helper (port-injected) is unit tested — this file follows
 * the same split: unit-test what's pure, verify the DB-touching path via a
 * real `pnpm db:seed:test-users` run instead.
 */
import { AccommodationCreateInputSchema, AccommodationTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    ACCOMMODATION_TYPE_BY_EMAIL,
    buildHostAccommodationCoreFields,
    buildHostAccommodationPrice
} from '../../src/test-users/hostAccommodation.js';

const VALID_OWNER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_DESTINATION_ID = '22222222-2222-4222-8222-222222222222';
const VALID_COORDINATES = { lat: '-32.4833', long: '-58.2283' };

describe('buildHostAccommodationPrice', () => {
    it('should return a rich Tier-3-equivalent price block for a mapped type', () => {
        // Arrange / Act
        const price = buildHostAccommodationPrice(AccommodationTypeEnum.HOUSE);

        // Assert
        expect(price.price).toBeGreaterThan(0);
        expect(price.currency).toBe('ARS');
        expect(price.additionalFees).toBeDefined();
        expect(price.discounts).toBeDefined();
        // 3-5 named fees + others[] (Tier-3 shape per apply-pricing-tiers.ts).
        const namedFeeCount = Object.keys(price.additionalFees ?? {}).filter(
            (key) => key !== 'others'
        ).length;
        expect(namedFeeCount).toBeGreaterThanOrEqual(3);
        expect(namedFeeCount).toBeLessThanOrEqual(5);
        expect(price.additionalFees?.others).toHaveLength(1);
        // 1-2 discounts + others[].
        const namedDiscountCount = Object.keys(price.discounts ?? {}).filter(
            (key) => key !== 'others'
        ).length;
        expect(namedDiscountCount).toBeGreaterThanOrEqual(1);
        expect(namedDiscountCount).toBeLessThanOrEqual(2);
        expect(price.discounts?.others).toHaveLength(1);
    });

    it('should fall back to a default base price for an unmapped type', () => {
        // Arrange / Act
        const price = buildHostAccommodationPrice(AccommodationTypeEnum.RESORT);

        // Assert
        expect(price.price).toBe(60000);
    });

    it('should produce a different base price per accommodation type', () => {
        // Arrange / Act
        const housePrice = buildHostAccommodationPrice(AccommodationTypeEnum.HOUSE);
        const hostelPrice = buildHostAccommodationPrice(AccommodationTypeEnum.HOSTEL);

        // Assert
        expect(housePrice.price).not.toBe(hostelPrice.price);
    });
});

describe('buildHostAccommodationCoreFields', () => {
    const hostEmails = Object.keys(ACCOMMODATION_TYPE_BY_EMAIL);

    it('should cover all 5 HOST test-user emails with a distinct accommodation type', () => {
        // Assert
        expect(hostEmails).toHaveLength(5);
        const types = new Set(Object.values(ACCOMMODATION_TYPE_BY_EMAIL));
        expect(types.size).toBe(5);
    });

    it.each(
        hostEmails
    )('should build a schema-valid AccommodationCreateInput payload for %s', (email) => {
        // Arrange
        const displayName = email.split('@')[0] ?? email;

        // Act
        const fields = buildHostAccommodationCoreFields({
            spec: { email, displayName },
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID,
            coordinates: VALID_COORDINATES
        });
        const result = AccommodationCreateInputSchema.safeParse(fields);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should derive a stable, unique slug per host from the email local-part', () => {
        // Arrange / Act
        const slugs = hostEmails.map(
            (email) =>
                buildHostAccommodationCoreFields({
                    spec: { email, displayName: email },
                    ownerId: VALID_OWNER_ID,
                    destinationId: VALID_DESTINATION_ID,
                    coordinates: VALID_COORDINATES
                }).slug
        );

        // Assert
        expect(new Set(slugs).size).toBe(hostEmails.length);
        for (const slug of slugs) {
            expect(slug).toMatch(/^alojamiento-completo-/);
        }
    });

    it('should fall back to APARTMENT for an email not in the known HOST matrix', () => {
        // Arrange / Act
        const fields = buildHostAccommodationCoreFields({
            spec: { email: 'unknown-host@local.test', displayName: 'Unknown Host' },
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID,
            coordinates: VALID_COORDINATES
        });

        // Assert
        expect(fields.type).toBe(AccommodationTypeEnum.APARTMENT);
    });

    it('should set the owner and destination ids from the input, not hardcoded values', () => {
        // Arrange / Act
        const fields = buildHostAccommodationCoreFields({
            spec: { email: 'host-pro@local.test', displayName: 'Host Pro' },
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID,
            coordinates: VALID_COORDINATES
        });

        // Assert
        expect(fields.ownerId).toBe(VALID_OWNER_ID);
        expect(fields.destinationId).toBe(VALID_DESTINATION_ID);
        expect(fields.location?.coordinates).toEqual(VALID_COORDINATES);
    });

    it('should mark the fixture as ACTIVE / PUBLIC / APPROVED per seed moderation conventions', () => {
        // Arrange / Act
        const fields = buildHostAccommodationCoreFields({
            spec: { email: 'host-pro@local.test', displayName: 'Host Pro' },
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID,
            coordinates: VALID_COORDINATES
        });

        // Assert
        expect(fields.lifecycleState).toBe('ACTIVE');
        expect(fields.visibility).toBe('PUBLIC');
        expect(fields.moderationState).toBe('APPROVED');
    });

    it('should identify the fixture as seed/test content tied to the owner in name and description', () => {
        // Arrange / Act
        const fields = buildHostAccommodationCoreFields({
            spec: { email: 'host-pro@local.test', displayName: 'Host Pro' },
            ownerId: VALID_OWNER_ID,
            destinationId: VALID_DESTINATION_ID,
            coordinates: VALID_COORDINATES
        });

        // Assert
        expect(fields.name).toContain('Host Pro');
        expect(fields.description).toContain('HOS-30');
        expect(fields.description).toContain('prueba');
    });
});
