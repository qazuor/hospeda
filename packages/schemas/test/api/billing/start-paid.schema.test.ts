/**
 * Unit tests for the `/start-paid` request/response schemas (HOS-937 step 2).
 *
 * Covers the new `payerEmail` field:
 * - Request: optional, must be a well-formed email when present — an
 *   invalid format fails `safeParse` (the route maps this to HTTP 400, per
 *   the API error contract's "input shape" tier).
 * - Response: optional at the SCHEMA level only (the commerce/partner
 *   start-subscription routes reuse this same response schema and never
 *   populate it — see the schema's own JSDoc); the accommodation
 *   monthly/annual branches always populate it in practice.
 *
 * @module test/api/billing/start-paid.schema
 */

import { describe, expect, it } from 'vitest';
import {
    StartPaidSubscriptionRequestSchema,
    StartPaidSubscriptionResponseSchema
} from '../../../src/api/billing/start-paid.schema.js';

describe('StartPaidSubscriptionRequestSchema', () => {
    it('accepts a request with no payerEmail at all', () => {
        const result = StartPaidSubscriptionRequestSchema.safeParse({
            planSlug: 'owner-basico',
            billingInterval: 'monthly'
        });
        expect(result.success).toBe(true);
    });

    it('accepts a request with a well-formed payerEmail', () => {
        const result = StartPaidSubscriptionRequestSchema.safeParse({
            planSlug: 'owner-basico',
            billingInterval: 'monthly',
            payerEmail: 'user@example.com'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.payerEmail).toBe('user@example.com');
        }
    });

    it('rejects a malformed payerEmail (no @) — maps to HTTP 400 at the route', () => {
        const result = StartPaidSubscriptionRequestSchema.safeParse({
            planSlug: 'owner-basico',
            billingInterval: 'monthly',
            payerEmail: 'not-an-email'
        });
        expect(result.success).toBe(false);
    });

    it('rejects an empty-string payerEmail', () => {
        const result = StartPaidSubscriptionRequestSchema.safeParse({
            planSlug: 'owner-basico',
            billingInterval: 'monthly',
            payerEmail: ''
        });
        expect(result.success).toBe(false);
    });
});

describe('StartPaidSubscriptionResponseSchema', () => {
    it('accepts a response with payerEmail (accommodation monthly/annual)', () => {
        const result = StartPaidSubscriptionResponseSchema.safeParse({
            checkoutUrl: 'https://mp.test/checkout/abc',
            localSubscriptionId: '11111111-1111-4111-8111-111111111111',
            expiresAt: new Date().toISOString(),
            payerEmail: 'user@example.com'
        });
        expect(result.success).toBe(true);
    });

    it('accepts a response with no payerEmail (commerce/partner start-subscription routes reuse this schema)', () => {
        const result = StartPaidSubscriptionResponseSchema.safeParse({
            checkoutUrl: 'https://mp.test/checkout/abc',
            localSubscriptionId: '11111111-1111-4111-8111-111111111111',
            expiresAt: new Date().toISOString()
        });
        expect(result.success).toBe(true);
    });

    it('rejects a malformed payerEmail on the response', () => {
        const result = StartPaidSubscriptionResponseSchema.safeParse({
            checkoutUrl: 'https://mp.test/checkout/abc',
            localSubscriptionId: '11111111-1111-4111-8111-111111111111',
            expiresAt: new Date().toISOString(),
            payerEmail: 'not-an-email'
        });
        expect(result.success).toBe(false);
    });
});
