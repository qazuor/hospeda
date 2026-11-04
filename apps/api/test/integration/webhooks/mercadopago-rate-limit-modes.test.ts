import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const governorHolder = vi.hoisted(() => ({
    governor: undefined as { mode: string; coolDownRemainingMs: () => number } | undefined
}));
vi.mock('../../../src/utils/mp-traffic-governor', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/utils/mp-traffic-governor')>()),
    getMercadoPagoTrafficGovernor: () => governorHolder.governor
}));

import {
    createSubjects,
    postDelivery,
    retireSubjects,
    signedNotice,
    signup
} from './mercadopago-delegates-fixtures';
import { startPeriodChargesFixture } from './mercadopago-period-charges-fixtures';

const subjects = createSubjects();
let fixture: Awaited<ReturnType<typeof startPeriodChargesFixture>>;

beforeAll(async () => {
    fixture = await startPeriodChargesFixture();
});
afterEach(async () => {
    fixture.server.setThrottle({ throttle: undefined });
    await retireSubjects(subjects, fixture.lifterId);
});
afterAll(async () => fixture.stop());

/** Delivers a payment notice whose provider read the fake server answers with a 429. */
async function deliverThrottledPaymentNotice() {
    const created = await signup({
        app: fixture.app,
        billingOptionId: fixture.billingOptionId,
        subjects
    });
    await fixture.fake.approve({ authorizationId: created.authorizationId });
    fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    const charge = await fixture.fake.charge({
        authorizationId: created.authorizationId,
        amount: { amountMinor: 100000, currency: 'ARS' },
        reference: `rate-limit-${crypto.randomUUID()}`
    });
    fixture.clock.advance({ ms: 60 * 60 * 1000 });
    fixture.server.setThrottle({
        throttle: { status: 429, retryAfter: 1, paths: ['/v1/payments/'] }
    });
    const delivery = signedNotice({
        clock: fixture.clock,
        type: 'payment',
        id: charge.chargeId,
        version: '1'
    });
    subjects.deliveries.push(delivery);
    return postDelivery(fixture.app, delivery);
}

describe('HOS-1999 AC-29 a rate-limited webhook read follows the governor mode', () => {
    it.each([
        ['off', undefined],
        ['observe', { mode: 'observe', coolDownRemainingMs: () => 37_000 }]
    ])(
        'keeps a 429 on the read as a 500 without Retry-After under %s',
        async (_mode, governor) => {
            governorHolder.governor = governor;
            const response = await deliverThrottledPaymentNotice();
            expect(response.status).toBe(500);
            expect(response.headers.get('Retry-After')).toBeNull();
        },
        60_000
    );

    it('defers it as a 503 carrying the remaining cool-down under enforce (the control)', async () => {
        governorHolder.governor = { mode: 'enforce', coolDownRemainingMs: () => 36_001 };
        const response = await deliverThrottledPaymentNotice();
        expect(response.status).toBe(503);
        expect(response.headers.get('Retry-After')).toBe('37');
    }, 60_000);
});
