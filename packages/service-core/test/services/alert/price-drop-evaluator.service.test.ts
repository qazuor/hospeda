/**
 * Unit tests for PriceDropEvaluatorService (SPEC-286 T-006).
 *
 * Strategy:
 *   - Mock `TouristPriceAlertModel` / `AccommodationModel` the way
 *     `alert-subscription.service.test.ts` does — no real DB.
 *   - Exercise `evaluatePriceDrops()` (the I/O orchestration) for the 6
 *     required edge cases from the task spec.
 *
 * AAA pattern throughout. One behaviour per test.
 */

import type { AccommodationModel, TouristPriceAlertModel } from '@repo/db';
import type { Accommodation, PriceAlert } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { calculatePriceDropMatch } from '../../../src/services/alert/price-drop-evaluator.service';
import { PriceDropEvaluatorService } from '../../../src/services/alert/price-drop-evaluator.service';
import { getMockId } from '../../factories/utilsFactory';

// ---------------------------------------------------------------------------
// Shared IDs
// ---------------------------------------------------------------------------

const USER_ID = getMockId('user', 'price-drop-user');
const ACCOMMODATION_ID = getMockId('accommodation', 'price-drop-accommodation');
const ALERT_ID = getMockId('accommodation', 'price-drop-alert-id');

const WINDOW_START = new Date('2026-06-30T08:00:00.000Z');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAlert(overrides: Partial<PriceAlert> = {}): PriceAlert {
    return {
        id: ALERT_ID,
        userId: USER_ID,
        accommodationId: ACCOMMODATION_ID,
        // 2_000_000 centavos == $20,000 ARS decimal — matches the accommodation
        // fixture's default `price.price: 20_000` before any drop.
        basePriceSnapshot: 2_000_000,
        targetPercentDrop: 10,
        isActive: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
        ...overrides
    };
}

/** Minimal accommodation shape consumed by the evaluator — price.price is decimal pesos. */
function makeAccommodation(
    overrides: Partial<{
        price: { price?: number; currency?: string } | null;
        updatedAt: Date;
        slug: string;
        name: string;
    }> = {}
): Accommodation {
    return {
        id: ACCOMMODATION_ID,
        slug: overrides.slug ?? 'hotel-test',
        name: overrides.name ?? 'Hotel Test',
        updatedAt: overrides.updatedAt ?? new Date('2026-06-30T09:00:00.000Z'),
        price:
            overrides.price === null ? null : { price: 20_000, currency: 'ARS', ...overrides.price }
    } as unknown as Accommodation;
}

function makeService(deps: {
    alerts: PriceAlert[];
    accommodations: Accommodation[];
    globalDefaultThresholdPercent?: number;
}) {
    const alertModel = {
        findAll: vi.fn().mockResolvedValue({ items: deps.alerts, total: deps.alerts.length })
    };
    const accommodationModel = {
        findByIds: vi.fn().mockResolvedValue(deps.accommodations)
    };

    const service = new PriceDropEvaluatorService({
        alertModel: alertModel as unknown as TouristPriceAlertModel,
        accommodationModel: accommodationModel as unknown as AccommodationModel,
        globalDefaultThresholdPercent: deps.globalDefaultThresholdPercent ?? 5
    });

    return { service, alertModel, accommodationModel };
}

// ---------------------------------------------------------------------------
// Pure computation
// ---------------------------------------------------------------------------

