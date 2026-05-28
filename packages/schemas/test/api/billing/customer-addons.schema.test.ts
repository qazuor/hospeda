/**
 * Tests for CustomerAddons Schemas
 *
 * Covers the list query, response, and action response schemas used by the
 * admin customer-addons endpoint. Includes enriched catalog fields
 * (addonName, priceArs) added in the SPEC-143 batch.
 *
 * @module test/api/billing/customer-addons.schema
 */

import { describe, expect, it } from 'vitest';
import {
    CustomerAddonResponseSchema,
    CustomerAddonsListResponseSchema,
    ListCustomerAddonsQuerySchema
} from '../../../src/api/billing/customer-addons.schema.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_ROW = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    customerId: 'b2c3d4e5-f6a7-8901-bcde-f01234567891',
    customerEmail: 'host@local.test',
    customerName: 'Host User',
    subscriptionId: null,
    addonSlug: 'visibility-boost-7d',
    addonId: null,
    status: 'active' as const,
    purchasedAt: '2026-05-01T00:00:00.000Z',
    expiresAt: '2026-05-08T00:00:00.000Z',
    canceledAt: null,
    paymentId: null,
    limitAdjustments: null,
    entitlementAdjustments: null,
    metadata: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z'
};

// ─── ListCustomerAddonsQuerySchema ────────────────────────────────────────────

describe('ListCustomerAddonsQuerySchema', () => {
    it('should accept default values when no params provided', () => {
        const result = ListCustomerAddonsQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.page).toBe(1);
            expect(result.data.pageSize).toBe(20);
            expect(result.data.status).toBe('all');
            expect(result.data.includeDeleted).toBe(false);
        }
    });

    it('should coerce string numbers from query params', () => {
        const result = ListCustomerAddonsQuerySchema.safeParse({
            page: '2',
            pageSize: '50'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.page).toBe(2);
            expect(result.data.pageSize).toBe(50);
        }
    });

    it('should accept all valid status values', () => {
        for (const status of ['all', 'active', 'expired', 'canceled', 'pending'] as const) {
            const result = ListCustomerAddonsQuerySchema.safeParse({ status });
            expect(result.success).toBe(true);
        }
    });

    it('should reject an unknown status value', () => {
        const result = ListCustomerAddonsQuerySchema.safeParse({ status: 'unknown-status' });
        expect(result.success).toBe(false);
    });

    it('should reject pageSize above 100', () => {
        const result = ListCustomerAddonsQuerySchema.safeParse({ pageSize: '101' });
        expect(result.success).toBe(false);
    });

    it('should accept optional filter fields', () => {
        const result = ListCustomerAddonsQuerySchema.safeParse({
            addonSlug: 'visibility-boost-7d',
            customerEmail: 'host@local.test',
            includeDeleted: 'true'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.addonSlug).toBe('visibility-boost-7d');
            expect(result.data.includeDeleted).toBe(true);
        }
    });
});

// ─── CustomerAddonResponseSchema ─────────────────────────────────────────────

describe('CustomerAddonResponseSchema', () => {
    it('should validate a minimal valid row (without catalog enrichment fields)', () => {
        const result = CustomerAddonResponseSchema.safeParse(BASE_ROW);
        expect(result.success).toBe(true);
    });

    it('should validate a row with enriched catalog fields (addonName + priceArs)', () => {
        const enriched = {
            ...BASE_ROW,
            addonName: 'Visibility Boost (7 days)',
            priceArs: 500000
        };
        const result = CustomerAddonResponseSchema.safeParse(enriched);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.addonName).toBe('Visibility Boost (7 days)');
            expect(result.data.priceArs).toBe(500000);
        }
    });

    it('should accept null addonName when slug not in catalog', () => {
        const result = CustomerAddonResponseSchema.safeParse({
            ...BASE_ROW,
            addonSlug: 'unknown-addon-slug',
            addonName: null,
            priceArs: null
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.addonName).toBeNull();
            expect(result.data.priceArs).toBeNull();
        }
    });

    it('should accept all valid status values', () => {
        for (const status of ['active', 'expired', 'canceled', 'pending'] as const) {
            const result = CustomerAddonResponseSchema.safeParse({ ...BASE_ROW, status });
            expect(result.success).toBe(true);
        }
    });

    it('should reject status "all" (query-only value)', () => {
        const result = CustomerAddonResponseSchema.safeParse({ ...BASE_ROW, status: 'all' });
        expect(result.success).toBe(false);
    });

    it('should reject a non-integer priceArs', () => {
        const result = CustomerAddonResponseSchema.safeParse({
            ...BASE_ROW,
            addonName: 'Test',
            priceArs: 500.5
        });
        expect(result.success).toBe(false);
    });
});

// ─── CustomerAddonsListResponseSchema ────────────────────────────────────────

describe('CustomerAddonsListResponseSchema', () => {
    it('should validate a paginated list response', () => {
        const result = CustomerAddonsListResponseSchema.safeParse({
            data: [{ ...BASE_ROW, addonName: 'Visibility Boost (7 days)', priceArs: 500000 }],
            total: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1
        });
        expect(result.success).toBe(true);
    });

    it('should validate an empty list response', () => {
        const result = CustomerAddonsListResponseSchema.safeParse({
            data: [],
            total: 0,
            page: 1,
            pageSize: 20,
            totalPages: 0
        });
        expect(result.success).toBe(true);
    });
});
