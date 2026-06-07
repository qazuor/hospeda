/**
 * Unit tests for KeepSelectionsSchema and the keepSelections extension
 * on PlanChangeRequestSchema (SPEC-167 T-015).
 *
 * Coverage:
 * - KeepSelectionsSchema: valid shapes, optional fields, uuid enforcement,
 *   url enforcement, photoKeepMap key (uuid) + value (url array), empty arrays.
 * - PlanChangeRequestSchema: keepSelections accepted on a downgrade-direction
 *   request; keepSelections omitted is valid (backward-compat); invalid
 *   keepSelections shapes surface errors.
 *
 * @module test/api/billing/keep-selections.schema
 */

import { describe, expect, it } from 'vitest';
import {
    type KeepSelections,
    KeepSelectionsSchema
} from '../../../src/api/billing/downgrade-preview.schema.js';
import { PlanChangeRequestSchema } from '../../../src/api/billing/plan-change.schema.js';
import { BillingIntervalEnum } from '../../../src/enums/billing-interval.enum.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_UUID_1 = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_2 = '22222222-2222-4222-8222-222222222222';
const VALID_URL_1 = 'https://cdn.example.com/img1.jpg';
const VALID_URL_2 = 'https://cdn.example.com/img2.jpg';

function makeFullSelections(): KeepSelections {
    return {
        accommodationIds: [VALID_UUID_1],
        promotionIds: [VALID_UUID_2],
        photoKeepMap: {
            [VALID_UUID_1]: [VALID_URL_1, VALID_URL_2]
        }
    };
}

// ---------------------------------------------------------------------------
// KeepSelectionsSchema
// ---------------------------------------------------------------------------

