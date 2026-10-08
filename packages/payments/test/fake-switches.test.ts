/**
 * TEST:B1:9, the runtime half (AC:B1:9): the three rules of the closed list as
 * the fake enforces them when it is built. By default it lies; a lie is turned
 * off only by naming one of the list and saying why; and what it simulates
 * without having measured it is apart, off by default, and turned on the same
 * way. The static half, GUARD:G15 over the source, is
 * `scripts/__tests__/check-fake-lies.test.ts`.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import {
    FAKE_LIES,
    FAKE_SIMULATIONS,
    FakePaymentProvider,
    type FakePaymentProviderOptions,
    PaymentProviderError
} from '../src/index';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
const ARS = (amountMinor: number) => ({ amountMinor, currency: 'ARS' }) as const;

const AUTHORIZE = {
    reference: 'sub-1',
    amount: ARS(1_800_000),
    cadence: { everyMonths: 1 },
    reason: 'Plan Anfitrión mensual',
    returnUrl: 'https://hospeda.test/return'
} as const;

/** Builds a fake from options the type would refuse, to test the runtime check. */
const build = (options: unknown) => new FakePaymentProvider(options as FakePaymentProviderOptions);

/** The rejection a promise ends in, or a failure. */
async function rejectionOf({
    promise
}: {
    readonly promise: Promise<unknown>;
}): Promise<PaymentProviderError> {
    try {
        await promise;
    } catch (error) {
        if (error instanceof PaymentProviderError) return error;
        throw error;
    }
    throw new Error('expected a rejection');
}

describe('TEST:B1:9 turning a lie off', () => {
    it('lies by default: built with the clock alone, the link comes back broken', async () => {
        const result = await build({ clock }).authorize(AUTHORIZE);
        expect(new URL(result.approvalUrl).searchParams.get('activation')).toBe('true');
    });

    it('refuses a lie that is not in the closed list', () => {
        expect(() => build({ clock, honestAbout: [{ lie: 'M14', why: 'invented' }] })).toThrow(
            /not a lie of the closed list/
        );
        expect(FAKE_LIES.some((lie) => lie.id === 'M14')).toBe(false);
    });

    it('refuses a lie turned off without saying why', () => {
        expect(() => build({ clock, honestAbout: [{ lie: 'M10' }] })).toThrow();
        expect(() => build({ clock, honestAbout: [{ lie: 'M10', why: '   ' }] })).toThrow(
            /say why/
        );
    });

    it('refuses a reason without the lie it is for', () => {
        expect(() => build({ clock, honestAbout: [{ why: 'no name' }] })).toThrow();
    });

    it('refuses the same lie turned off twice', () => {
        expect(() =>
            build({
                clock,
                honestAbout: [
                    { lie: 'M10', why: 'once' },
                    { lie: 'M10', why: 'twice' }
                ]
            })
        ).toThrow(/each lie is turned off once/);
    });

    it('turns off only the lie it names', async () => {
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M10', why: 'the honest link, and nothing else' }]
        });
        const first = await fake.authorize(AUTHORIZE);
        const second = await fake.authorize(AUTHORIZE);
        expect(new URL(first.approvalUrl).search).toBe('');
        // M3 is still told: a second authorization for the same reference.
        expect(second.authorizationId).not.toBe(first.authorizationId);
    });
});

describe('TEST:B1:9 the simulations, apart from the lies', () => {
    it('are three, none of them a lie of the list', () => {
        expect(FAKE_SIMULATIONS.map((s) => s.id)).toEqual([
            'lostResponse',
            'networkCut',
            'noticesOutOfOrder'
        ]);
        const lieIds = FAKE_LIES.map((lie) => lie.id);
        for (const simulation of FAKE_SIMULATIONS) expect(lieIds).not.toContain(simulation.id);
    });

    it('are off by default: a request lands and answers', async () => {
        const fake = build({ clock });
        const { authorizationId } = await fake.authorize(AUTHORIZE);
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe('pending');
    });

    it('refuse a simulation turned on without saying why, or not in the list', () => {
        expect(() => build({ clock, simulate: [{ simulation: 'networkCut' }] })).toThrow();
        expect(() => build({ clock, simulate: [{ simulation: 'slowDisk', why: 'x' }] })).toThrow(
            /not a simulation of the list/
        );
    });

    it('networkCut: the request never arrives, nothing is created', async () => {
        const fake = new FakePaymentProvider({
            clock,
            simulate: [{ simulation: 'networkCut', why: 'the request must not reach the provider' }]
        });
        expect((await rejectionOf({ promise: fake.authorize(AUTHORIZE) })).code).toBe(
            'UNAVAILABLE'
        );
        expect(
            (
                await rejectionOf({
                    promise: fake.readAuthorization({ authorizationId: 'fake-auth-1' })
                })
            ).code
        ).toBe('NOT_FOUND');
    });

    it('lostResponse: the request lands, the answer does not', async () => {
        const fake = new FakePaymentProvider({
            clock,
            simulate: [
                { simulation: 'lostResponse', why: 'the work is done but we never hear back' }
            ]
        });
        expect((await rejectionOf({ promise: fake.authorize(AUTHORIZE) })).code).toBe(
            'UNAVAILABLE'
        );
        expect(
            (await fake.readAuthorization({ authorizationId: 'fake-auth-1' })).snapshot.reference
        ).toBe('sub-1');
    });

    it('noticesOutOfOrder: the due deliveries come newest first', async () => {
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M6', why: 'one delivery per change, so the order is readable' }],
            simulate: [{ simulation: 'noticesOutOfOrder', why: 'the receiver must resist it' }]
        });
        const { authorizationId } = await fake.authorize(AUTHORIZE);
        await fake.approve({ authorizationId });
        const { deliveries } = fake.takeDeliveries();
        const versions = await Promise.all(
            deliveries.map(async (delivery) => (await fake.decodeNotice(delivery)).version)
        );
        expect(versions).toEqual(['2', '1']);
    });
});
