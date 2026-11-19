/**
 * HOS-1512 PR 2, review of #4538 (R1, L1): the read-only re-reads of real objects. A re-read over
 * zero real subjects is a finding, never a green; the search is walked page by page past the
 * battery's own objects; the order the search answers (`date_created` descending, never measured)
 * is checked; and a subject the adapter refuses BY DESIGN is not read further.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import {
    runWatchBattery,
    WATCH_CATALOG,
    WATCH_REFERENCE_PREFIX,
    type WatchEntry,
    type WatchRequest,
    type WatchResponse,
    type WatchTransport
} from '../src/battery/index';
import { memoryRunStore } from './watch-battery-fixtures';

const clock = createAdjustableClock({ start: new Date('2026-11-17T12:00:00.000Z') });

function shipped(id: string): WatchEntry {
    const entry = WATCH_CATALOG.find((candidate) => candidate.id === id);
    if (entry === undefined) throw new Error(`no shipped entry ${id}`);
    return entry;
}

/** A search result, `minutesAgo` before the clock. */
interface Listed {
    readonly id: string;
    readonly reference: string;
    readonly minutesAgo: number;
}

const iso = (minutesAgo: number) =>
    new Date(clock.now().getTime() - minutesAgo * 60_000).toISOString();

function readOf(item: Listed, frequencyType = 'months') {
    return {
        id: item.id,
        external_reference: item.reference,
        status: 'authorized',
        auto_recurring: {
            frequency: 1,
            frequency_type: frequencyType,
            transaction_amount: 15,
            currency_id: 'ARS'
        }
    };
}

/** Serves an authorization search (honoring limit and offset only) and reads by id. */
function authorizationProvider(args: {
    readonly listed: readonly Listed[];
    readonly frequencyTypeOf?: (id: string) => string;
}) {
    const sent: WatchRequest[] = [];
    const transport: WatchTransport = async (request): Promise<WatchResponse> => {
        sent.push(request);
        const url = new URL(request.path, 'https://watch.internal');
        if (url.pathname === '/preapproval/search') {
            const limit = Number(url.searchParams.get('limit') ?? '20');
            const offset = Number(url.searchParams.get('offset') ?? '0');
            return {
                status: 200,
                body: {
                    paging: { total: args.listed.length, limit, offset },
                    results: args.listed.slice(offset, offset + limit).map((item) => ({
                        id: item.id,
                        date_created: iso(item.minutesAgo),
                        external_reference: item.reference,
                        status: 'authorized'
                    }))
                }
            };
        }
        const read = /^\/preapproval\/([^/]+)$/.exec(url.pathname);
        const item = args.listed.find((candidate) => candidate.id === read?.[1]);
        if (item !== undefined) {
            return { status: 200, body: readOf(item, args.frequencyTypeOf?.(item.id)) };
        }
        if (url.pathname === '/authorized_payments/search') {
            return { status: 200, body: { paging: { total: 0 }, results: [] } };
        }
        return { status: 404, body: { message: 'not found' } };
    };
    const searches = () => sent.filter((request) => request.path.startsWith('/preapproval/search'));
    return { sent, transport, searches };
}

const own = (index: number): Listed => ({
    id: `own-${index}`,
    reference: `${WATCH_REFERENCE_PREFIX}run-${index}`,
    minutesAgo: index
});

const real = (index: number, minutesAgo = 100 + index): Listed => ({
    id: `real-${index}`,
    reference: `subscription-${index}`,
    minutesAgo
});

async function run(entry: WatchEntry, transport: WatchTransport) {
    const store = memoryRunStore();
    return runWatchBattery({
        account: 'sandbox',
        catalog: [entry],
        transport,
        authorization: null,
        clock,
        settings: { payerEmail: 'watch-payer@hospeda.test', returnUrl: 'https://hospeda.test' },
        ...store.ports
    });
}

