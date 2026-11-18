/**
 * HOS-1512 PR 2 (owner decision 2026-11-18): the shipped catalog against the fake HTTP server.
 * The battery moves no money, never sends a card token, cancels in the same run every
 * authorization it creates, and accounts for every row of the fake's lists.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import {
    createWatchTransport,
    expectedAuthorizationSum,
    runWatchBattery,
    validateWatchCatalog,
    validateWatchCoverage,
    WATCH_CATALOG,
    WATCH_REFERENCE_PREFIX,
    WATCHED_BY_HAND,
    type WatchAccount,
    type WatchEntry,
    type WatchSettings,
    type WatchShapeBaseline
} from '../src/battery/index';
import {
    FAKE_AMOUNT_CEILING_MINOR,
    FAKE_AMOUNT_FLOOR_MINOR,
    FAKE_CURRENCY
} from '../src/fake/fake-rules';
import { FakePaymentProvider } from '../src/fake/index';
import {
    type FakeProviderRequest,
    type FakeProviderServer,
    startFakeProviderServer
} from '../src/fake-server';
import { memoryRunStore } from './watch-battery-fixtures';

const NOW = new Date('2026-11-17T12:00:00.000Z');
const SETTINGS: WatchSettings = {
    payerEmail: 'watch-payer@hospeda.test',
    returnUrl: 'https://hospeda.test'
};
const PRODUCTION_ACCOUNT_ID = '100000001';

let activeServer: FakeProviderServer | undefined;
afterEach(async () => {
    await activeServer?.close();
    activeServer = undefined;
});

async function fakeAs(account: WatchAccount) {
    const clock = createAdjustableClock({ start: NOW });
    const provider = new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        // The fake's M1 drops `start_date` on creation, which would hide RP17: EX-60 measured the
        // provider STORING it (truncated to the second) on a no-token create.
        honestAbout: [
            { lie: 'M1', why: 'RP17 (EX-60) measured start_date stored on a no-token create' }
        ]
    });
    activeServer = await startFakeProviderServer({ provider, clock, account });
    return { clock, provider, server: activeServer };
}

async function runCatalog(args: {
    readonly account: WatchAccount;
    readonly server: FakeProviderServer;
    readonly clock: ReturnType<typeof createAdjustableClock>;
    readonly catalog?: readonly WatchEntry[];
    readonly settings?: WatchSettings;
    readonly baseline?: WatchShapeBaseline | null;
}) {
    const store = memoryRunStore({ baseline: args.baseline ?? null });
    const result = await runWatchBattery({
        account: args.account,
        catalog: args.catalog ?? WATCH_CATALOG,
        transport: createWatchTransport({ baseUrl: args.server.url, accessToken: 'test-token' }),
        authorization:
            args.account === 'production'
                ? { month: '2026-11', maxChargeMinor: 0, accountId: PRODUCTION_ACCOUNT_ID }
                : null,
        clock: args.clock,
        settings: args.settings ?? SETTINGS,
        ...store.ports
    });
    return { ...result, store };
}

const writes = (server: FakeProviderServer): readonly FakeProviderRequest[] =>
    server.requests().filter((request) => request.method !== 'GET');

describe('the shipped catalog against the fake', () => {
    it.each([
        'sandbox',
        'production'
    ] as const)('completes in %s and every measurement matches', async (account) => {
        const { server, clock } = await fakeAs(account);
        const result = await runCatalog({ account, server, clock });
        const outcomes = Object.fromEntries(
            Object.entries(result.run.measurements).map(([id, record]) => [
                id,
                `${record.outcome}${record.error ? `: ${record.error}` : ''}${record.outcome === 'changed' ? ` ${JSON.stringify(record.obtained)}` : ''}`
            ])
        );
        expect(result.run.reason).toBeUndefined();
        expect(outcomes).toEqual(
            Object.fromEntries(
                WATCH_CATALOG.filter((entry) => entry.accounts.includes(account)).map((entry) => [
                    entry.id,
                    'matched'
                ])
            )
        );
        expect(result.run.outcome).toBe('completed');
        expect(result.mayPingWatchdog).toBe(true);
    });

    it.each([
        'sandbox',
        'production'
    ] as const)('never sends a card token in %s', async (account) => {
        const { server, clock } = await fakeAs(account);
        await runCatalog({ account, server, clock });
        const bodies = writes(server).map((request) => JSON.stringify(request.body ?? null));
        expect(bodies.length).toBeGreaterThan(0);
        for (const body of bodies) {
            expect(body).not.toContain('card_token_id');
            expect(body).not.toContain('preapproval_plan_id');
            expect(body).not.toContain('free_trial');
        }
    });

    it.each([
        'sandbox',
        'production'
    ] as const)('cancels in the same run every authorization it created in %s', async (account) => {
        const { server, clock } = await fakeAs(account);
        const result = await runCatalog({ account, server, clock });
        expect(result.run.outcome).toBe('completed');
        // The refusal measurements (RP3, RP4) post too, and the provider creates nothing for them.
        const created = writes(server).filter((request) => {
            if (request.method !== 'POST' || request.path !== '/preapproval') return false;
            const recurring = (request.body as { auto_recurring: Record<string, unknown> })
                .auto_recurring;
            const amount = Number(recurring.transaction_amount) * 100;
            return (
                recurring.currency_id === FAKE_CURRENCY &&
                amount >= FAKE_AMOUNT_FLOOR_MINOR &&
                amount <= FAKE_AMOUNT_CEILING_MINOR
            );
        });
        expect(created.length).toBe(account === 'sandbox' ? 4 : 1);
        const search = await createWatchTransport({
            baseUrl: server.url,
            accessToken: 'test-token'
        })({ method: 'GET', path: '/preapproval/search?limit=100&offset=0' });
        const listed = (
            search.body as {
                results: { external_reference: string; status: string }[];
            }
        ).results;
        const ours = listed.filter((item) =>
            item.external_reference.startsWith(WATCH_REFERENCE_PREFIX)
        );
        expect(ours.length).toBe(created.length);
        expect(ours.filter((item) => item.status !== 'cancelled')).toEqual([]);
    });

    it('only ever writes creations and cancellations', async () => {
        const { server, clock } = await fakeAs('production');
        await runCatalog({ account: 'production', server, clock });
        const kinds = new Set(
            writes(server).map((request) =>
                request.method === 'POST' && request.path === '/preapproval'
                    ? 'create'
                    : request.method === 'PUT' &&
                        /^\/preapproval\/[^/]+$/.test(request.path) &&
                        JSON.stringify(request.body) === '{"status":"cancelled"}'
                      ? 'cancel'
                      : `${request.method} ${request.path}`
            )
        );
        expect([...kinds].sort()).toEqual(['cancel', 'create']);
    });

    it('needs no money: the authorized amount it expects is zero', () => {
        expect(expectedAuthorizationSum({ catalog: WATCH_CATALOG, account: 'production' })).toBe(0);
        expect(expectedAuthorizationSum({ catalog: WATCH_CATALOG, account: 'sandbox' })).toBe(0);
        expect(WATCH_CATALOG.filter((entry) => entry.effect === 'moves-money')).toEqual([]);
    });

    it('creates nothing, and fails the creating measurements, without a payer email', async () => {
        const { server, clock } = await fakeAs('sandbox');
        const result = await runCatalog({
            account: 'sandbox',
            server,
            clock,
            settings: { returnUrl: 'https://hospeda.test' }
        });
        expect(writes(server)).toEqual([]);
        expect(result.run.measurements['lifecycle-sbx']?.outcome).toBe('errored');
        expect(result.run.measurements['lifecycle-sbx']?.error).toContain('No payer email');
        expect(result.run.measurements['auth-search']?.outcome).toBe('matched');
    });
});

describe('the catalog accounts for every row', () => {
    it('is a valid catalog', () => {
        expect(validateWatchCatalog({ catalog: WATCH_CATALOG }).problems).toEqual([]);
    });

    it('measures or watches by hand every row of the lists, once', () => {
        expect(
            validateWatchCoverage({ catalog: WATCH_CATALOG, watchedByHand: WATCHED_BY_HAND })
                .problems
        ).toEqual([]);
    });

    it('flags a row left out and a row counted twice', () => {
        const withoutM4 = WATCH_CATALOG.filter((entry) => entry.id !== 'auth-search');
        expect(
            validateWatchCoverage({ catalog: withoutM4, watchedByHand: WATCHED_BY_HAND }).problems
        ).toEqual(['M4: neither measured nor watched by hand']);
        expect(
            validateWatchCoverage({
                catalog: WATCH_CATALOG,
                watchedByHand: [...WATCHED_BY_HAND, { row: 'M4', reason: 'twice' }]
            }).problems
        ).toEqual(['M4: both measured and watched by hand']);
    });

    it('refuses an id longer than the baseline key and an unknown row', () => {
        const base = WATCH_CATALOG[0] as WatchEntry;
        expect(
            validateWatchCatalog({
                catalog: [
                    { ...base, id: 'a-measurement-id-17' },
                    { ...base, id: 'x', rows: ['M99'] }
                ]
            }).problems
        ).toEqual([
            'a-measurement-id-17: not a measurement id of at most 16 characters',
            'x: re-checks M99, not a row of fake-lists.json'
        ]);
    });
});
