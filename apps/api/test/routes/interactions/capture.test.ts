/**
 * Route tests for POST /api/v1/public/interactions (HOS-2256).
 *
 * The service is mocked, so these tests pin the ROUTE contract: bot filter,
 * body validation, always-202 for everything the service drops, and that the
 * visitor hash is computed WITHOUT the user id (privacy decision, spec 7.5).
 * Whether a row is really inserted, and the drop rules (unpublished listing,
 * foreign event, owner), are asserted against the real service in
 * `packages/service-core/test/services/entityInteraction`.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCapture, mockHash } = vi.hoisted(() => ({
    mockCapture: vi.fn(),
    mockHash: vi.fn().mockReturnValue('mocked-visitor-hash')
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        EntityInteractionService: class MockEntityInteractionService {
            capture = mockCapture;
        }
    };
});

vi.mock('../../../src/utils/visitor-hash.js', () => ({ computeVisitorHash: mockHash }));

import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

const URL = '/api/v1/public/interactions';
const VENUE_ID = '550e8400-e29b-41d4-a716-446655440000';
const EVENT_ID = '660e8400-e29b-41d4-a716-446655440000';
const BROWSER_UA =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
const HEADERS: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': BROWSER_UA,
    accept: 'application/json'
};

const post = (app: AppOpenAPI, body: unknown, headers: Record<string, string> = HEADERS) =>
    app.request(URL, { method: 'POST', headers, body: JSON.stringify(body) });

describe('POST /api/v1/public/interactions (HOS-2256)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        mockCapture.mockReset();
        mockHash.mockClear();
        mockCapture.mockResolvedValue({ recorded: true });
    });

    it('answers 202 and calls the service with the server-derived hash and no actor', async () => {
        const res = await post(app, {
            entityType: 'VENUE',
            entityId: VENUE_ID,
            kind: 'PHONE_CLICK'
        });

        expect(res.status).toBe(202);
        expect(await res.json()).toMatchObject({ accepted: true });
        expect(mockCapture).toHaveBeenCalledOnce();
        expect(mockCapture).toHaveBeenCalledWith({
            entityType: 'VENUE',
            entityId: VENUE_ID,
            kind: 'PHONE_CLICK',
            eventId: undefined,
            visitorHash: 'mocked-visitor-hash',
            actorUserId: null
        });
    });

    it('never passes a userId to the visitor hash (AC-2)', async () => {
        await post(app, { entityType: 'VENUE', entityId: VENUE_ID, kind: 'MAP_CLICK' });

        expect(mockHash).toHaveBeenCalled();
        for (const call of mockHash.mock.calls) {
            expect(call[0]).not.toHaveProperty('userId');
        }
    });

    it('forwards the eventId of a TICKET_CLICK', async () => {
        const res = await post(app, {
            entityType: 'VENUE',
            entityId: VENUE_ID,
            kind: 'TICKET_CLICK',
            eventId: EVENT_ID
        });

        expect(res.status).toBe(202);

        expect(mockCapture).toHaveBeenCalledWith(expect.objectContaining({ eventId: EVENT_ID }));
    });

    it.each([
        ['TICKET_CLICK without eventId', { kind: 'TICKET_CLICK' }],
        ['PHONE_CLICK with eventId', { kind: 'PHONE_CLICK', eventId: EVENT_ID }],
        ['unknown kind', { kind: 'NOPE' }],
        ['non-uuid entityId', { kind: 'PHONE_CLICK', entityId: 'abc' }],
        ['entityType other than VENUE', { kind: 'PHONE_CLICK', entityType: 'ACCOMMODATION' }]
    ])('answers 400 VALIDATION_ERROR and does not call the service: %s (AC-5)', async (_n, patch) => {
        const res = await post(app, {
            entityType: 'VENUE',
            entityId: VENUE_ID,
            ...patch
        });

        expect(res.status).toBe(400);
        const body = (await res.json()) as { error?: { code?: string; message?: string } };
        expect(body.error?.code).toBe('VALIDATION_ERROR');
        expect(body.error?.code).not.toBe('INTERNAL_ERROR');
        expect(mockCapture).not.toHaveBeenCalled();
    });

    it('answers 202 and does not call the service for a bot UA (AC-6)', async () => {
        const res = await post(
            app,
            { entityType: 'VENUE', entityId: VENUE_ID, kind: 'PHONE_CLICK' },
            { ...HEADERS, 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' }
        );

        expect(res.status).toBe(202);
        expect(await res.json()).toMatchObject({ accepted: true });
        expect(mockCapture).not.toHaveBeenCalled();
    });

    it.each([
        [
            'a dropped interaction (unknown listing, foreign event, owner)',
            { recorded: false, reason: 'LISTING_NOT_FOUND' }
        ],
        ['a DB error', { recorded: false, reason: 'DB_ERROR' }]
    ])('answers the same 202 for %s (AC-7, AC-9)', async (_n, result) => {
        mockCapture.mockResolvedValue(result);

        const res = await post(app, {
            entityType: 'VENUE',
            entityId: VENUE_ID,
            kind: 'WEBSITE_CLICK'
        });

        expect(res.status).toBe(202);
        expect(await res.json()).toMatchObject({ accepted: true });
    });
});