describe('KeepSelectionsSchema', () => {
    describe('valid inputs', () => {
        it('accepts a fully populated selection', () => {
            const result = KeepSelectionsSchema.safeParse(makeFullSelections());
            expect(result.success).toBe(true);
        });

        it('accepts an empty object (all fields optional)', () => {
            const result = KeepSelectionsSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('accepts only accommodationIds', () => {
            const result = KeepSelectionsSchema.safeParse({
                accommodationIds: [VALID_UUID_1]
            });
            expect(result.success).toBe(true);
        });

        it('accepts only promotionIds', () => {
            const result = KeepSelectionsSchema.safeParse({
                promotionIds: [VALID_UUID_2]
            });
            expect(result.success).toBe(true);
        });

        it('accepts only photoKeepMap', () => {
            const result = KeepSelectionsSchema.safeParse({
                photoKeepMap: { [VALID_UUID_1]: [VALID_URL_1] }
            });
            expect(result.success).toBe(true);
        });

        it('accepts empty accommodationIds array (treated as absent at apply time)', () => {
            const result = KeepSelectionsSchema.safeParse({
                accommodationIds: [],
                promotionIds: [],
                photoKeepMap: {}
            });
            expect(result.success).toBe(true);
        });

        it('accepts multiple UUIDs in accommodationIds', () => {
            const result = KeepSelectionsSchema.safeParse({
                accommodationIds: [VALID_UUID_1, VALID_UUID_2]
            });
            expect(result.success).toBe(true);
        });

        it('accepts photoKeepMap with multiple accommodations', () => {
            const result = KeepSelectionsSchema.safeParse({
                photoKeepMap: {
                    [VALID_UUID_1]: [VALID_URL_1],
                    [VALID_UUID_2]: [VALID_URL_2]
                }
            });
            expect(result.success).toBe(true);
        });

        it('preserves parsed values exactly', () => {
            const input = makeFullSelections();
            const result = KeepSelectionsSchema.safeParse(input);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.accommodationIds).toEqual([VALID_UUID_1]);
                expect(result.data.promotionIds).toEqual([VALID_UUID_2]);
                expect(result.data.photoKeepMap?.[VALID_UUID_1]).toEqual([
                    VALID_URL_1,
                    VALID_URL_2
                ]);
            }
        });
    });

    describe('UUID enforcement — accommodationIds', () => {
        it('rejects non-UUID strings in accommodationIds', () => {
            const result = KeepSelectionsSchema.safeParse({
                accommodationIds: ['not-a-uuid']
            });
            expect(result.success).toBe(false);
        });

        it('rejects plain integers in accommodationIds', () => {
            const result = KeepSelectionsSchema.safeParse({
                accommodationIds: [123]
            });
            expect(result.success).toBe(false);
        });

        it('rejects an empty-string UUID in accommodationIds', () => {
            const result = KeepSelectionsSchema.safeParse({
                accommodationIds: ['']
            });
            expect(result.success).toBe(false);
        });
    });

    describe('UUID enforcement — promotionIds', () => {
        it('rejects non-UUID strings in promotionIds', () => {
            const result = KeepSelectionsSchema.safeParse({
                promotionIds: ['promo-123']
            });
            expect(result.success).toBe(false);
        });

        it('rejects plain integers in promotionIds', () => {
            const result = KeepSelectionsSchema.safeParse({
                promotionIds: [456]
            });
            expect(result.success).toBe(false);
        });
    });

    describe('photoKeepMap — key UUID + value URL enforcement', () => {
        it('rejects non-UUID keys in photoKeepMap', () => {
            const result = KeepSelectionsSchema.safeParse({
                photoKeepMap: {
                    'not-a-uuid': [VALID_URL_1]
                }
            });
            expect(result.success).toBe(false);
        });

        it('rejects non-URL strings in photoKeepMap values', () => {
            const result = KeepSelectionsSchema.safeParse({
                photoKeepMap: {
                    [VALID_UUID_1]: ['not-a-url']
                }
            });
            expect(result.success).toBe(false);
        });

        it('accepts empty array as photoKeepMap value for a key', () => {
            const result = KeepSelectionsSchema.safeParse({
                photoKeepMap: {
                    [VALID_UUID_1]: []
                }
            });
            expect(result.success).toBe(true);
        });

        it('rejects non-string values in photo URL arrays', () => {
            const result = KeepSelectionsSchema.safeParse({
                photoKeepMap: {
                    [VALID_UUID_1]: [123]
                }
            });
            expect(result.success).toBe(false);
        });
    });

    describe('type safety', () => {
        it('inferred type satisfies KeepSelections interface', () => {
            const parsed = KeepSelectionsSchema.parse(makeFullSelections());
            // TypeScript compile-time check: assignment to typed variable
            const typed: KeepSelections = parsed;
            expect(typed.accommodationIds).toBeDefined();
        });
    });

    // ── .max(100) caps (m-5) ────────────────────────────────────────────────

    describe('.max(100) caps on accommodationIds and promotionIds', () => {
        function makeUuid(n: number): string {
            const hex = n.toString(16).padStart(8, '0');
            return `${hex}-1111-4111-8111-111111111111`;
        }

        it('accepts exactly 100 accommodationIds', () => {
            const result = KeepSelectionsSchema.safeParse({
                accommodationIds: Array.from({ length: 100 }, (_, i) => makeUuid(i + 1))
            });
            expect(result.success).toBe(true);
        });

        it('rejects 101 accommodationIds', () => {
            const result = KeepSelectionsSchema.safeParse({
                accommodationIds: Array.from({ length: 101 }, (_, i) => makeUuid(i + 1))
            });
            expect(result.success).toBe(false);
        });

        it('accepts exactly 100 promotionIds', () => {
            const result = KeepSelectionsSchema.safeParse({
                promotionIds: Array.from({ length: 100 }, (_, i) => makeUuid(i + 1))
            });
            expect(result.success).toBe(true);
        });

        it('rejects 101 promotionIds', () => {
            const result = KeepSelectionsSchema.safeParse({
                promotionIds: Array.from({ length: 101 }, (_, i) => makeUuid(i + 1))
            });
            expect(result.success).toBe(false);
        });
    });

    describe('.max(100) cap on photoKeepMap keys', () => {
        function makeUuid(n: number): string {
            const hex = n.toString(16).padStart(8, '0');
            return `${hex}-1111-4111-8111-111111111111`;
        }

        it('accepts a photoKeepMap with exactly 100 accommodation keys', () => {
            const photoKeepMap: Record<string, string[]> = {};
            for (let i = 1; i <= 100; i++) {
                photoKeepMap[makeUuid(i)] = [VALID_URL_1];
            }
            const result = KeepSelectionsSchema.safeParse({ photoKeepMap });
            expect(result.success).toBe(true);
        });

        it('rejects a photoKeepMap with 101 accommodation keys', () => {
            const photoKeepMap: Record<string, string[]> = {};
            for (let i = 1; i <= 101; i++) {
                photoKeepMap[makeUuid(i)] = [VALID_URL_1];
            }
            const result = KeepSelectionsSchema.safeParse({ photoKeepMap });
            expect(result.success).toBe(false);
        });

        it('accepts a photoKeepMap entry with exactly 100 photo URLs', () => {
            const urls = Array.from(
                { length: 100 },
                (_, i) => `https://cdn.example.com/img${i}.jpg`
            );
            const result = KeepSelectionsSchema.safeParse({
                photoKeepMap: { [VALID_UUID_1]: urls }
            });
            expect(result.success).toBe(true);
        });

        it('rejects a photoKeepMap entry with 101 photo URLs', () => {
            const urls = Array.from(
                { length: 101 },
                (_, i) => `https://cdn.example.com/img${i}.jpg`
            );
            const result = KeepSelectionsSchema.safeParse({
                photoKeepMap: { [VALID_UUID_1]: urls }
            });
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// PlanChangeRequestSchema — keepSelections extension
// ---------------------------------------------------------------------------

describe('PlanChangeRequestSchema with keepSelections', () => {
    const BASE_REQUEST = {
        newPlanId: 'plan-owner-basico',
        billingInterval: BillingIntervalEnum.MONTHLY
    };

    describe('backward compatibility — keepSelections absent', () => {
        it('accepts a request without keepSelections (pre-T-015 callers)', () => {
            const result = PlanChangeRequestSchema.safeParse(BASE_REQUEST);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.keepSelections).toBeUndefined();
            }
        });

        it('preserves newPlanId and billingInterval when keepSelections is absent', () => {
            const result = PlanChangeRequestSchema.safeParse(BASE_REQUEST);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.newPlanId).toBe('plan-owner-basico');
                expect(result.data.billingInterval).toBe(BillingIntervalEnum.MONTHLY);
            }
        });
    });

    describe('keepSelections accepted on downgrade-direction requests', () => {
        it('accepts a full keepSelections object', () => {
            const result = PlanChangeRequestSchema.safeParse({
                ...BASE_REQUEST,
                keepSelections: makeFullSelections()
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.keepSelections?.accommodationIds).toEqual([VALID_UUID_1]);
                expect(result.data.keepSelections?.promotionIds).toEqual([VALID_UUID_2]);
                expect(result.data.keepSelections?.photoKeepMap?.[VALID_UUID_1]).toEqual([
                    VALID_URL_1,
                    VALID_URL_2
                ]);
            }
        });

        it('accepts keepSelections with only accommodationIds', () => {
            const result = PlanChangeRequestSchema.safeParse({
                ...BASE_REQUEST,
                keepSelections: { accommodationIds: [VALID_UUID_1] }
            });
            expect(result.success).toBe(true);
        });

        it('accepts keepSelections as an empty object', () => {
            const result = PlanChangeRequestSchema.safeParse({
                ...BASE_REQUEST,
                keepSelections: {}
            });
            expect(result.success).toBe(true);
        });

        it('accepts keepSelections explicitly set to undefined (treated as absent)', () => {
            const result = PlanChangeRequestSchema.safeParse({
                ...BASE_REQUEST,
                keepSelections: undefined
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.keepSelections).toBeUndefined();
            }
        });
    });

    describe('invalid keepSelections shapes surface errors', () => {
        it('rejects non-UUID accommodationIds in keepSelections', () => {
            const result = PlanChangeRequestSchema.safeParse({
                ...BASE_REQUEST,
                keepSelections: { accommodationIds: ['not-a-uuid'] }
            });
            expect(result.success).toBe(false);
        });

        it('rejects non-URL photo values in keepSelections.photoKeepMap', () => {
            const result = PlanChangeRequestSchema.safeParse({
                ...BASE_REQUEST,
                keepSelections: {
                    photoKeepMap: { [VALID_UUID_1]: ['not-a-url'] }
                }
            });
            expect(result.success).toBe(false);
        });

        it('rejects non-UUID keys in keepSelections.photoKeepMap', () => {
            const result = PlanChangeRequestSchema.safeParse({
                ...BASE_REQUEST,
                keepSelections: {
                    photoKeepMap: { 'not-a-uuid': [VALID_URL_1] }
                }
            });
            expect(result.success).toBe(false);
        });

        it('rejects keepSelections set to a non-object scalar', () => {
            const result = PlanChangeRequestSchema.safeParse({
                ...BASE_REQUEST,
                keepSelections: 'bad-value'
            });
            expect(result.success).toBe(false);
        });

        it('rejects keepSelections set to an array', () => {
            const result = PlanChangeRequestSchema.safeParse({
                ...BASE_REQUEST,
                keepSelections: [VALID_UUID_1]
            });
            expect(result.success).toBe(false);
        });
    });

    describe('upgrade-path semantic — keepSelections silently ignored', () => {
        // The schema accepts keepSelections for ALL plan-change directions.
        // For upgrades the route handler is responsible for ignoring the field
        // (never forwarding it to initiatePaidPlanUpgrade). The schema does
        // NOT discriminate by direction — this is a deliberate choice to keep
        // a single request type (see PlanChangeRequestSchema JSDoc).
        //
        // These tests confirm the schema itself accepts keepSelections on
        // requests that would route to the upgrade path (higher-priced target).
        // The upgrade-path ignore is tested at the route handler layer.

        it('accepts keepSelections on a request that would be an upgrade-direction call', () => {
            // From the schema's perspective, all plan-change requests have the
            // same shape. The direction (upgrade vs downgrade) is determined
            // by comparing prices at runtime in the handler.
            const result = PlanChangeRequestSchema.safeParse({
                newPlanId: 'plan-owner-pro', // would be an upgrade
                billingInterval: BillingIntervalEnum.ANNUAL,
                keepSelections: { accommodationIds: [VALID_UUID_1] }
            });
            // Schema accepts it; route ignores it at runtime for upgrades.
            expect(result.success).toBe(true);
        });
    });
});