describe('recent-auths', () => {
    it('fails, never goes green, when the account has no real authorization', async () => {
        const fake = authorizationProvider({ listed: [own(0), own(1)] });
        const result = await run(shipped('recent-auths'), fake.transport);
        expect(result.run.measurements['recent-auths']?.outcome).toBe('errored');
        expect(result.run.measurements['recent-auths']?.error).toContain(
            'no real authorization to re-read'
        );
        expect(result.run.outcome).toBe('failed');
        expect(result.mayPingWatchdog).toBe(false);
    });

    it('walks past a full page of its own objects to reach the real ones', async () => {
        const listed = [
            ...Array.from({ length: 25 }, (_, index) => own(index)),
            ...Array.from({ length: 7 }, (_, index) => real(index))
        ];
        const fake = authorizationProvider({ listed });
        const result = await run(shipped('recent-auths'), fake.transport);
        expect(fake.searches().map((request) => request.path)).toEqual([
            '/preapproval/search?limit=20&offset=0&sort=date_created:desc',
            '/preapproval/search?limit=20&offset=20&sort=date_created:desc'
        ]);
        expect(result.run.measurements['recent-auths']?.obtained).toEqual({
            subjectsRead: 5,
            foreignSkipped: 0,
            sortedDescending: true,
            unreadableByAdapter: [],
            renewalsWithoutExpiry: []
        });
        expect(result.run.measurements['recent-auths']?.outcome).toBe('matched');
    });

    it('stops at the end of the search and reports fewer subjects as a change', async () => {
        const fake = authorizationProvider({ listed: [own(0), real(0), real(1)] });
        const result = await run(shipped('recent-auths'), fake.transport);
        expect(fake.searches()).toHaveLength(1);
        expect(result.run.measurements['recent-auths']?.obtained).toMatchObject({
            subjectsRead: 2
        });
        expect(result.run.measurements['recent-auths']?.outcome).toBe('changed');
    });

    it('reports a search that does not answer newest first', async () => {
        // Oldest first: the order asked for is not the order answered.
        const listed = Array.from({ length: 5 }, (_, index) => real(index, 50 - index));
        const fake = authorizationProvider({ listed });
        const result = await run(shipped('recent-auths'), fake.transport);
        expect(result.run.measurements['recent-auths']?.obtained).toMatchObject({
            subjectsRead: 5,
            sortedDescending: false
        });
        expect(result.run.measurements['recent-auths']?.outcome).toBe('changed');
    });

    it('is not green when every subject is refused by design: none was really read (R2)', async () => {
        const listed = Array.from({ length: 5 }, (_, index) => real(index));
        const fake = authorizationProvider({ listed, frequencyTypeOf: () => 'days' });
        const result = await run(shipped('recent-auths'), fake.transport);
        expect(result.run.measurements['recent-auths']?.outcome).toBe('errored');
        expect(result.run.measurements['recent-auths']?.error).toContain('5 skipped as foreign');
        expect(result.run.outcome).toBe('failed');
        expect(result.mayPingWatchdog).toBe(false);
    });

    it('walks on past foreign subjects until five are really read, and reports them (R2)', async () => {
        // Three foreign among the most recent: the walk reads past them to five real reads.
        const listed = Array.from({ length: 28 }, (_, index) => real(index));
        const foreign = new Set(['real-0', 'real-2', 'real-4']);
        const fake = authorizationProvider({
            listed,
            frequencyTypeOf: (id) => (foreign.has(id) ? 'days' : 'months')
        });
        const result = await run(shipped('recent-auths'), fake.transport);
        expect(result.run.measurements['recent-auths']?.obtained).toEqual({
            subjectsRead: 5,
            foreignSkipped: 3,
            sortedDescending: true,
            unreadableByAdapter: [],
            renewalsWithoutExpiry: []
        });
        // Foreign subjects are reported only: the measurement still matches.
        expect(result.run.measurements['recent-auths']?.outcome).toBe('matched');
    });

    it('does not count an unreadable subject as read (R2)', async () => {
        const listed = Array.from({ length: 5 }, (_, index) => real(index));
        const fake = authorizationProvider({ listed });
        const transport: WatchTransport = async (request) =>
            request.path === '/preapproval/real-1'
                ? { status: 200, body: { id: 'real-1' } }
                : fake.transport(request);
        const result = await run(shipped('recent-auths'), transport);
        expect(result.run.measurements['recent-auths']?.obtained).toMatchObject({
            subjectsRead: 4,
            unreadableByAdapter: ['real-1']
        });
        expect(result.run.measurements['recent-auths']?.outcome).toBe('changed');
    });

    it('does not read the charge records of an authorization refused by design', async () => {
        const listed = Array.from({ length: 5 }, (_, index) => real(index));
        // A cadence the adapter does not support: refused BY DESIGN, not a drift.
        const fake = authorizationProvider({
            listed,
            frequencyTypeOf: (id) => (id === 'real-0' ? 'days' : 'months')
        });
        const result = await run(shipped('recent-auths'), fake.transport);
        const recordReads = fake.sent
            .filter((request) => request.path.startsWith('/authorized_payments/search'))
            .map((request) =>
                new URL(request.path, 'https://watch.internal').searchParams.get('preapproval_id')
            );
        expect(recordReads).not.toContain('real-0');
        expect(recordReads).toContain('real-1');
        expect(result.run.measurements['recent-auths']?.obtained).toMatchObject({
            unreadableByAdapter: []
        });
    });
});

