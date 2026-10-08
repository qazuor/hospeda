/**
 * TEST:B1:13 (AC:B1:13): the fake tells the measured lies, by default, exactly
 * as their row says; each case names the test that proves our code resists the
 * lie (the row's third datum), and shows that turning the lie off BY NAME
 * brings the honest path back.
 *
 * SCOPE (B1.4a, HOS-1510): the lies whose surface the payment interface carries
 * today: M3, M5, M6, M8, M10, M11 and M13. M1, M2, M4, M7, M9 and M12 keep their
 * row in the closed list and arrive with the units that add their surface.
 *
 * Every assertion reads the state back by id or takes the deliveries, never a
 * status code (B1.md, "ninguna aserción se escribe sobre un código de estado").
 */
import { type AdjustableClock, createAdjustableClock } from '@repo/test-clock';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    FAKE_HONEST_LINK_LIFETIME_MS,
    FAKE_LIES,
    FAKE_NOTICE_CHANNEL_HEADER,
    FAKE_NOTICE_CONTENT_TYPES,
    FAKE_NOTICE_DELAY_MS,
    FakePaymentProvider,
    NOT_REFUNDABLE_MESSAGE,
    type NoticeDelivery,
    PaymentProviderError,
    sanitizeApprovalUrl
} from '../src/index';

const ARS = (amountMinor: number) => ({ amountMinor, currency: 'ARS' }) as const;

const AUTHORIZE = {
    reference: 'sub-1',
    amount: ARS(1_800_000),
    cadence: { everyMonths: 1 },
    reason: 'Plan Anfitrión mensual',
    returnUrl: 'https://hospeda.test/return'
} as const;

/** The defense test the closed list names for a lie. */
const defenseOf = ({ lie }: { readonly lie: string }): string | undefined =>
    FAKE_LIES.find((row) => row.id === lie)?.defenseTest;

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

let clock: AdjustableClock;

beforeEach(() => {
    clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
});

/** An authorization the customer already approved, on the given fake. */
async function activeOn({ fake }: { readonly fake: FakePaymentProvider }): Promise<string> {
    const { authorizationId } = await fake.authorize(AUTHORIZE);
    await fake.approve({ authorizationId });
    return authorizationId;
}

/** The notices of the deliveries, decoded by the fake. */
async function noticesOf({
    fake,
    deliveries
}: {
    readonly fake: FakePaymentProvider;
    readonly deliveries: readonly NoticeDelivery[];
}) {
    return Promise.all(deliveries.map((delivery) => fake.decodeNotice(delivery)));
}

describe('TEST:B1:13 the closed list of measured lies', () => {
    it('holds thirteen rows, M1 to M13, each with its three data', () => {
        expect(FAKE_LIES.map((row) => row.id)).toEqual(
            Array.from({ length: 13 }, (_, i) => `M${i + 1}`)
        );
        for (const row of FAKE_LIES) {
            expect(row.name.trim(), row.id).not.toBe('');
            expect(row.measured.length, row.id).toBeGreaterThan(0);
            expect(row.defenseTest, row.id).toMatch(/^TEST:[A-Za-z0-9]+:\d+$/);
        }
    });

    it('M8 meets its three data with EX-51 (2026-09-24, production)', () => {
        expect(FAKE_LIES.find((row) => row.id === 'M8')?.measured).toContainEqual({
            row: 'EX-51',
            date: '2026-09-24',
            accounts: ['production']
        });
    });
});

describe('TEST:B1:13 M3: a duplicate for every equal request', () => {
    it('creates a second authorization for the same reference; defended by TEST:B3:6', async () => {
        // Arrange
        const fake = new FakePaymentProvider({ clock });

        // Act
        const first = await fake.authorize(AUTHORIZE);
        const second = await fake.authorize(AUTHORIZE);

        // Assert
        expect(second.authorizationId).not.toBe(first.authorizationId);
        for (const { authorizationId } of [first, second]) {
            expect((await fake.readAuthorization({ authorizationId })).snapshot.reference).toBe(
                'sub-1'
            );
        }
        expect(defenseOf({ lie: 'M3' })).toBe('TEST:B3:6');
    });

    it('with M3 turned off by name, the same request returns the same authorization', async () => {
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M3', why: 'the honest path: one authorization per reference' }]
        });
        const first = await fake.authorize(AUTHORIZE);
        const second = await fake.authorize(AUTHORIZE);
        expect(second.authorizationId).toBe(first.authorizationId);
    });
});

