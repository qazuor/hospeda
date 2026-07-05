/**
 * Unit tests for the pure, DB-free builders in `hostPromotion.ts` (BETA-89).
 *
 * `ensureHostPromotion` itself (the DB-orchestrating idempotency check +
 * OwnerPromotionService.create) is NOT unit tested here — it requires a live
 * database, matching the existing precedent in this package: see the header
 * comment in `hostAccommodation.test.ts`. Only the pure builders
 * (`buildHostPromotionInputs`, `utcMidnightOffset`, `todayAtUtcMidnight`,
 * `emailLocalPart`) are unit tested — the DB-touching path is verified via a
 * real `pnpm db:seed:test-users` run instead.
 */
import { OwnerPromotionCreateInputSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildHostPromotionInputs,
    emailLocalPart,
    todayAtUtcMidnight,
    utcMidnightOffset
} from '../../src/test-users/hostPromotion.js';

const VALID_OWNER_ID = '11111111-1111-4111-8111-111111111111';
const VALID_ACCOMMODATION_ID = '33333333-3333-4333-8333-333333333333';

describe('emailLocalPart', () => {
    it('should return the portion before the @', () => {
        expect(emailLocalPart('host-pro@local.test')).toBe('host-pro');
    });

    it('should return the whole string when there is no @', () => {
        expect(emailLocalPart('no-at-sign')).toBe('no-at-sign');
    });
});

describe('todayAtUtcMidnight', () => {
    it('should return a Date with zeroed UTC hours/minutes/seconds/ms', () => {
        // Act
        const today = todayAtUtcMidnight();

        // Assert
        expect(today.getUTCHours()).toBe(0);
        expect(today.getUTCMinutes()).toBe(0);
        expect(today.getUTCSeconds()).toBe(0);
        expect(today.getUTCMilliseconds()).toBe(0);
    });
});

describe('utcMidnightOffset', () => {
    it('should offset forward by whole UTC days without shifting the time-of-day', () => {
        // Arrange
        const anchor = new Date(Date.UTC(2026, 0, 15)); // 2026-01-15T00:00:00.000Z

        // Act
        const result = utcMidnightOffset(anchor, 7);

        // Assert
        expect(result.toISOString()).toBe('2026-01-22T00:00:00.000Z');
    });

    it('should offset backward for negative day counts', () => {
        // Arrange
        const anchor = new Date(Date.UTC(2026, 0, 15));

        // Act
        const result = utcMidnightOffset(anchor, -10);

        // Assert
        expect(result.toISOString()).toBe('2026-01-05T00:00:00.000Z');
    });

    it('should roll over month/year boundaries correctly (BETA-88 regression guard)', () => {
        // Arrange — anchor near a year boundary, where a naive local-timezone
        // `setDate` off-by-one would be most visible.
        const anchor = new Date(Date.UTC(2026, 0, 1)); // 2026-01-01T00:00:00.000Z

        // Act
        const result = utcMidnightOffset(anchor, -1);

        // Assert
        expect(result.toISOString()).toBe('2025-12-31T00:00:00.000Z');
    });

    it('should always return a UTC-midnight instant regardless of offset sign', () => {
        // Arrange
        const anchor = todayAtUtcMidnight();

        // Act / Assert
        for (const days of [-90, -10, -1, 0, 7, 60]) {
            const result = utcMidnightOffset(anchor, days);
            expect(result.getUTCHours()).toBe(0);
            expect(result.getUTCMinutes()).toBe(0);
            expect(result.getUTCSeconds()).toBe(0);
            expect(result.getUTCMilliseconds()).toBe(0);
        }
    });
});