describe('calculatePriceDropMatch', () => {
    it('includes the match when the drop is past the threshold', () => {
        // Arrange
        const input = {
            alertId: ALERT_ID,
            userId: USER_ID,
            accommodationId: ACCOMMODATION_ID,
            accommodationSlug: 'hotel-test',
            accommodationName: 'Hotel Test',
            basePriceSnapshot: 1_000_000,
            currentPriceCentavos: 800_000, // 20% drop
            currency: 'ARS',
            targetPercentDrop: 10,
            globalDefaultThresholdPercent: 5
        };

        // Act
        const match = calculatePriceDropMatch(input);

        // Assert
        expect(match).not.toBeNull();
        expect(match?.dropPercent).toBe(20);
    });

    it('excludes the match when the drop is below the threshold', () => {
        // Arrange
        const input = {
            alertId: ALERT_ID,
            userId: USER_ID,
            accommodationId: ACCOMMODATION_ID,
            accommodationSlug: 'hotel-test',
            accommodationName: 'Hotel Test',
            basePriceSnapshot: 1_000_000,
            currentPriceCentavos: 950_000, // 5% drop, below the 10% threshold
            currency: 'ARS',
            targetPercentDrop: 10,
            globalDefaultThresholdPercent: 5
        };

        // Act
        const match = calculatePriceDropMatch(input);

        // Assert
        expect(match).toBeNull();
    });

    it('excludes the match when the price increased', () => {
        // Arrange
        const input = {
            alertId: ALERT_ID,
            userId: USER_ID,
            accommodationId: ACCOMMODATION_ID,
            accommodationSlug: 'hotel-test',
            accommodationName: 'Hotel Test',
            basePriceSnapshot: 1_000_000,
            currentPriceCentavos: 1_100_000, // price went UP
            currency: 'ARS',
            targetPercentDrop: 10,
            globalDefaultThresholdPercent: 5
        };

        // Act
        const match = calculatePriceDropMatch(input);

        // Assert
        expect(match).toBeNull();
    });

    it('excludes the match when the price is unchanged', () => {
        // Arrange
        const input = {
            alertId: ALERT_ID,
            userId: USER_ID,
            accommodationId: ACCOMMODATION_ID,
            accommodationSlug: 'hotel-test',
            accommodationName: 'Hotel Test',
            basePriceSnapshot: 1_000_000,
            currentPriceCentavos: 1_000_000, // no change → dropPercent === 0
            currency: 'ARS',
            targetPercentDrop: 10,
            globalDefaultThresholdPercent: 5
        };

        // Act
        const match = calculatePriceDropMatch(input);

        // Assert
        expect(match).toBeNull();
    });

    it('falls back to the global default threshold when targetPercentDrop is null', () => {
        // Arrange
        const input = {
            alertId: ALERT_ID,
            userId: USER_ID,
            accommodationId: ACCOMMODATION_ID,
            accommodationSlug: 'hotel-test',
            accommodationName: 'Hotel Test',
            basePriceSnapshot: 1_000_000,
            currentPriceCentavos: 940_000, // 6% drop
            currency: 'ARS',
            targetPercentDrop: null,
            globalDefaultThresholdPercent: 5 // 6% >= 5% default → matches
        };

        // Act
        const match = calculatePriceDropMatch(input);

        // Assert
        expect(match).not.toBeNull();
        expect(match?.dropPercent).toBeCloseTo(6);
    });
});

// ---------------------------------------------------------------------------
// I/O orchestration
// ---------------------------------------------------------------------------

