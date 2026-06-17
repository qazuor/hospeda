/**
 * Tests for POST /api/v1/public/commerce/leads (SPEC-239 T-047 US-1)
 *
 * Verifies:
 * 1. Route is registered and reachable
 * 2. Accepts a valid submission without authentication
 * 3. Honeypot field present → silent 200 with empty body (bot reject)
 * 4. Missing required fields → 400/422 validation error
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/commerce/leads';

/** Minimal valid lead payload matching CommerceLeadCreateInputSchema */
const VALID_LEAD_PAYLOAD = {
    domain: 'gastronomy',
    businessName: 'La Parrilla de Juan',
    contactName: 'Juan Pérez',
    email: 'juan@example.com',
    message: 'Quiero sumar mi parrilla a la plataforma para más visibilidad.'
};

describe('POST /api/v1/public/commerce/leads (SPEC-239 T-047)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    // -------------------------------------------------------------------------
    // Route registration
    // -------------------------------------------------------------------------

    describe('Route Registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(VALID_LEAD_PAYLOAD)
            });
            expect(res.status).not.toBe(404);
        });
    });

    // -------------------------------------------------------------------------
    // Public access (no auth required)
    // -------------------------------------------------------------------------

    describe('Public Access', () => {
        it('does not require authentication', async () => {
            // Arrange — no Authorization header
            const res = await app.request(BASE, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest'
                },
                body: JSON.stringify(VALID_LEAD_PAYLOAD)
            });
            // Should not be auth-rejected
            expect(res.status).not.toBe(401);
            // 200 (db connected) or 500 (no db in test) but never 401
        });
    });

    // -------------------------------------------------------------------------
    // Honeypot guard
    // -------------------------------------------------------------------------

    describe('Honeypot spam guard', () => {
        it('returns a success response with empty data when honeypot field is populated', async () => {
            // Arrange — a bot filled in the hidden _hp field
            const botPayload = {
                ...VALID_LEAD_PAYLOAD,
                _hp: 'I am a bot'
            };

            // Act
            const res = await app.request(BASE, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest'
                },
                body: JSON.stringify(botPayload)
            });

            // Assert — honeypot returns a success facade to confuse scrapers.
            // The route factory wraps the response in {success, data}; an empty
            // object `{}` from the handler produces {success: true, data: {}}.
            // The route factory returns 201 for POST methods by default.
            expect([200, 201]).toContain(res.status);
            const body = (await res.json()) as {
                success?: boolean;
                data?: Record<string, unknown>;
            };
            expect(body.success).toBe(true);
            // No real lead was created — the data must NOT contain a persisted record id.
            // The response schema applies Zod defaults (e.g. status -> 'pending') to the
            // empty {} handler return, so we cannot assert data == {} strictly.
            expect(body.data).not.toHaveProperty('id');
            expect(body.data).not.toHaveProperty('createdAt');
        });

        it('does NOT block when _hp is empty string', async () => {
            // An empty _hp (which legitimate progressive-enhancement forms send)
            // must not trigger the guard.
            const payload = {
                ...VALID_LEAD_PAYLOAD,
                _hp: ''
            };

            const res = await app.request(BASE, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest'
                },
                body: JSON.stringify(payload)
            });

            // Not a honeypot block — real handler runs (200 on db conn, 500 on no db)
            expect([200, 500]).toContain(res.status);
        });
    });

    // -------------------------------------------------------------------------
    // Validation
    // -------------------------------------------------------------------------

    describe('Input Validation', () => {
        it('rejects missing required fields with 400/422', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest'
                },
                // Missing domain, businessName, contactName, email
                body: JSON.stringify({})
            });
            expect([400, 422]).toContain(res.status);
        });

        it('rejects invalid email with 400/422', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'vitest'
                },
                body: JSON.stringify({
                    ...VALID_LEAD_PAYLOAD,
                    email: 'not-an-email'
                })
            });
            expect([400, 422]).toContain(res.status);
        });
    });

    // -------------------------------------------------------------------------
    // HTTP method restriction
    // -------------------------------------------------------------------------

    describe('HTTP Method Restrictions', () => {
        it('rejects GET requests', async () => {
            const res = await app.request(BASE, {
                method: 'GET',
                headers: { 'user-agent': 'vitest' }
            });
            expect([404, 405]).toContain(res.status);
        });
    });
});
