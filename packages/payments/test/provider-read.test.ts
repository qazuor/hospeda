/**
 * TEST:B1:4 (AC:B1:4, INV:D17): a read by id carries its instant, and a
 * decision refuses a read taken before the act started, which forces the act
 * to re-read. In an administrative action the start is its confirmation.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/index';
import {
    type ActStart,
    assertFreshForAct,
    type ProviderRead,
    ProviderReadRejectedError
} from '../src/index';

const at = (hhmm: string) => new Date(`2026-10-01T${hhmm}:00.000Z`);

let clock: ReturnType<typeof createAdjustableClock>;
let fake: FakePaymentProvider;
let authorizationId: string;

beforeEach(async () => {
    clock = createAdjustableClock({ start: at('02:59') });
    fake = new FakePaymentProvider({ clock });
    ({ authorizationId } = await fake.authorize({
        reference: 'juan',
        amount: { amountMinor: 1_800_000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'Plan Anfitrión mensual',
        returnUrl: 'https://hospeda.test/return'
    }));
});

/** The reason a check refuses with, or `undefined` when it accepts. */
function rejectionOf(input: {
    readonly read: ProviderRead<unknown>;
    readonly act: ActStart;
}): string | undefined {
    try {
        assertFreshForAct(input);
        return undefined;
    } catch (error) {
        if (error instanceof ProviderReadRejectedError) return error.reason;
        throw error;
    }
}

describe('TEST:B1:4 a read by id older than the act is refused', () => {
    it('the nightly run read Juan at 3:00; the decision on Juan starts at 3:40: refused, then re-read', async () => {
        // Arrange: the run reads at 3:00 and reaches Juan at 3:40
        clock.set({ at: at('03:00') });
        const runRead = await fake.readAuthorization({ authorizationId });
        clock.set({ at: at('03:40') });
        const act: ActStart = { kind: 'decision', startedAt: clock.now() };

        // Act
        const stale = rejectionOf({ read: runRead, act });
        const reread = await fake.readAuthorization({ authorizationId });
        const fresh = assertFreshForAct({ read: reread, act });

        // Assert
        expect(runRead.readAt).toEqual(at('03:00'));
        expect(stale).toBe('STALE_READ');
        expect(fresh.readAt).toEqual(at('03:40'));
        expect(fresh.snapshot.authorizationId).toBe(authorizationId);
    });

    it('accepts a read taken after the act started', async () => {
        // Arrange
        const act: ActStart = { kind: 'decision', startedAt: at('03:40') };
        clock.set({ at: at('03:41') });

        // Act
        const read = await fake.readAuthorization({ authorizationId });

        // Assert
        expect(rejectionOf({ read, act })).toBeUndefined();
    });

    it('accepts a read taken at the very instant the act started', async () => {
        clock.set({ at: at('03:40') });
        const read = await fake.readAuthorization({ authorizationId });
        expect(rejectionOf({ read, act: { kind: 'decision', startedAt: at('03:40') } })).toBe(
            undefined
        );
    });

    it('an administrative action starts at its confirmation: a read between opening and confirming is refused', async () => {
        // Arrange: the admin opened the screen at 10:00 (read then) and confirmed at 10:05
        clock.set({ at: at('10:00') });
        const readWhenOpened = await fake.readAuthorization({ authorizationId });
        const act: ActStart = { kind: 'adminAction', confirmedAt: at('10:05') };

        // Act
        const stale = rejectionOf({ read: readWhenOpened, act });
        clock.set({ at: at('10:05') });
        const reread = await fake.readAuthorization({ authorizationId });

        // Assert
        expect(stale).toBe('STALE_READ');
        expect(rejectionOf({ read: reread, act })).toBeUndefined();
    });

    it('names both instants on a refusal', async () => {
        clock.set({ at: at('03:00') });
        const read = await fake.readAuthorization({ authorizationId });
        try {
            assertFreshForAct({ read, act: { kind: 'decision', startedAt: at('03:40') } });
            expect.unreachable('a stale read must be refused');
        } catch (error) {
            expect(error).toBeInstanceOf(ProviderReadRejectedError);
            expect(error).toMatchObject({ readAt: at('03:00'), actStartedAt: at('03:40') });
        }
    });
});

describe('only an implementation builds a read', () => {
    it('refuses an object shaped like a read that no provider built', () => {
        // Arrange: a fresh-looking literal, as code outside the package could write it
        const forged = {
            snapshot: { authorizationId: 'x' },
            readAt: at('23:59')
        } as unknown as ProviderRead<unknown>;

        // Act / Assert
        expect(
            rejectionOf({ read: forged, act: { kind: 'decision', startedAt: at('03:00') } })
        ).toBe('NOT_A_PROVIDER_READ');
    });

    it('refuses a clone of a real read', async () => {
        clock.set({ at: at('03:40') });
        const read = await fake.readAuthorization({ authorizationId });
        const clone = structuredClone(read);
        expect(
            rejectionOf({ read: clone, act: { kind: 'decision', startedAt: at('03:00') } })
        ).toBe('NOT_A_PROVIDER_READ');
    });

    it('does not export the builder from the package entry', async () => {
        const entry: Record<string, unknown> = await import('../src/index');
        expect(entry).not.toHaveProperty('stampProviderRead');
    });

    it('the read cannot be moved forward by mutating its instant', async () => {
        clock.set({ at: at('03:00') });
        const read = await fake.readAuthorization({ authorizationId });
        read.readAt.setTime(at('23:59').getTime());
        expect(rejectionOf({ read, act: { kind: 'decision', startedAt: at('03:40') } })).toBe(
            'STALE_READ'
        );
    });
});