describe('PriceDropEvaluatorService.evaluatePriceDrops', () => {
    it('includes a user whose alert dropped past its threshold', async () => {
        // Arrange
        const alert = makeAlert({ targetPercentDrop: 10, basePriceSnapshot: 2_000_000 });
        const accommodation = makeAccommodation({ price: { price: 16_000 } }); // 20% drop
        const { service } = makeService({ alerts: [alert], accommodations: [accommodation] });

        // Act
        const result = await service.evaluatePriceDrops({ since: WINDOW_START });

        // Assert
        expect(result.has(USER_ID)).toBe(true);
        const matches = result.get(USER_ID);
        expect(matches).toHaveLength(1);
        expect(matches?.[0]).toMatchObject({
            alertId: ALERT_ID,
            accommodationId: ACCOMMODATION_ID,
            basePriceSnapshot: 2_000_000,
            currentPrice: 1_600_000,
            dropPercent: 20
        });
    });

    it('excludes a user whose alert dropped but stayed below its threshold', async () => {
        // Arrange
        const alert = makeAlert({ targetPercentDrop: 25, basePriceSnapshot: 2_000_000 });
        const accommodation = makeAccommodation({ price: { price: 18_000 } }); // 10% drop
        const { service } = makeService({ alerts: [alert], accommodations: [accommodation] });

        // Act
        const result = await service.evaluatePriceDrops({ since: WINDOW_START });

        // Assert
        expect(result.has(USER_ID)).toBe(false);
    });

    it('excludes a user whose accommodation price increased', async () => {
        // Arrange
        const alert = makeAlert({ targetPercentDrop: 5, basePriceSnapshot: 2_000_000 });
        const accommodation = makeAccommodation({ price: { price: 25_000 } }); // price went up
        const { service } = makeService({ alerts: [alert], accommodations: [accommodation] });

        // Act
        const result = await service.evaluatePriceDrops({ since: WINDOW_START });

        // Assert
        expect(result.has(USER_ID)).toBe(false);
    });

    it('excludes a user whose accommodation price is unchanged', async () => {
        // Arrange
        const alert = makeAlert({ targetPercentDrop: 1, basePriceSnapshot: 2_000_000 });
        const accommodation = makeAccommodation({ price: { price: 20_000 } }); // same price
        const { service } = makeService({ alerts: [alert], accommodations: [accommodation] });

        // Act
        const result = await service.evaluatePriceDrops({ since: WINDOW_START });

        // Assert
        expect(result.has(USER_ID)).toBe(false);
    });

    it('uses the global default threshold when targetPercentDrop is null and the drop qualifies', async () => {
        // Arrange
        const alert = makeAlert({ targetPercentDrop: null, basePriceSnapshot: 2_000_000 });
        const accommodation = makeAccommodation({ price: { price: 18_800 } }); // 6% drop
        const { service } = makeService({
            alerts: [alert],
            accommodations: [accommodation],
            globalDefaultThresholdPercent: 5
        });

        // Act
        const result = await service.evaluatePriceDrops({ since: WINDOW_START });

        // Assert
        expect(result.has(USER_ID)).toBe(true);
        expect(result.get(USER_ID)?.[0]?.dropPercent).toBeCloseTo(6);
    });

    it('excludes an accommodation whose updatedAt is before the evaluation window', async () => {
        // Arrange
        const alert = makeAlert({ targetPercentDrop: 5, basePriceSnapshot: 2_000_000 });
        const accommodation = makeAccommodation({
            price: { price: 16_000 }, // 20% drop — would otherwise match
            updatedAt: new Date('2026-06-29T00:00:00.000Z') // before WINDOW_START
        });
        const { service } = makeService({ alerts: [alert], accommodations: [accommodation] });

        // Act
        const result = await service.evaluatePriceDrops({ since: WINDOW_START });

        // Assert
        expect(result.has(USER_ID)).toBe(false);
    });

    it('returns an empty map when there are no active alerts', async () => {
        // Arrange
        const { service, accommodationModel } = makeService({ alerts: [], accommodations: [] });

        // Act
        const result = await service.evaluatePriceDrops({ since: WINDOW_START });

        // Assert
        expect(result.size).toBe(0);
        expect(accommodationModel.findByIds).not.toHaveBeenCalled();
    });

    it('pages through more than one page of active alerts', async () => {
        // Arrange
        const alertModel = { findAll: vi.fn() };
        const accommodation = makeAccommodation({ price: { price: 16_000 } }); // 20% drop
        const accommodationModel = { findByIds: vi.fn().mockResolvedValue([accommodation]) };

        // First page comes back full (200 items) so the service must request page 2.
        const fullPage = Array.from({ length: 200 }, (_, i) =>
            makeAlert({ id: `${ALERT_ID}-${i}`, targetPercentDrop: 5 })
        );
        const secondPage = [makeAlert({ id: `${ALERT_ID}-last`, targetPercentDrop: 5 })];
        alertModel.findAll
            .mockResolvedValueOnce({ items: fullPage, total: 201 })
            .mockResolvedValueOnce({ items: secondPage, total: 201 });

        const service = new PriceDropEvaluatorService({
            alertModel: alertModel as unknown as TouristPriceAlertModel,
            accommodationModel: accommodationModel as unknown as AccommodationModel,
            globalDefaultThresholdPercent: 5
        });

        // Act
        const result = await service.evaluatePriceDrops({ since: WINDOW_START });

        // Assert
        expect(alertModel.findAll).toHaveBeenCalledTimes(2);
        expect(result.get(USER_ID)).toHaveLength(fullPage.length + secondPage.length);
    });
});
