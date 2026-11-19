/**
 * HOS-1512 PR 2, review of #4538 (K1): the engine cancels every pending preapproval a measurement
 * created and lost track of. The shipped measurements are run against a provider whose 2xx create
 * the adapter cannot parse (no `init_point`, or one that is not an absolute URL): the guarded send
 * already holds the id, the adapter throws, and the cancel is still sent, by the engine.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import {
    CLEANUP_CANCEL_LABEL,
    runWatchBattery,
    WATCH_CATALOG,
    type WatchEntry,
    type WatchRequest,
    type WatchResponse,
    type WatchTransport
} from '../src/battery/index';
import { memoryRunStore } from './watch-battery-fixtures';

const clock = createAdjustableClock({ start: new Date('2026-11-17T12:00:00.000Z') });
const SANDBOX_ME = { id: 900000001, tags: ['test_user'] };

function shipped(id: string): WatchEntry {
    const entry = WATCH_CATALOG.find((candidate) => candidate.id === id);
    if (entry === undefined) throw new Error(`no shipped entry ${id}`);
    return entry;
}

/** Creates `pre-1` with a 201 that carries `initPoint` (omitted when `undefined`). */
function provider(args: { readonly initPoint?: string; readonly cancelStatus?: number }) {
    const sent: WatchRequest[] = [];
    let status = 'pending';
    let created: Record<string, unknown> | null = null;
    const transport: WatchTransport = async (request): Promise<WatchResponse> => {
        sent.push(request);
        if (request.path === '/users/me') return { status: 200, body: SANDBOX_ME };
        if (request.method === 'POST' && request.path === '/preapproval') {
            const body = request.body as Record<string, unknown>;
            created = {
                id: 'pre-1',
                status,
                external_reference: body.external_reference,
                auto_recurring: body.auto_recurring,
                ...(args.initPoint === undefined ? {} : { init_point: args.initPoint })
            };
            return { status: 201, body: created };
        }
        if (request.method === 'PUT' && request.path === '/preapproval/pre-1') {
            if ((args.cancelStatus ?? 200) < 300) status = 'cancelled';
            return { status: args.cancelStatus ?? 200, body: { id: 'pre-1', status } };
        }
        if (request.method === 'GET' && request.path === '/preapproval/pre-1' && created) {
            return { status: 200, body: { ...created, status } };
        }
        return { status: 404, body: { message: 'not found' } };
    };
    const cancels = () =>
        sent.filter(
            (request) =>
                request.method === 'PUT' &&
                request.path === '/preapproval/pre-1' &&
                JSON.stringify(request.body) === '{"status":"cancelled"}'
        );
    return { sent, transport, cancels };
}

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

describe('the engine cancels what a measurement lost track of', () => {
    it.each([
        ['no init_point', undefined],
        ['an init_point that is not an absolute URL', '/checkout/pre-1']
    ])('lifecycle-sbx against a 201 with %s: the cancel is sent and nothing is stranded', async (_name, initPoint) => {
        const fake = provider({ initPoint });
        const result = await run(shipped('lifecycle-sbx'), fake.transport);
        const measurement = result.run.measurements['lifecycle-sbx'];
        // The adapter could not parse the create: the measurement errors.
        expect(measurement?.outcome).toBe('errored');
        expect(measurement?.providerIds).toContain('pre-1');
        // The engine sent the exact cancel, once.
        expect(fake.cancels()).toHaveLength(1);
        expect(measurement?.shapes).toHaveProperty(CLEANUP_CANCEL_LABEL);
        // And the run does not strand the object.
        expect(result.run.reason ?? '').not.toContain('PENDING_NOT_CANCELLED');
        expect(result.run.outcome).toBe('failed');
    });

    it('amount-floor against a 201 with no init_point: the probe that was not refused is cancelled', async () => {
        const fake = provider({});
        const result = await run(shipped('amount-floor'), fake.transport);
        expect(fake.cancels()).toHaveLength(1);
        expect(result.run.reason ?? '').not.toContain('PENDING_NOT_CANCELLED');
        // The refusal did not come: a changed value, with its alert.
        expect(result.run.measurements['amount-floor']?.outcome).toBe('changed');
        expect(result.run.alerts.map((alert) => alert.measurementId)).toContain('amount-floor');
    });

    it('names the object when the engine cancel fails too', async () => {
        const fake = provider({ cancelStatus: 500 });
        const result = await run(shipped('lifecycle-sbx'), fake.transport);
        expect(fake.cancels().length).toBeGreaterThanOrEqual(1);
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toMatch(
            /^PENDING_NOT_CANCELLED: the run created and did not cancel pre-1 \(lifecycle-sbx, key hw-[0-9a-f]{40}\)/
        );
    });
});