describe('buildHostPromotionInputs', () => {
    const today = todayAtUtcMidnight();

    it('should build schema-valid OwnerPromotionCreateInput payloads for both promotions', () => {
        // Arrange / Act
        const { active, expired } = buildHostPromotionInputs({
            spec: { email: 'host-pro@local.test', displayName: 'Host Pro' },
            ownerId: VALID_OWNER_ID,
            accommodationId: VALID_ACCOMMODATION_ID,
            today
        });

        // Assert
        expect(OwnerPromotionCreateInputSchema.safeParse(active).success).toBe(true);
        expect(OwnerPromotionCreateInputSchema.safeParse(expired).success).toBe(true);
    });

    it('should set the owner and accommodation ids from the input, not hardcoded values', () => {
        // Arrange / Act
        const { active, expired } = buildHostPromotionInputs({
            spec: { email: 'host-pro@local.test', displayName: 'Host Pro' },
            ownerId: VALID_OWNER_ID,
            accommodationId: VALID_ACCOMMODATION_ID,
            today
        });

        // Assert
        expect(active.ownerId).toBe(VALID_OWNER_ID);
        expect(active.accommodationId).toBe(VALID_ACCOMMODATION_ID);
        expect(expired.ownerId).toBe(VALID_OWNER_ID);
        expect(expired.accommodationId).toBe(VALID_ACCOMMODATION_ID);
    });

    it('should derive distinct, stable slugs per host from the email local-part', () => {
        // Arrange / Act
        const { active, expired } = buildHostPromotionInputs({
            spec: { email: 'host-premium@local.test', displayName: 'Host Premium' },
            ownerId: VALID_OWNER_ID,
            accommodationId: VALID_ACCOMMODATION_ID,
            today
        });

        // Assert
        expect(active.slug).toBe('promo-activa-host-premium');
        expect(expired.slug).toBe('promo-vencida-host-premium');
        expect(active.slug).not.toBe(expired.slug);
    });

    it('should mark the active promotion ACTIVE with a currently-valid date window', () => {
        // Arrange / Act
        const { active } = buildHostPromotionInputs({
            spec: { email: 'host-basico@local.test', displayName: 'Host Basico' },
            ownerId: VALID_OWNER_ID,
            accommodationId: VALID_ACCOMMODATION_ID,
            today
        });

        // Assert
        expect(active.lifecycleState).toBe('ACTIVE');
        expect(active.validFrom.getTime()).toBeLessThanOrEqual(today.getTime());
        expect(active.validUntil).toBeTruthy();
        expect((active.validUntil as Date).getTime()).toBeGreaterThan(today.getTime());
    });

    it('should mark the expired promotion ARCHIVED with a past date window', () => {
        // Arrange / Act
        const { expired } = buildHostPromotionInputs({
            spec: { email: 'host-basico@local.test', displayName: 'Host Basico' },
            ownerId: VALID_OWNER_ID,
            accommodationId: VALID_ACCOMMODATION_ID,
            today
        });

        // Assert
        expect(expired.lifecycleState).toBe('ARCHIVED');
        expect(expired.validFrom.getTime()).toBeLessThan(today.getTime());
        expect(expired.validUntil).toBeTruthy();
        expect((expired.validUntil as Date).getTime()).toBeLessThan(today.getTime());
    });

    it('should build UTC-midnight validFrom/validUntil instants (BETA-88 regression guard)', () => {
        // Arrange / Act
        const { active, expired } = buildHostPromotionInputs({
            spec: { email: 'host-pro@local.test', displayName: 'Host Pro' },
            ownerId: VALID_OWNER_ID,
            accommodationId: VALID_ACCOMMODATION_ID,
            today
        });

        // Assert
        for (const date of [
            active.validFrom,
            active.validUntil,
            expired.validFrom,
            expired.validUntil
        ]) {
            expect(date).toBeInstanceOf(Date);
            const d = date as Date;
            expect(d.getUTCHours()).toBe(0);
            expect(d.getUTCMinutes()).toBe(0);
            expect(d.getUTCSeconds()).toBe(0);
            expect(d.getUTCMilliseconds()).toBe(0);
        }
    });

    it('should identify both promotions as seed/test content tied to BETA-89 in the description', () => {
        // Arrange / Act
        const { active, expired } = buildHostPromotionInputs({
            spec: { email: 'host-pro@local.test', displayName: 'Host Pro' },
            ownerId: VALID_OWNER_ID,
            accommodationId: VALID_ACCOMMODATION_ID,
            today
        });

        // Assert
        expect(active.description).toContain('BETA-89');
        expect(expired.description).toContain('BETA-89');
    });
});
