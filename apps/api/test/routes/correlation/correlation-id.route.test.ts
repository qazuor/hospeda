/**
 * TEST:U2:9 (AC:U2:9, HOS-1424) — the correlation is minted at the edge and
 * travels to the domain event and to the outbox row.
 *
 * Runs the REAL app middleware chain (`createApp`) with one test-only route
 * that stands for a business intention: it reads the request's correlation and
 * hands it, explicitly, to an outbox enqueue and a domain event write, which is
 * the contract every piece that writes them (V2, V4, B3, V9a) follows. The two
 * writers are recording fakes with the models' signatures, so the assertions
 * are about what the edge hands down, not about SQL (that half is
 * `packages/db/test/integration/domain-event.integration.test.ts`, TEST:U2:12).
 */
import type { EnqueueEmailInput, InsertDomainEventInput } from '@repo/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { getRequestCorrelationId } from '../../../src/lib/request-context';
import { CORRELATION_ID_HEADER } from '../../../src/middlewares/request-context';
import { createApp } from '../../../src/utils/create-app';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PATH = '/api/v1/public/__hos1424/intention';
/** Headers the validation middleware requires of every non-public request. */
const BASE_HEADERS = { 'user-agent': 'vitest' };

let enqueued: EnqueueEmailInput[] = [];
let events: InsertDomainEventInput[] = [];

/** The app, plus a route that starts an intention producing one outbox row and one event. */
function buildApp() {
    const app = createApp();
    app.post(PATH, async (c) => {
        const correlationId = getRequestCorrelationId();
        if (!correlationId) {
            return c.json({ error: 'no correlation in the request scope' }, 500);
        }
        // The domain transaction: enqueue the mail and record the event, both
        // under the correlation of the intention.
        enqueued.push({
            recipientEmail: 'host@example.com',
            template: 'subscription-cancel-notice',
            dedupKey: 'k',
            correlationId
        });
        events.push({
            eventType: 'email.undeliverable',
            entityType: 'email_outbox',
            entityId: 'row-1',
            actorType: 'job',
            correlationId
        });
        return c.json({ correlationId });
    });
    return app;
}

beforeEach(() => {
    enqueued = [];
    events = [];
});

describe('TEST:U2:9 the correlation is minted at the edge and reaches the event and the outbox row', () => {
    it('mints one when the request carries none, and echoes it on the response', async () => {
        // Act
        const res = await buildApp().request(PATH, { method: 'POST', headers: BASE_HEADERS });

        // Assert
        expect(res.status).toBe(200);
        const echoed = res.headers.get(CORRELATION_ID_HEADER);
        expect(echoed).toMatch(UUID);
        expect(enqueued[0]?.correlationId).toBe(echoed);
        expect(events[0]?.correlationId).toBe(echoed);
    });

    it('respects a valid correlation sent by the client', async () => {
        // Arrange: the second request of an intention the client already started.
        const sent = crypto.randomUUID();

        // Act
        const res = await buildApp().request(PATH, {
            method: 'POST',
            headers: { ...BASE_HEADERS, [CORRELATION_ID_HEADER]: sent.toUpperCase() }
        });

        // Assert
        expect(res.headers.get(CORRELATION_ID_HEADER)).toBe(sent);
        expect(enqueued[0]?.correlationId).toBe(sent);
        expect(events[0]?.correlationId).toBe(sent);
    });

    it('replaces a value that is not a UUID instead of storing it', async () => {
        // Act
        const res = await buildApp().request(PATH, {
            method: 'POST',
            headers: { ...BASE_HEADERS, [CORRELATION_ID_HEADER]: "x'; DROP TABLE domain_event; --" }
        });

        // Assert
        const echoed = res.headers.get(CORRELATION_ID_HEADER);
        expect(echoed).toMatch(UUID);
        expect(events[0]?.correlationId).toBe(echoed);
    });

    it('gives two requests without a correlation two different ones', async () => {
        // Act
        const app = buildApp();
        const first = await app.request(PATH, { method: 'POST', headers: BASE_HEADERS });
        const second = await app.request(PATH, { method: 'POST', headers: BASE_HEADERS });

        // Assert
        expect(first.headers.get(CORRELATION_ID_HEADER)).not.toBe(
            second.headers.get(CORRELATION_ID_HEADER)
        );
    });

    it('echoes the correlation on an error response too, so a refused intention can be traced', async () => {
        // Act: the validation middleware refuses a request without a user agent.
        const res = await buildApp().request(PATH, { method: 'POST' });

        // Assert
        expect(res.status).toBe(400);
        expect(res.headers.get(CORRELATION_ID_HEADER)).toMatch(UUID);
        expect(events).toHaveLength(0);
    });

    it('echoes the correlation on a 404 too, so a failed intention can still be traced', async () => {
        // Act
        const res = await buildApp().request('/api/v1/public/__hos1424/missing', {
            headers: BASE_HEADERS
        });

        // Assert
        expect(res.status).toBe(404);
        expect(res.headers.get(CORRELATION_ID_HEADER)).toMatch(UUID);
    });
});
