/**
 * Tests for GET /api/v1/protected/accommodations/:id/whatsapp (HOS-19).
 *
 * Two layers:
 * 1. Unit tests for the pure `resolveWhatsAppPayload` gating resolver — the
 *    authoritative fail-closed logic (number leaks NEVER happen for unentitled
 *    callers; the `wa.me` direct link requires both a number and DIRECT).
 * 2. Integration tests for route registration, authentication, and method
 *    restrictions (mirrors the sibling `contact.test.ts`; the mock DB returns no
 *    accommodation, so the gating branches are covered by the unit layer above).
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resolveWhatsAppPayload } from '../../../../src/routes/accommodation/protected/getWhatsApp.js';
import type { AppOpenAPI } from '../../../../src/types.js';

describe('resolveWhatsAppPayload (HOS-19 gating)', () => {
    it('emits the number + direct link for a DIRECT-entitled caller (VIP+)', () => {
        expect(
            resolveWhatsAppPayload({
                rawNumber: '+5493442123456',
                entitled: true,
                canDirect: true
            })
        ).toEqual({ number: '+5493442123456', direct: true, entitled: true });
    });

    it('emits the number WITHOUT the direct link for a display-only caller (Plus)', () => {
        expect(
            resolveWhatsAppPayload({
                rawNumber: '+5493442123456',
                entitled: true,
                canDirect: false
            })
        ).toEqual({ number: '+5493442123456', direct: false, entitled: true });
    });

    it('NEVER leaks the number to an unentitled caller (even with DIRECT set)', () => {
        expect(
            resolveWhatsAppPayload({
                rawNumber: '+5493442123456',
                entitled: false,
                canDirect: true
            })
        ).toEqual({ number: null, direct: false, entitled: false });
    });

    it('returns a null number (no direct) for an entitled caller when none is stored', () => {
        expect(
            resolveWhatsAppPayload({ rawNumber: null, entitled: true, canDirect: true })
        ).toEqual({ number: null, direct: false, entitled: true });
    });

    it('returns entitled=false and null number for an unentitled caller with no number', () => {
        expect(
            resolveWhatsAppPayload({ rawNumber: null, entitled: false, canDirect: false })
        ).toEqual({ number: null, direct: false, entitled: false });
    });
});

const BASE = '/api/v1/protected/accommodations';
const VALID_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('GET /api/v1/protected/accommodations/:id/whatsapp', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    describe('Route Registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/whatsapp`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // 401 is expected without auth — NOT 404
            expect(res.status).not.toBe(404);
        });

        it('should return JSON content-type', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/whatsapp`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            const ct = res.headers.get('content-type') ?? '';
            expect(ct).toContain('application/json');
        });
    });

    describe('Authentication', () => {
        it('should return 401 for guest actor', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/whatsapp`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'GUEST'
                }
            });
            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.success).toBe(false);
        });

        it('should return 401 when no auth headers are provided', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/whatsapp`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).toBe(401);
        });
    });

    describe('Response Shape', () => {
        it('should NOT be 400 (id must resolve — no ownership-middleware param bug)', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/whatsapp`, {
                method: 'GET',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-role': 'USER',
                    'x-mock-actor-id': 'user-1'
                }
            });
            expect(res.status).not.toBe(400);
        });
    });

    describe('HTTP Method Restrictions', () => {
        it('should reject POST requests', async () => {
            const res = await app.request(`${BASE}/${VALID_UUID}/whatsapp`, {
                method: 'POST',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([401, 404, 405]).toContain(res.status);
        });
    });
});