describe('reported-only keys (R2)', () => {
    const entry = (reportedOnly?: readonly string[]): WatchEntry => ({
        id: 'recent-auths',
        rows: [],
        accounts: ['sandbox'],
        effect: 'read',
        expected: { subjectsRead: 5 },
        ...(reportedOnly === undefined ? {} : { reportedOnly }),
        measure: async () => ({ subjectsRead: 5, foreignSkipped: 7 })
    });
    const silent: WatchTransport = async () => ({ status: 404, body: {} });

    it('records a reported-only key without comparing it', async () => {
        const result = await run(entry(['foreignSkipped']), silent);
        expect(result.run.measurements['recent-auths']).toMatchObject({
            outcome: 'matched',
            obtained: { subjectsRead: 5, foreignSkipped: 7 }
        });
    });

    it('compares every key an entry does not declare as reported only', async () => {
        const result = await run(entry(), silent);
        expect(result.run.measurements['recent-auths']?.outcome).toBe('changed');
    });
});

/** Serves a payment search (honoring limit and offset only) and reads by id. */
function paymentProvider(
    listed: readonly { readonly id: string; readonly minutesAgo: number }[],
    failId?: (id: string) => boolean
) {
    const sent: WatchRequest[] = [];
    const transport: WatchTransport = async (request): Promise<WatchResponse> => {
        sent.push(request);
        const url = new URL(request.path, 'https://watch.internal');
        if (url.pathname === '/v1/payments/search') {
            const limit = Number(url.searchParams.get('limit') ?? '30');
            const offset = Number(url.searchParams.get('offset') ?? '0');
            return {
                status: 200,
                body: {
                    paging: { total: listed.length, limit, offset },
                    results: listed.slice(offset, offset + limit).map((item) => ({
                        id: item.id,
                        status: 'approved',
                        date_created: iso(item.minutesAgo),
                        transaction_amount_refunded: 0
                    }))
                }
            };
        }
        const read = /^\/v1\/payments\/([^/]+)$/.exec(url.pathname);
        const item = listed.find((candidate) => candidate.id === read?.[1]);
        if (item !== undefined && failId?.(item.id) !== true) {
            return {
                status: 200,
                body: {
                    id: item.id,
                    date_created: iso(item.minutesAgo),
                    external_reference: `order-${item.id}`,
                    status: 'approved',
                    transaction_amount: 15,
                    currency_id: 'ARS',
                    transaction_amount_refunded: 0
                }
            };
        }
        return { status: 404, body: { message: 'not found' } };
    };
    return { sent, transport };
}

describe('recent-payments', () => {
    it('fails, never goes green, when the account has no payment', async () => {
        const fake = paymentProvider([]);
        const result = await run(shipped('recent-payments'), fake.transport);
        expect(result.run.measurements['recent-payments']?.outcome).toBe('errored');
        expect(result.run.measurements['recent-payments']?.error).toContain(
            'no real payment to re-read'
        );
        expect(result.run.outcome).toBe('failed');
    });

    it('reports a search that does not answer newest first', async () => {
        const fake = paymentProvider(
            Array.from({ length: 5 }, (_, index) => ({
                id: `${index + 1}`,
                minutesAgo: 50 - index
            }))
        );
        const result = await run(shipped('recent-payments'), fake.transport);
        expect(result.run.measurements['recent-payments']?.obtained).toMatchObject({
            subjectsRead: 5,
            sortedDescending: false
        });
        expect(result.run.measurements['recent-payments']?.outcome).toBe('changed');
    });

    it('reports fewer than five payments as a change', async () => {
        const fake = paymentProvider([
            { id: '1', minutesAgo: 1 },
            { id: '2', minutesAgo: 2 }
        ]);
        const result = await run(shipped('recent-payments'), fake.transport);
        expect(result.run.measurements['recent-payments']?.obtained).toMatchObject({
            subjectsRead: 2
        });
        expect(result.run.measurements['recent-payments']?.outcome).toBe('changed');
    });

    it('does not count a payment the adapter could not read (R2)', async () => {
        const fake = paymentProvider(
            Array.from({ length: 5 }, (_, index) => ({ id: `${index + 1}`, minutesAgo: index })),
            (id) => id === '3'
        );
        const result = await run(shipped('recent-payments'), fake.transport);
        expect(result.run.measurements['recent-payments']?.obtained).toMatchObject({
            subjectsRead: 4,
            unreadableByAdapter: ['3']
        });
        expect(result.run.measurements['recent-payments']?.outcome).toBe('changed');
    });

    it('reads one page when it already holds five payments', async () => {
        const fake = paymentProvider(
            Array.from({ length: 40 }, (_, index) => ({ id: `${index + 1}`, minutesAgo: index }))
        );
        const result = await run(shipped('recent-payments'), fake.transport);
        expect(
            fake.sent.filter((request) => request.path.startsWith('/v1/payments/search'))
        ).toHaveLength(1);
        expect(result.run.measurements['recent-payments']?.obtained).toMatchObject({
            subjectsRead: 5,
            sortedDescending: true
        });
    });
});
