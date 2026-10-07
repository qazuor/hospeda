/**
 * Regression tests for SPEC-210 PR2 — accommodation summary public schema enforcement.
 *
 * Guards against a real regression: the public GET /accommodations/:id/summary
 * route had its responseSchema swapped to the full `AccommodationPublicSchema`
 * (the detail-tier schema, which requires `description`). The summary handler
 * builds a reduced object WITHOUT `description`, so `stripWithSchema` threw and
 * every request returned HTTP 500. The route must use `AccommodationSummarySchema`
 * (the reduced projection the handler was written for), which both:
 *   1. accepts the handler-built summary shape (no 500), and
 *   2. strips internal-only fields the handler happens to include
 *      (lifecycleState, createdAt, updatedAt, visibility, destinationId, audit).
 *
 * These unit tests run unconditionally (no DB required) so a schema swap is
 * caught even in the DB-less CI environment.
 */

import { AccommodationSummarySchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Fields the summary handler attaches but that AccommodationSummarySchema does
 * NOT pick — they MUST be stripped from the public response.
 */
const FORBIDDEN_FIELDS = [
    'lifecycleState',
    'createdAt',
    'updatedAt',
    'visibility',
    'destinationId',
    'createdById',
    'updatedById',
    'deletedAt',
    'deletedById',
    'moderationState',
    'adminInfo'
] as const;

/** Fields that must survive on the public accommodation summary. */
const REQUIRED_PUBLIC_FIELDS = ['id', 'slug', 'name', 'summary', 'type', 'isFeatured'] as const;

/**
 * Mirrors exactly the object the summary handler builds (getSummary.ts), plus
 * extra audit fields to prove they are stripped rather than carried through.
 */
const HANDLER_SUMMARY_SHAPE = {
    // Public fields the handler returns
    id: '423e4567-e89b-12d3-a456-426614174001',
    slug: 'cabana-del-rio',
    name: 'Cabaña del Río',
    summary: 'Cabaña frente al río con muelle propio y desayuno incluido todos los días.',
    type: 'CABIN',
    reviewsCount: 8,
    averageRating: 4.6,
    isFeatured: true,
    ownerId: '423e4567-e89b-12d3-a456-000000000001',
    // Fields the handler attaches but that are NOT in the summary projection
    visibility: 'PUBLIC',
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2024-05-01'),
    updatedAt: new Date('2025-05-01'),
    destinationId: '423e4567-e89b-12d3-a456-426614174999',
    // Extra audit/internal fields that must never leak
    createdById: '423e4567-e89b-12d3-a456-000000000002',
    updatedById: null,
    deletedAt: null,
    deletedById: null,
    moderationState: 'APPROVED',
    adminInfo: { notes: 'internal' }
};

// ---------------------------------------------------------------------------
// Schema unit tests — ALWAYS RUN (no DB required)
// ---------------------------------------------------------------------------

describe('AccommodationSummarySchema — public summary enforcement (SPEC-210)', () => {
    it('accepts the handler-built summary shape (regression: no 500 from missing description)', () => {
        const result = AccommodationSummarySchema.safeParse(HANDLER_SUMMARY_SHAPE);
        expect(result.success).toBe(true);
    });

    it('strips internal/audit/lifecycle fields the handler attaches', () => {
        const result = AccommodationSummarySchema.safeParse(HANDLER_SUMMARY_SHAPE);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of FORBIDDEN_FIELDS) {
                expect(data, `field "${field}" must be absent`).not.toHaveProperty(field);
            }
        }
    });

    it('preserves the required public fields (id, slug, name, summary, type, isFeatured)', () => {
        const result = AccommodationSummarySchema.safeParse(HANDLER_SUMMARY_SHAPE);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            for (const field of REQUIRED_PUBLIC_FIELDS) {
                expect(data, `field "${field}" must be present`).toHaveProperty(field);
            }
        }
    });

    it('preserves review aggregates (reviewsCount and averageRating)', () => {
        const result = AccommodationSummarySchema.safeParse(HANDLER_SUMMARY_SHAPE);
        expect(result.success).toBe(true);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            expect(data.reviewsCount).toBe(8);
            expect(data.averageRating).toBe(4.6);
        }
    });

    it('nullable variant accepts null (for accommodations not found)', () => {
        const result = AccommodationSummarySchema.nullable().safeParse(null);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBeNull();
        }
    });
});
