/**
 * Regression test for HOS-1791: `GET /admin/newsletter/subscribers` answered 500.
 *
 * `NewsletterSubscriberService.adminList` used to run a raw
 * `SELECT * FROM newsletter_subscribers` through `db.execute(sql)` and cast
 * `result.rows` to the camelCase `SelectNewsletterSubscriber`. Raw rows come
 * back snake_case (`created_at`, `subscribed_at`, ...), so the route's
 * response validation against `NewsletterSubscriberSchema` rejected every item.
 *
 * This suite exercises the REAL query builder and the REAL row mapping: it
 * wires a genuine drizzle instance (`drizzle-orm/pg-proxy`) behind `getDb()`
 * and only fakes the wire. The fake returns what node-postgres returns:
 * timestamps as raw strings, jsonb as parsed objects. Nothing about the
 * service or the drizzle mapper is mocked.
 */

import { getTableColumns } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pg-proxy';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface ProxyCall {
    readonly sql: string;
    readonly params: readonly unknown[];
    readonly method: string;
}

/** Wire-level calls seen by the fake driver, in order. */
const proxyCalls: ProxyCall[] = [];

/** Rows (as raw wire values keyed by DB column name) returned for the items query. */
let wireItems: Array<Record<string, unknown>> = [];
let wireTotal = 0;

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    const db = drizzle(async (sqlText, params, method) => {
        proxyCalls.push({ sql: sqlText, params, method });
        if (/count\(/i.test(sqlText)) {
            return { rows: [[wireTotal]] };
        }
        // Array row mode: values in SELECT order == table column order.
        const columns = Object.values(
            getTableColumns(original.newsletterSubscribers)
        ) as PgColumn[];
        return { rows: wireItems.map((row) => columns.map((col) => row[col.name] ?? null)) };
    });
    // node-postgres `db.execute(sql)` resolves `{ rows }` with snake_case objects keyed by
    // DB column name. Reproduced here so the pre-fix raw-SQL path sees what production gave it.
    const wrapped = Object.assign(Object.create(db), {
        execute: async (query: { toQuery?: unknown }) => {
            const text = JSON.stringify(query);
            proxyCalls.push({ sql: text, params: [], method: 'execute' });
            return /COUNT\(/i.test(text) ? { rows: [{ total: wireTotal }] } : { rows: wireItems };
        }
    });
    return { ...original, getDb: vi.fn(() => wrapped) };
});

import { NewsletterSubscriberSchema, PermissionEnum, RoleEnum } from '@repo/schemas';
import { NewsletterSubscriberService } from '../../../src/services/newsletter/newsletter-subscriber.service.js';
import type { Actor } from '../../../src/types/index.js';

const ADMIN: Actor = {
    id: '33333333-3333-4333-a333-333333333333',
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.NEWSLETTER_SUBSCRIBER_VIEW]
};

/** Builds the service with inert dispatchers; adminList never sends mail. */
function makeService(): NewsletterSubscriberService {
    return new NewsletterSubscriberService(
        {},
        {
            hmacSecret: 'test-hmac-secret-min-32-chars-long!!',
            notificationDispatcher: {
                sendVerification: vi.fn().mockResolvedValue(undefined),
                sendWelcome: vi.fn().mockResolvedValue(undefined)
            }
        }
    );
}

const BASE_PARAMS = {
    page: 1,
    pageSize: 50,
    sort: 'createdAt:desc',
    status: 'all',
    includeDeleted: false
} as const;

/** One subscriber as the pg driver delivers it for a `timestamptz` column. */
function wireRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: '11111111-1111-4111-a111-111111111111',
        user_id: '22222222-2222-4222-b222-222222222222',
        email: 'user@example.com',
        channel: 'email',
        status: 'active',
        locale: 'es',
        source: 'web_footer',
        preferences: { offers: true, events: true, guides: false, productNews: true },
        consent_ip: '203.0.113.7',
        consent_ua: 'Mozilla/5.0',
        consent_version: 'v1',
        subscribed_at: '2026-05-20 06:08:09.805+00',
        verified_at: '2026-05-20 06:10:00.000+00',
        unsubscribed_at: null,
        bounced_at: null,
        complained_at: null,
        created_at: '2026-05-20 06:08:09.805+00',
        updated_at: '2026-05-20 06:10:00.000+00',
        deleted_at: null,
        ...overrides
    };
}

describe('NewsletterSubscriberService.adminList (HOS-1791 regression)', () => {
    beforeEach(() => {
        proxyCalls.length = 0;
        wireItems = [];
        wireTotal = 0;
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns camelCased items that satisfy NewsletterSubscriberSchema', async () => {
        // Arrange
        const svc = makeService();
        // Second row is a guest subscription (user_id IS NULL), which the table allows.
        wireItems = [
            wireRow(),
            wireRow({ id: '44444444-4444-4444-a444-444444444444', user_id: null })
        ];
        wireTotal = 2;

        // Act
        const result = await svc.adminList(ADMIN, BASE_PARAMS as never);

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.total).toBe(2);
        expect(result.data?.items).toHaveLength(2);
        for (const item of result.data?.items ?? []) {
            expect(() => NewsletterSubscriberSchema.parse(item)).not.toThrow();
        }
        const first = result.data?.items[0];
        expect(first?.createdAt).toBeInstanceOf(Date);
        expect(first?.subscribedAt).toBeInstanceOf(Date);
        expect(first?.userId).toBe('22222222-2222-4222-b222-222222222222');
        expect(first).not.toHaveProperty('created_at');
    });

    it('keeps soft-delete exclusion, newest-first ordering and LIMIT/OFFSET', async () => {
        // Arrange
        const svc = makeService();
        wireTotal = 0;

        // Act
        await svc.adminList(ADMIN, { ...BASE_PARAMS, page: 3, pageSize: 20 } as never);

        // Assert
        const itemsCall = proxyCalls.find((c) => !/count\(/i.test(c.sql));
        expect(itemsCall?.sql).toMatch(/"deleted_at" is null/i);
        expect(itemsCall?.sql).toMatch(/order by "newsletter_subscribers"\."created_at" desc/i);
        expect(itemsCall?.params).toEqual(expect.arrayContaining([20, 40]));
        const countCall = proxyCalls.find((c) => /count\(/i.test(c.sql));
        expect(countCall?.sql).toMatch(/"deleted_at" is null/i);
    });

    it('applies every filter to both the count and the items query', async () => {
        // Arrange
        const svc = makeService();

        // Act
        await svc.adminList(ADMIN, {
            ...BASE_PARAMS,
            subscriberStatus: 'active',
            channel: 'email',
            locale: 'es',
            source: 'web_footer',
            emailSearch: '50%_off'
        } as never);

        // Assert
        expect(proxyCalls).toHaveLength(2);
        for (const call of proxyCalls) {
            expect(call.sql).toMatch(/"status" = \$/);
            expect(call.sql).toMatch(/"channel" = \$/);
            expect(call.sql).toMatch(/"locale" = \$/);
            expect(call.sql).toMatch(/"source" = \$/);
            expect(call.sql).toMatch(/ilike/i);
            // LIKE metacharacters in the search term are escaped, never passed raw.
            expect(call.params).toContain('%50\\%\\_off%');
        }
    });
});