describe('TEST:B1:13 M5: an amount change sends no notice', () => {
    it('applies the change and says nothing; defended by TEST:B11:8', async () => {
        // Arrange
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M6', why: 'count the notices at once, one per change' }]
        });
        const authorizationId = await activeOn({ fake });
        fake.takeDeliveries();

        // Act
        await fake.changeAmount({ authorizationId, amount: ARS(2_000_000) });

        // Assert
        expect((await fake.readAuthorization({ authorizationId })).snapshot.amount).toEqual(
            ARS(2_000_000)
        );
        clock.advance({ ms: 7 * 24 * 60 * 60_000 });
        expect(fake.takeDeliveries().deliveries).toEqual([]);
        expect(defenseOf({ lie: 'M5' })).toBe('TEST:B11:8');
    });

    it('with M5 turned off by name, the change sends its notice', async () => {
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [
                { lie: 'M5', why: 'the honest path: an amount change is notified' },
                { lie: 'M6', why: 'count the notices at once, one per change' }
            ]
        });
        const authorizationId = await activeOn({ fake });
        fake.takeDeliveries();
        await fake.changeAmount({ authorizationId, amount: ARS(2_000_000) });
        const { deliveries } = fake.takeDeliveries();
        expect(await noticesOf({ fake, deliveries })).toEqual([
            { resourceKind: 'authorization', resourceId: authorizationId, version: '3' }
        ]);
    });
});

describe('TEST:B1:13 M6: notices late, repeated or never', () => {
    it('an authorization notice comes late, then repeated, then never; defended by TEST:B5:2', async () => {
        // Arrange
        const fake = new FakePaymentProvider({ clock });

        // Act: three changes, three notices (born, approved, paused)
        const authorizationId = await activeOn({ fake });
        await fake.pause({ authorizationId });
        const atOnce = fake.takeDeliveries().deliveries;
        clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        const late = fake.takeDeliveries().deliveries;
        clock.advance({ ms: 30 * 24 * 60 * 60_000 });
        const ever = fake.takeDeliveries().deliveries;

        // Assert
        const versions = async (deliveries: readonly NoticeDelivery[]) =>
            (await noticesOf({ fake, deliveries })).map((notice) => notice.version);
        expect(await versions(atOnce)).toEqual(['2']);
        expect(await versions(late)).toEqual(['1', '2']);
        expect(ever).toEqual([]);
        expect(defenseOf({ lie: 'M6' })).toBe('TEST:B5:2');
    });

    it('a refund arrives as three deliveries in two formats', async () => {
        // Arrange
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [
                { lie: 'M8', why: 'refund a charge approved at once' },
                { lie: 'M13', why: 'the first partial refund must go through' }
            ]
        });
        const authorizationId = await activeOn({ fake });
        const { chargeId } = await fake.charge({
            authorizationId,
            amount: ARS(1_800_000),
            reference: 'cycle-1'
        });
        clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        fake.takeDeliveries();

        // Act
        const { refundId } = await fake.refund({
            chargeId,
            amount: ARS(500_000),
            reference: 'r-1'
        });
        clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        const { deliveries } = fake.takeDeliveries();

        // Assert
        const refundDeliveries = [];
        for (const delivery of deliveries) {
            const notice = await fake.decodeNotice(delivery);
            if (notice.resourceKind === 'refund') {
                expect(notice.resourceId).toBe(refundId);
                refundDeliveries.push(delivery);
            }
        }
        expect(refundDeliveries).toHaveLength(3);
        expect(new Set(refundDeliveries.map((d) => d.headers['content-type']))).toEqual(
            new Set([FAKE_NOTICE_CONTENT_TYPES.json, FAKE_NOTICE_CONTENT_TYPES.form])
        );
    });

    it('a charge arrives once per channel', async () => {
        // Arrange
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M8', why: 'only the charge creation notice is counted here' }]
        });
        const authorizationId = await activeOn({ fake });
        clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        fake.takeDeliveries();

        // Act
        const { chargeId } = await fake.charge({
            authorizationId,
            amount: ARS(1_800_000),
            reference: 'cycle-1'
        });
        const { deliveries } = fake.takeDeliveries();

        // Assert
        expect(await noticesOf({ fake, deliveries })).toEqual([
            { resourceKind: 'charge', resourceId: chargeId, version: '1' },
            { resourceKind: 'charge', resourceId: chargeId, version: '1' }
        ]);
        expect(deliveries.map((d) => d.headers[FAKE_NOTICE_CHANNEL_HEADER])).toEqual([
            'primary',
            'secondary'
        ]);
    });

    it('with M6 turned off by name, one delivery per change, at once, on one channel', async () => {
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M6', why: 'the honest path: every notice once and at once' }]
        });
        const authorizationId = await activeOn({ fake });
        await fake.pause({ authorizationId });
        const { deliveries } = fake.takeDeliveries();
        expect((await noticesOf({ fake, deliveries })).map((n) => n.version)).toEqual([
            '1',
            '2',
            '3'
        ]);
        expect(new Set(deliveries.map((d) => d.headers[FAKE_NOTICE_CHANNEL_HEADER]))).toEqual(
            new Set(['primary'])
        );
    });
});

describe('TEST:B1:13 M8: charges late and in batches', () => {
    it('a charge lands at minute :02 of the next hour, with every charge of that hour; defended by TEST:B8a:10', async () => {
        // Arrange
        clock.set({ at: new Date('2026-10-01T13:13:00.000Z') });
        const fake = new FakePaymentProvider({ clock });
        const authorizationId = await activeOn({ fake });

        // Act
        const first = await fake.charge({
            authorizationId,
            amount: ARS(1_800_000),
            reference: 'a'
        });
        clock.set({ at: new Date('2026-10-01T13:28:00.000Z') });
        const second = await fake.charge({
            authorizationId,
            amount: ARS(1_800_000),
            reference: 'b'
        });
        const before = (await fake.readCharge({ chargeId: first.chargeId })).snapshot.status;
        clock.set({ at: new Date('2026-10-01T14:01:59.999Z') });
        const justBefore = (await fake.readCharge({ chargeId: first.chargeId })).snapshot.status;
        clock.set({ at: new Date('2026-10-01T14:02:00.000Z') });

        // Assert
        expect(before).toBe('pending');
        expect(justBefore).toBe('pending');
        for (const { chargeId } of [first, second]) {
            expect((await fake.readCharge({ chargeId })).snapshot.status).toBe('approved');
        }
        expect(defenseOf({ lie: 'M8' })).toBe('TEST:B8a:10');
    });

    it('with M8 turned off by name, the charge is approved the moment it is asked', async () => {
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M8', why: 'the honest path: a charge lands at once' }]
        });
        const authorizationId = await activeOn({ fake });
        const { chargeId } = await fake.charge({
            authorizationId,
            amount: ARS(1_800_000),
            reference: 'a'
        });
        expect((await fake.readCharge({ chargeId })).snapshot.status).toBe('approved');
    });
});

describe('TEST:B1:13 M10: the approval link comes back broken', () => {
    it('carries activation=true, which the sanitizer removes; defended by TEST:B1:6', async () => {
        // Arrange
        const fake = new FakePaymentProvider({ clock });

        // Act
        const result = await fake.authorize(AUTHORIZE);

        // Assert
        expect(new URL(result.approvalUrl).searchParams.get('activation')).toBe('true');
        expect(new URL(sanitizeApprovalUrl(result).url).searchParams.has('activation')).toBe(false);
        expect(defenseOf({ lie: 'M10' })).toBe('TEST:B1:6');
    });

    it('with M10 turned off by name, the link comes back sound', async () => {
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M10', why: 'the honest path: a link that opens' }]
        });
        const result = await fake.authorize(AUTHORIZE);
        expect(new URL(result.approvalUrl).search).toBe('');
    });
});

describe('TEST:B1:13 M11: an open link never expires', () => {
    it('an authorization nobody approved stays pending for good; defended by TEST:B3:10', async () => {
        // Arrange
        const fake = new FakePaymentProvider({ clock });
        const { authorizationId } = await fake.authorize(AUTHORIZE);

        // Act
        clock.advance({ ms: 9 * 24 * 60 * 60_000 });

        // Assert
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe('pending');
        expect(defenseOf({ lie: 'M11' })).toBe('TEST:B3:10');
    });

    it('with M11 turned off by name, the link expires after its lifetime', async () => {
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M11', why: 'the honest path: an open link expires' }]
        });
        const { authorizationId } = await fake.authorize(AUTHORIZE);
        clock.advance({ ms: FAKE_HONEST_LINK_LIFETIME_MS - 1 });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe('pending');
        clock.advance({ ms: 1 });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe(
            'cancelled'
        );
    });
});

describe('TEST:B1:13 M13: a refundable charge said not refundable', () => {
    /** A charge of ARS 18.000, approved, on the given fake. */
    async function chargedOn({ fake }: { readonly fake: FakePaymentProvider }): Promise<string> {
        const authorizationId = await activeOn({ fake });
        const { chargeId } = await fake.charge({
            authorizationId,
            amount: ARS(1_800_000),
            reference: 'cycle-1'
        });
        return chargeId;
    }

    it('refuses the first partial refund, then accepts another amount; defended by TEST:B6:3', async () => {
        // Arrange
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M8', why: 'refund a charge approved at once' }]
        });
        const chargeId = await chargedOn({ fake });

        // Act
        const refused = await rejectionOf({
            promise: fake.refund({ chargeId, amount: ARS(500), reference: 'r-1' })
        });
        const afterRefusal = (await fake.readCharge({ chargeId })).snapshot.refundedAmount;
        await fake.refund({ chargeId, amount: ARS(1_400), reference: 'r-2' });

        // Assert
        expect(refused.message).toBe(NOT_REFUNDABLE_MESSAGE);
        expect(afterRefusal).toEqual(ARS(0));
        expect((await fake.readCharge({ chargeId })).snapshot.refundedAmount).toEqual(ARS(1_400));
        expect(defenseOf({ lie: 'M13' })).toBe('TEST:B6:3');
    });

    it('with M13 turned off by name, the first partial refund goes through', async () => {
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [
                { lie: 'M8', why: 'refund a charge approved at once' },
                { lie: 'M13', why: 'the honest path: a refundable charge is refunded' }
            ]
        });
        const chargeId = await chargedOn({ fake });
        await fake.refund({ chargeId, amount: ARS(500), reference: 'r-1' });
        expect((await fake.readCharge({ chargeId })).snapshot.refundedAmount).toEqual(ARS(500));
    });
});
